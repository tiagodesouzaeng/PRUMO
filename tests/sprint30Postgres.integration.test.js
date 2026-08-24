import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";

test("PostgreSQL isola e governa o PPCI pela árvore patrimonial", { skip: !(apiUrl && migrationUrl) && "Conexões PostgreSQL de integração não configuradas." }, async () => {
  const sufixo = randomUUID().slice(0, 8), tenantId = randomUUID(), teamA = randomUUID(), teamB = randomUUID(), subject = `teste-ppci-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl }); const repo = criarRepositorioPostgres({ connectionString: apiUrl });
  const a = { identity: { subject }, tenantId, teamId: teamA }, b = { identity: { subject }, tenantId, teamId: teamB };
  try {
    await admin.connect(); await admin.query("INSERT INTO app.tenants(id,nome) VALUES($1,'Teste PPCI')", [tenantId]);
    await admin.query("INSERT INTO app.teams(tenant_id,id,nome) VALUES($1,$2,'Equipe A'),($1,$3,'Equipe B')", [tenantId, teamA, teamB]);
    await admin.query("INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador')", [tenantId, subject]);
    await admin.query("INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$4),($1,$3,$4)", [tenantId, teamA, teamB, subject]);
    const cliente = await repo.criarUnidadePatrimonial(a, { nivel: "cliente", codigo: `C-${sufixo}`, nome: "Cliente" }, `c-${sufixo}`);
    const site = await repo.criarUnidadePatrimonial(a, { nivel: "site", parentId: cliente.id, codigo: `S-${sufixo}`, nome: "Site" }, `s-${sufixo}`);
    const predio = await repo.criarUnidadePatrimonial(a, { nivel: "predio", parentId: site.id, codigo: `P-${sufixo}`, nome: "Prédio" }, `p-${sufixo}`);
    const sala = await repo.criarUnidadePatrimonial(a, { nivel: "sala", parentId: predio.id, codigo: `SL-${sufixo}`, nome: "Sala" }, `sl-${sufixo}`);
    const outroSite = await repo.criarUnidadePatrimonial(a, { nivel: "site", parentId: cliente.id, codigo: `S2-${sufixo}`, nome: "Outro site" }, `s2-${sufixo}`);
    const ppci = await repo.criarPpci(a, { patrimonioUnidadeId: site.id, codigo: `PPCI-${sufixo}`, titulo: "PPCI do site", fase: "analise", status: "em_analise", dataValidade: "2027-08-01", dados: {} }, `ppci-${sufixo}`);
    assert.equal((await repo.listarPpcis(a)).length, 1); assert.equal((await repo.listarPpcis(b)).length, 0);
    await repo.criarSistemaPpci(a, ppci.id, { patrimonioUnidadeId: sala.id, tipo: "hidrantes", descricao: "Rede de hidrantes", quantidade: 2, dados: {} }, `sis-${sufixo}`);
    await assert.rejects(() => repo.criarSistemaPpci(a, ppci.id, { patrimonioUnidadeId: outroSite.id, tipo: "alarme", descricao: "Fora do escopo", dados: {} }, `sis2-${sufixo}`), /escopo patrimonial/i);
    await repo.registrarInspecaoPpci(a, ppci.id, { dataInspecao: "2026-08-19", tipo: "preventiva", resultado: "conforme", inspetor: "Equipe técnica", evidencias: [] }, `insp-${sufixo}`);
    const detalhe = await repo.obterPpci(a, ppci.id); assert.equal(detalhe.sistemas.length, 1); assert.equal(detalhe.inspecoes.length, 1);
  } finally {
    await repo.fechar();
    if (admin._connected) {
      await admin.query("SELECT app.limpar_ppci_tenant_teste($1)", [tenantId]); await admin.query("SELECT app.limpar_patrimonio_tenant_teste($1)", [tenantId]);
      await admin.query("BEGIN"); await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [tenantId, subject, teamA]); await admin.query("DELETE FROM app.domain_events"); await admin.query("DELETE FROM app.idempotency_keys"); await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantId]); await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1", [tenantId]); await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1", [tenantId]); await admin.query("DELETE FROM app.teams WHERE tenant_id=$1", [tenantId]); await admin.query("DELETE FROM app.tenants WHERE id=$1", [tenantId]); await admin.end();
    }
  }
});
