import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import {
  criarHashAuditoria,
  exportarAuditoriaCsv,
  sanitizarDadosAuditoria,
} from "../server/domain/audit.js";

const memberships = [
  {
    tenantId: "EMP-1",
    subject: "ADMIN",
    perfilId: "administrador",
    teamIds: ["EQ-1"],
    status: "ativo",
  },
  {
    tenantId: "EMP-1",
    subject: "CONSULTA",
    perfilId: "consulta",
    teamIds: ["EQ-1"],
    status: "ativo",
  },
];

async function criarApi() {
  const repository = criarRepositorioMemoria({
    tenants: [{ id: "EMP-1", nome: "Empresa", status: "ativo" }],
    memberships,
  });
  return criarAplicacaoApi({
    repository,
    authenticate: async (request) => ({ subject: request.headers["x-test-user"] || "ADMIN" }),
  });
}

function headers(user = "ADMIN", extras = {}) {
  return {
    "x-test-user": user,
    "x-prumo-tenant-id": "EMP-1",
    "x-prumo-team-id": "EQ-1",
    ...extras,
  };
}

test("auditoria protege segredos e produz hash determinístico", () => {
  const dados = sanitizarDadosAuditoria({
    nome: "Orçamento",
    token: "segredo",
    credencial_api: "não registrar",
    interno: { senha: "123", valor: 50 },
  });
  assert.equal(dados.token, "[PROTEGIDO]");
  assert.equal(dados.credencial_api, "[PROTEGIDO]");
  assert.equal(dados.interno.senha, "[PROTEGIDO]");
  const evento = {
    tenantId: "EMP-1",
    moduleId: "orcamentos",
    action: "orcamento.criado",
    entityType: "orcamento",
    entityId: "1",
    actorId: "ADMIN",
    after: dados,
    createdAt: "2026-08-08T12:00:00.000Z",
  };
  assert.equal(criarHashAuditoria(evento), criarHashAuditoria({ ...evento }));
});

test("API registra antes e depois, filtra e exporta a trilha", async (t) => {
  const app = await criarApi();
  t.after(() => app.close());
  const criado = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers("ADMIN", { "idempotency-key": "AUD-1" }),
    payload: { nome: "Orçamento auditado", dados: { token: "oculto", total: 100 } },
  });
  assert.equal(criado.statusCode, 201);
  const atualizado = await app.inject({
    method: "PUT",
    url: `/v1/orcamentos/${criado.json().id}`,
    headers: headers("ADMIN", { "if-match": "1" }),
    payload: { nome: "Orçamento atualizado", dados: { total: 200 } },
  });
  assert.equal(atualizado.statusCode, 200);

  const consulta = await app.inject({
    method: "GET",
    url: "/v1/auditoria?moduleId=orcamentos&limite=20",
    headers: headers(),
  });
  assert.equal(consulta.statusCode, 200);
  assert.equal(consulta.json().total, 2);
  assert.equal(consulta.json().integridade.ok, true);
  const criacao = consulta.json().itens.find((item) => item.acao === "orcamento.criado");
  const alteracao = consulta.json().itens.find((item) => item.acao === "orcamento.atualizado");
  assert.equal(criacao.depois.dados.token, "[PROTEGIDO]");
  assert.equal(alteracao.antes.nome, "Orçamento auditado");
  assert.equal(alteracao.depois.nome, "Orçamento atualizado");

  const exportacao = await app.inject({
    method: "GET",
    url: "/v1/auditoria/exportacao.csv?moduleId=orcamentos",
    headers: headers(),
  });
  assert.equal(exportacao.statusCode, 200);
  assert.match(exportacao.headers["content-type"], /text\/csv/);
  assert.match(exportacao.body, /orcamento\.atualizado/);
});

test("política de retenção exige administração e registra sua alteração", async (t) => {
  const app = await criarApi();
  t.after(() => app.close());
  const negada = await app.inject({
    method: "PUT",
    url: "/v1/auditoria/politica",
    headers: headers("CONSULTA"),
    payload: { retencaoDias: 3650, frequenciaBackup: "semanal" },
  });
  assert.equal(negada.statusCode, 403);

  const atualizada = await app.inject({
    method: "PUT",
    url: "/v1/auditoria/politica",
    headers: headers(),
    payload: { retencaoDias: 3650, frequenciaBackup: "semanal" },
  });
  assert.equal(atualizada.statusCode, 200);
  assert.equal(atualizada.json().retencaoDias, 3650);

  const recuperacaoEm = "2026-08-09T12:43:20.000Z";
  const recuperacao = await app.inject({
    method: "PUT",
    url: "/v1/auditoria/politica",
    headers: headers(),
    payload: {
      retencaoDias: 3650,
      frequenciaBackup: "semanal",
      ultimoBackupEm: recuperacaoEm,
      ultimoBackupHash: "a".repeat(64),
      ultimoTesteRestauracaoEm: recuperacaoEm,
      ultimoTesteRestauracaoOk: true,
    },
  });
  assert.equal(recuperacao.statusCode, 200);
  assert.equal(recuperacao.json().ultimoBackupHash, "a".repeat(64));
  assert.equal(recuperacao.json().ultimoTesteRestauracaoOk, true);

  const eventos = await app.inject({
    method: "GET",
    url: "/v1/auditoria?action=politica-atualizada",
    headers: headers(),
  });
  assert.equal(eventos.json().total, 1);

  const recuperacoes = await app.inject({
    method: "GET",
    url: "/v1/auditoria?action=recuperacao-registrada",
    headers: headers(),
  });
  assert.equal(recuperacoes.json().total, 1);
});

test("exportação CSV preserva colunas e escapa conteúdo", () => {
  const csv = exportarAuditoriaCsv([{
    sequencia: 1,
    criadoEm: "2026-08-08T12:00:00.000Z",
    moduleId: "administracao",
    acao: "teste",
    entidadeTipo: "registro",
    entidadeId: "1",
    usuarioId: "ADMIN",
    resultado: "sucesso",
    antes: null,
    depois: { descricao: "valor; com separador" },
    hashAnterior: "0".repeat(64),
    hash: "a".repeat(64),
  }]);
  assert.match(csv, /"sequencia";"data"/);
  assert.match(csv, /valor; com separador/);
});
