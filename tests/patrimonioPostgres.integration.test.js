import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";
const executarIntegracao = Boolean(apiUrl && migrationUrl);

test("PostgreSQL valida a árvore patrimonial e isola equipes", {
  skip: !executarIntegracao && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const sufixo = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const teamA = randomUUID();
  const teamB = randomUUID();
  const subject = `teste-patrimonio-${sufixo}`;
  const admin = new Client({ connectionString: migrationUrl });
  const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  const contextoA = { identity: { subject }, tenantId, teamId: teamA };
  const contextoB = { identity: { subject }, tenantId, teamId: teamB };

  try {
    await admin.connect();
    await admin.query("INSERT INTO app.tenants (id,nome) VALUES ($1,'Teste Patrimônio')", [tenantId]);
    await admin.query("INSERT INTO app.teams (tenant_id,id,nome) VALUES ($1,$2,'Equipe A'),($1,$3,'Equipe B')", [tenantId, teamA, teamB]);
    await admin.query("INSERT INTO app.memberships (tenant_id,identity_subject,perfil_id) VALUES ($1,$2,'administrador')", [tenantId, subject]);
    await admin.query("INSERT INTO app.team_memberships (tenant_id,team_id,identity_subject) VALUES ($1,$2,$4),($1,$3,$4)", [tenantId, teamA, teamB, subject]);

    await assert.rejects(
      () => repository.atualizarContratoModulo(contextoA, "patrimonio", { habilitado: false }),
      (error) => error.code === "INTEGRIDADE_INVALIDA",
    );

    const cliente = await repository.criarUnidadePatrimonial(contextoA, { nivel:"cliente",codigo:`CLI-${sufixo}`,nome:"Cliente" }, `cli-${sufixo}`);
    await assert.rejects(
      () => repository.criarUnidadePatrimonial(contextoA, { nivel:"predio",parentId:cliente.id,codigo:`PX-${sufixo}`,nome:"Prédio inválido" }, `px-${sufixo}`),
      (error) => error.code === "INTEGRIDADE_INVALIDA",
    );
    const site = await repository.criarUnidadePatrimonial(contextoA, { nivel:"site",parentId:cliente.id,codigo:`SITE-${sufixo}`,nome:"Site" }, `site-${sufixo}`);
    const exemplo = await repository.criarUnidadePatrimonial(contextoA, { nivel:"site",parentId:cliente.id,codigo:`EX-${sufixo}`,nome:"Prédio de exemplo" }, `ex-${sufixo}`);
    const exemploCorrigido = await repository.atualizarUnidadePatrimonial(contextoA, exemplo.id, { ...exemplo, nivel:"predio",parentId:site.id }, exemplo.versao);
    assert.equal(exemploCorrigido.nivel, "predio");
    await repository.excluirUnidadePatrimonial(contextoA, exemploCorrigido.id, exemploCorrigido.versao);
    const predio = await repository.criarUnidadePatrimonial(contextoA, { nivel:"predio",parentId:site.id,codigo:`P-${sufixo}`,nome:"Prédio" }, `p-${sufixo}`);
    const salaA = await repository.criarUnidadePatrimonial(contextoA, { nivel:"sala",parentId:predio.id,codigo:`SA-${sufixo}`,nome:"Sala A" }, `sa-${sufixo}`);
    const salaB = await repository.criarUnidadePatrimonial(contextoA, { nivel:"sala",parentId:predio.id,codigo:`SB-${sufixo}`,nome:"Sala B" }, `sb-${sufixo}`);
    const ativo = await repository.criarAtivoPatrimonial(contextoA, { salaId:salaA.id,codigo:`AT-${sufixo}`,nome:"Equipamento" }, `at-${sufixo}`);
    await repository.movimentarAtivoPatrimonial(contextoA, ativo.id, { destinoSalaId:salaB.id,motivo:"Teste de movimentação" }, `mov-${sufixo}`);

    assert.equal((await repository.listarUnidadesPatrimoniais(contextoA)).length, 5);
    assert.equal((await repository.listarUnidadesPatrimoniais(contextoB)).length, 0);
    assert.equal((await repository.listarAtivosPatrimoniais(contextoA))[0].salaId, salaB.id);
    assert.equal((await repository.listarMovimentacoesPatrimoniais(contextoA, ativo.id)).length, 1);
    await assert.rejects(
      () => repository.excluirUnidadePatrimonial(contextoA, predio.id, predio.versao),
      (error) => error.code === "UNIDADE_PATRIMONIAL_EM_USO",
    );
  } finally {
    await repository.fechar();
    if (admin._connected) {
      await admin.query("SELECT app.limpar_patrimonio_tenant_teste($1)", [tenantId]);
      await admin.query("BEGIN");
      await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [tenantId, subject, teamA]);
      await admin.query("DELETE FROM app.domain_events");
      await admin.query("DELETE FROM app.idempotency_keys WHERE chave LIKE 'patrimonio-%'");
      await admin.query("COMMIT");
      await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantId]);
      await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1", [tenantId]);
      await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1", [tenantId]);
      await admin.query("DELETE FROM app.teams WHERE tenant_id=$1", [tenantId]);
      await admin.query("DELETE FROM app.tenants WHERE id=$1", [tenantId]);
      await admin.end();
    }
  }
});
