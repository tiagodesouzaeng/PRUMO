import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import {
  criarArmazenamentoS3,
  criarArmazenamentoDesabilitado,
} from "../server/storage/objectStorage.js";

function headers() {
  return {
    "x-prumo-tenant-id": "EMP-1",
    "x-prumo-team-id": "EQ-1",
  };
}

test("storage S3 gera chaves segregadas e URLs temporárias", async () => {
  const comandos = [];
  const storage = criarArmazenamentoS3({
    region: "sa-east-1",
    bucket: "prumo-teste",
    client: {
      async send(command) { comandos.push(command); return {}; },
      destroy() {},
    },
    assinar: async (_client, command) => {
      comandos.push(command);
      return "https://storage.example.test/temporaria";
    },
  });
  assert.equal((await storage.health()).ok, true);
  const upload = await storage.criarUpload({
    tenantId: "EMP-1",
    documentoId: "DOC-1",
    nomeArquivo: "Projeto executivo ç.pdf",
    tipoMime: "application/pdf",
  });
  assert.match(upload.storageKey, /^EMP-1\/documentos\/DOC-1\//);
  assert.equal(upload.metodo, "PUT");
  assert.equal(upload.headers["Content-Type"], "application/pdf");
  const download = await storage.criarDownload({
    tenantId: "EMP-1",
    storageKey: upload.storageKey,
    nomeArquivo: "Projeto.pdf",
  });
  assert.match(download.url, /^https:\/\//);
  await assert.rejects(
    () => storage.criarDownload({ tenantId: "EMP-2", storageKey: upload.storageKey, nomeArquivo: "x.pdf" }),
    /não pertence/,
  );
  assert.ok(comandos.length >= 3);
});

test("GED autoriza upload e download somente dentro da organização", async (t) => {
  const repository = criarRepositorioMemoria({
    tenants: [
      { id: "EMP-1", nome: "Empresa 1", status: "ativo" },
      { id: "EMP-2", nome: "Empresa 2", status: "ativo" },
    ],
    memberships: [
      { tenantId: "EMP-1", subject: "USR-1", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" },
      { tenantId: "EMP-2", subject: "USR-2", perfilId: "administrador", teamIds: ["EQ-2"], status: "ativo" },
    ],
  });
  const storage = {
    tipo: "s3", configurado: true,
    async health() { return { ok: true, tipo: "s3" }; },
    async criarUpload({ tenantId, documentoId, nomeArquivo }) {
      return { metodo: "PUT", url: "https://storage.example.test/upload", storageKey: `${tenantId}/documentos/${documentoId}/${nomeArquivo}`, headers: {} };
    },
    async criarDownload() { return { url: "https://storage.example.test/download" }; },
    async fechar() {},
  };
  const app = await criarAplicacaoApi({
    repository,
    objectStorage: storage,
    storageRequired: true,
    authenticate: async (request) => ({ subject: request.headers["x-test-user"] || "USR-1" }),
  });
  t.after(() => app.close());
  const criado = await app.inject({
    method: "POST", url: "/v1/documentos",
    headers: { ...headers(), "idempotency-key": "doc-1" },
    payload: { titulo: "Projeto executivo" },
  });
  assert.equal(criado.statusCode, 201, criado.body);
  const id = criado.json().id;
  const upload = await app.inject({
    method: "POST", url: `/v1/documentos/${id}/uploads`, headers: headers(),
    payload: { nomeArquivo: "projeto.pdf", tipoMime: "application/pdf", tamanhoBytes: 100, sha256: "a".repeat(64) },
  });
  assert.equal(upload.statusCode, 200, upload.body);
  assert.match(upload.json().storageKey, /^EMP-1\/documentos\//);
  const registrada = await app.inject({
    method: "POST", url: `/v1/documentos/${id}/versoes`, headers: headers(),
    payload: { nomeArquivo: "projeto.pdf", tipoMime: "application/pdf", tamanhoBytes: 100, sha256: "a".repeat(64), storageKey: upload.json().storageKey },
  });
  assert.equal(registrada.statusCode, 200, registrada.body);
  const download = await app.inject({
    method: "GET", url: `/v1/documentos/${id}/versoes/1/download`, headers: headers(),
  });
  assert.equal(download.statusCode, 200, download.body);
  assert.match(download.json().url, /download/);

  const invasao = await app.inject({
    method: "POST", url: `/v1/documentos/${id}/uploads`,
    headers: { "x-test-user": "USR-2", "x-prumo-tenant-id": "EMP-2", "x-prumo-team-id": "EQ-2" },
    payload: { nomeArquivo: "x.pdf", tipoMime: "application/pdf", tamanhoBytes: 1, sha256: "b".repeat(64) },
  });
  assert.equal(invasao.statusCode, 404);
});

test("storage desabilitado nunca aceita arquivo", async () => {
  const storage = criarArmazenamentoDesabilitado();
  assert.equal((await storage.health()).ok, false);
  await assert.rejects(() => storage.criarUpload({}), /não foi configurado/);
});
