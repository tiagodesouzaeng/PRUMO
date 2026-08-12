import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";
import {
  ITENS_PRONTIDAO_PILOTO,
  atualizarItemPiloto,
  avaliarEstadoPiloto,
  criarEstadoPiloto,
  decidirPiloto,
} from "../server/domain/pilot.js";

function contexto() {
  return { tenantId: "EMP-1", teamId: "EQ-1", usuarioId: "USR-1" };
}

function headers() {
  return { "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1" };
}

test("checklist separa ambiente corporativo e piloto sem liberar promoção antecipada", () => {
  let estado = criarEstadoPiloto(contexto());
  assert.equal(estado.itens.length, 16);
  assert.equal(avaliarEstadoPiloto(estado).podeIniciarPiloto, false);
  for (const item of estado.itens.filter((registro) => registro.sprint === 24)) {
    estado = atualizarItemPiloto(estado, item.id, { status: "aprovado", evidencia: `evidencia:${item.id}` }, contexto());
  }
  assert.equal(avaliarEstadoPiloto(estado).podeIniciarPiloto, true);
  assert.equal(avaliarEstadoPiloto(estado).podePromover, false);
  estado = decidirPiloto(estado, { acao: "iniciar", justificativa: "Ambiente corporativo verificado" }, contexto());
  assert.equal(estado.status, "em_execucao");
  assert.throws(
    () => decidirPiloto(estado, { acao: "aprovar", justificativa: "Aceite prematuro" }, contexto()),
    /todos os requisitos/,
  );
});

test("API registra evidências, bloqueia início incompleto e audita a decisão", async (t) => {
  const repository = criarRepositorioMemoria({
    tenants: [{ id: "EMP-1", nome: "Empresa 1", status: "ativo" }],
    memberships: [{ tenantId: "EMP-1", subject: "USR-1", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
  });
  const app = await criarAplicacaoApi({
    repository,
    authenticate: async () => ({ subject: "USR-1" }),
  });
  t.after(() => app.close());

  const inicial = await app.inject({ method: "GET", url: "/v1/operacao/piloto", headers: headers() });
  assert.equal(inicial.statusCode, 200, inicial.body);
  assert.equal(inicial.json().avaliacao.progresso, 0);

  const bloqueado = await app.inject({ method: "POST", url: "/v1/operacao/piloto/decisoes", headers: headers(), payload: { acao: "iniciar", justificativa: "Tentativa antes das evidências" } });
  assert.equal(bloqueado.statusCode, 409, bloqueado.body);

  for (const item of ITENS_PRONTIDAO_PILOTO.filter((registro) => registro.sprint === 24)) {
    const resposta = await app.inject({
      method: "PUT",
      url: `/v1/operacao/piloto/requisitos/${item.id}`,
      headers: headers(),
      payload: { status: "aprovado", evidencia: `teste automatizado ${item.id}` },
    });
    assert.equal(resposta.statusCode, 200, resposta.body);
  }

  const iniciado = await app.inject({ method: "POST", url: "/v1/operacao/piloto/decisoes", headers: headers(), payload: { acao: "iniciar", justificativa: "Requisitos da infraestrutura aprovados" } });
  assert.equal(iniciado.statusCode, 200, iniciado.body);
  assert.equal(iniciado.json().status, "em_execucao");

  const auditoria = await app.inject({ method: "GET", url: "/v1/auditoria?action=piloto.iniciar", headers: headers() });
  assert.equal(auditoria.statusCode, 200, auditoria.body);
  assert.equal(auditoria.json().total, 1);
});

test("readiness exige identidade OIDC quando configurada como obrigatória", async (t) => {
  const app = await criarAplicacaoApi({
    repository: criarRepositorioMemoria(),
    authenticate: async () => ({ subject: "dev-user" }),
    identityRequired: true,
    identityMode: "nao_configurado",
  });
  t.after(() => app.close());
  const resposta = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(resposta.statusCode, 503);
  assert.equal(resposta.json().componentes.identidade.ok, false);
});

test("PostgreSQL persiste o piloto por organização e mantém a trilha auditável", {
  skip: !(process.env.PRUMO_DATABASE_URL && process.env.PRUMO_MIGRATION_DATABASE_URL)
    && "Conexões PostgreSQL de integração não configuradas.",
}, async () => {
  const tenantId = randomUUID();
  const teamId = randomUUID();
  const subject = `piloto-${randomUUID().slice(0, 8)}`;
  const admin = new pg.Client({ connectionString: process.env.PRUMO_MIGRATION_DATABASE_URL });
  const repository = criarRepositorioPostgres({ connectionString: process.env.PRUMO_DATABASE_URL });
  const ctx = { identity: { subject }, tenantId, teamId };
  try {
    await admin.connect();
    await admin.query("INSERT INTO app.tenants(id,nome) VALUES($1,'Teste Piloto')", [tenantId]);
    await admin.query("INSERT INTO app.teams(tenant_id,id,nome) VALUES($1,$2,'Equipe Piloto')", [tenantId, teamId]);
    await admin.query("INSERT INTO app.memberships(tenant_id,identity_subject,perfil_id) VALUES($1,$2,'administrador')", [tenantId, subject]);
    await admin.query("INSERT INTO app.team_memberships(tenant_id,team_id,identity_subject) VALUES($1,$2,$3)", [tenantId, teamId, subject]);
    const inicial = await repository.obterEstadoPiloto(ctx);
    assert.equal(inicial.avaliacao.progresso, 0);
    const salvo = await repository.atualizarItemPiloto(ctx, "api-https", { status: "aprovado", evidencia: "GET /ready em HTTPS" });
    assert.equal(salvo.itens.find((item) => item.id === "api-https").status, "aprovado");
    const recarregado = await repository.obterEstadoPiloto(ctx);
    assert.equal(recarregado.avaliacao.aprovados, 1);
  } finally {
    await repository.fechar();
    if (admin._connected) {
      try {
        await admin.query("BEGIN");
        await admin.query("SELECT app.ativar_contexto($1,$2,$3)", [tenantId, subject, teamId]);
        await admin.query("DELETE FROM app.tenant_settings WHERE tenant_id=$1", [tenantId]);
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
