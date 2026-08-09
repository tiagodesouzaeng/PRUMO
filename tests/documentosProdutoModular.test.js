import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";

async function criarApi() {
  return criarAplicacaoApi({
    repository: criarRepositorioMemoria({
      tenants: [{ id: "EMP-1", nome: "Órgão público", status: "ativo" }],
      memberships: [{ tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
    }),
    authenticate: async () => ({ subject: "ADMIN" }),
  });
}

const headers = (idempotencyKey = "") => ({
  "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1",
  ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
});

test("GED cria documento e preserva versão com hash de integridade", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const criado = await app.inject({ method: "POST", url: "/v1/documentos", headers: headers("DOC-1"), payload: { titulo: "Projeto executivo" } });
  assert.equal(criado.statusCode, 201);
  const versao = await app.inject({ method: "POST", url: `/v1/documentos/${criado.json().id}/versoes`, headers: headers(), payload: { nomeArquivo: "projeto.pdf", tipoMime: "application/pdf", tamanhoBytes: 1234, sha256: "a".repeat(64), storageKey: "tenant/EMP-1/documentos/projeto.pdf" } });
  assert.equal(versao.statusCode, 200);
  assert.equal(versao.json().versaoAtual, 1);
  const lista = await app.inject({ method: "GET", url: "/v1/documentos", headers: headers() });
  assert.equal(lista.json()[0].versoes[0].sha256, "a".repeat(64));
});

test("integração usa referência de credencial e registra execução auditável", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const criada = await app.inject({ method: "POST", url: "/v1/integracoes", headers: headers("INT-1"), payload: { nome: "SINAPI", provedor: "Caixa", status: "ativa", credentialReference: "vault://prumo/sinapi" } });
  assert.equal(criada.statusCode, 201);
  assert.notEqual(criada.json().credentialReference, "vault://prumo/sinapi");
  const execucao = await app.inject({ method: "POST", url: `/v1/integracoes/${criada.json().id}/execucoes`, headers: headers(), payload: { status: "concluida", direcao: "entrada", contagens: { importados: 10 } } });
  assert.equal(execucao.json().status, "concluida");
});

test("produto modular separa catálogo, contrato e habilitação por organização", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const produto = await app.inject({ method: "GET", url: "/v1/produto-modular", headers: headers() });
  assert.equal(produto.statusCode, 200);
  assert.equal(produto.json().perfil.perfil, "publico");
  const alterado = await app.inject({ method: "PUT", url: "/v1/produto-modular/modulos/documentos", headers: headers(), payload: { habilitado: false } });
  assert.equal(alterado.json().habilitado, false);
  const modulos = await app.inject({ method: "GET", url: "/v1/modules", headers: headers() });
  assert.equal(modulos.json().some((item) => item.id === "documentos"), false);
  const documentos = await app.inject({ method: "GET", url: "/v1/documentos", headers: headers() });
  assert.equal(documentos.statusCode, 403);
  assert.equal(documentos.json().erro.codigo, "MODULO_NAO_HABILITADO");
});
