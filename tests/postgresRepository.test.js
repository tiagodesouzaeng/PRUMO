import test from "node:test";
import assert from "node:assert/strict";
import { criarRepositorioPostgres } from "../server/db/postgresRepository.js";

function criarPoolFake(responder) {
  const consultas = [];
  const cliente = {
    async query(sql, parametros) {
      consultas.push({ sql: String(sql), parametros });
      return responder(String(sql), parametros, consultas);
    },
    release() {
      consultas.push({ sql: "RELEASE" });
    },
  };
  return {
    consultas,
    pool: {
      connect: async () => cliente,
      query: async (sql) => responder(String(sql), [], consultas),
      end: async () => {},
    },
  };
}

test("PostgreSQL ativa o contexto validado antes de consultar orçamentos", async () => {
  const fake = criarPoolFake((sql) => {
    if (sql.includes("app.ativar_contexto")) {
      return { rows: [{ tenant_nome: "Empresa", perfil_id: "gestor" }] };
    }
    if (sql.includes("default_profile_permissions")) {
      return { rows: [{ permission_id: "orcamento.consultar", permitido: true }] };
    }
    if (sql.includes("FROM app.modules")) {
      return { rows: [{ id: "orcamentos", nome: "Orçamentos", ordem: 30 }] };
    }
    if (sql.includes("FROM app.orcamentos")) {
      return {
        rows: [{
          tenant_id: "EMP-1",
          id: "ORC-1",
          team_id: "EQ-1",
          nome: "Obra",
          versao: "3",
          dados: {},
          criado_por: "USR-1",
          criado_em: "2026-07-30T10:00:00.000Z",
          atualizado_em: "2026-07-30T11:00:00.000Z",
        }],
      };
    }
    return { rows: [] };
  });
  const repository = criarRepositorioPostgres({ pool: fake.pool });
  const itens = await repository.listarOrcamentos({
    tenantId: "EMP-1",
    teamId: "EQ-1",
    identity: { subject: "USR-1" },
  });
  assert.equal(itens[0].versao, 3);
  assert.equal(fake.consultas[0].sql, "BEGIN");
  assert.match(fake.consultas[1].sql, /app\.ativar_contexto/);
  assert.match(fake.consultas[2].sql, /default_profile_permissions/);
  assert.match(fake.consultas[3].sql, /FROM app\.modules/);
  assert.match(fake.consultas[4].sql, /FROM app\.orcamentos/);
  assert.equal(fake.consultas[5].sql, "COMMIT");
});

test("PostgreSQL desfaz a transação quando o vínculo é recusado", async () => {
  const fake = criarPoolFake((sql) => {
    if (sql.includes("app.ativar_contexto")) {
      const error = new Error("negado");
      error.code = "42501";
      throw error;
    }
    return { rows: [] };
  });
  const repository = criarRepositorioPostgres({ pool: fake.pool });
  await assert.rejects(
    repository.validarContexto({
      tenantId: "EMP-2",
      identity: { subject: "USR-1" },
    }),
    (error) => error.statusCode === 403 && error.code === "EMPRESA_NAO_AUTORIZADA",
  );
  assert.equal(fake.consultas.at(-2).sql, "ROLLBACK");
  assert.equal(fake.consultas.at(-1).sql, "RELEASE");
});
