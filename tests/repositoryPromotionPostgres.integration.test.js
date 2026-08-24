import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";
import { criarManifestoLocalOrcamentos } from "../src/services/repositorioCorporativo.js";

const { Client } = pg;
const apiUrl = process.env.PRUMO_DATABASE_URL || "";
const migrationUrl = process.env.PRUMO_MIGRATION_DATABASE_URL || "";

test("PostgreSQL promove Orçamentos somente após paridade e permite retorno justificado", {
  skip: !(apiUrl && migrationUrl) && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const tenantId = randomUUID();
  const teamId = randomUUID();
  const subject = `promocao-${randomUUID().slice(0, 8)}`;
  const admin = new Client({ connectionString: migrationUrl });
  const repository = criarRepositorioPostgres({ connectionString: apiUrl });
  const contexto = { identity: { subject }, tenantId, teamId };
  const local = { id: "ORC-LOCAL-29", nome: "Unidade de saúde", itens: [{ id: "ITEM-1", unitario: 200 }] };

  try {
    await admin.connect();
    await admin.query("INSERT INTO app.tenants(id,nome) VALUES($1,'Teste promoção')", [tenantId]);
    await admin.query("INSERT INTO app.teams(tenant_id,id,nome) VALUES($1,$2,'Equipe promoção')", [tenantId, teamId]);
    await admin.query("INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador')", [tenantId, subject]);
    await admin.query("INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$3)", [tenantId, teamId, subject]);

    await repository.criarOrcamento(contexto, { nome: local.nome, dados: local }, "promocao-29");
    await admin.query("BEGIN");
    await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [tenantId, subject, teamId]);
    await admin.query(`INSERT INTO app.repository_transitions
      (tenant_id,team_id,dominio_id,modo,ativado_por) VALUES($1,$2,'orcamentos','hibrido',$3)`, [tenantId, teamId, subject]);
    await admin.query("COMMIT");

    await assert.rejects(
      () => repository.alterarTransicaoRepositorio(contexto, "orcamentos", { modo: "corporativo" }, 1),
      (erro) => erro.code === "PARIDADE_NAO_COMPROVADA",
    );
    const manifesto = await criarManifestoLocalOrcamentos([local]);
    const verificada = await repository.verificarTransicaoRepositorio(contexto, "orcamentos", manifesto);
    assert.equal(verificada.verificacao.status, "conforme");
    assert.equal(verificada.verificacao.localTotal, 1);

    await assert.rejects(
      () => repository.alterarTransicaoRepositorio(contexto, "orcamentos", { modo: "corporativo" }, 1),
      (erro) => erro.code === "VERSAO_DIVERGENTE",
    );
    await assert.rejects(
      () => repository.alterarTransicaoRepositorio(
        contexto, "orcamentos", { modo: "corporativo", manifestoHash: "0".repeat(64) }, verificada.transicao.versao,
      ),
      (erro) => erro.code === "MANIFESTO_LOCAL_ALTERADO",
    );
    const promovida = await repository.alterarTransicaoRepositorio(
      contexto, "orcamentos", { modo: "corporativo", manifestoHash: manifesto.hash }, verificada.transicao.versao,
    );
    assert.equal(promovida.modo, "corporativo");
    await assert.rejects(
      () => repository.alterarTransicaoRepositorio(contexto, "orcamentos", { modo: "hibrido" }, promovida.versao),
      (erro) => erro.code === "JUSTIFICATIVA_OBRIGATORIA",
    );
    const retorno = await repository.alterarTransicaoRepositorio(
      contexto, "orcamentos", { modo: "hibrido", justificativa: "Retorno controlado para nova conferência." }, promovida.versao,
    );
    assert.equal(retorno.modo, "hibrido");
  } finally {
    await repository.fechar();
    if (admin._connected) {
      try {
        await admin.query("SELECT app.limpar_transicoes_tenant_teste($1)", [tenantId]);
        await admin.query("BEGIN");
        await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [tenantId, subject, teamId]);
        await admin.query("DELETE FROM app.orcamentos");
        await admin.query("DELETE FROM app.domain_events");
        await admin.query("DELETE FROM app.idempotency_keys");
        await admin.query("COMMIT");
        await admin.query("SELECT app.limpar_auditoria_tenant_teste($1)", [tenantId]);
        await admin.query("DELETE FROM app.team_memberships WHERE tenant_id=$1", [tenantId]);
        await admin.query("DELETE FROM app.memberships WHERE tenant_id=$1", [tenantId]);
        await admin.query("DELETE FROM app.teams WHERE tenant_id=$1", [tenantId]);
        await admin.query("DELETE FROM app.tenants WHERE id=$1", [tenantId]);
      } finally {
        await admin.query("ROLLBACK").catch(() => {});
        await admin.end();
      }
    }
  }
});
