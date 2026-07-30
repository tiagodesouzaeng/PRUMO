import test from "node:test";
import assert from "node:assert/strict";
import {
  criarClientePrumo,
  diagnosticarInfraestrutura,
  obterConfiguracaoInfraestrutura,
  verificarInfraestrutura,
} from "../src/services/infraestruturaCorporativa.js";

test("mantém o PRUMO em modo local quando a API não está configurada", async () => {
  const configuracao = obterConfiguracaoInfraestrutura({});
  assert.equal(configuracao.modo, "local");
  assert.equal(configuracao.apiConfigurada, false);
  assert.match((await verificarInfraestrutura(configuracao)).mensagem, /Modo local/);
});

test("reconhece a configuração corporativa sem barras finais", () => {
  const configuracao = obterConfiguracaoInfraestrutura({
    VITE_PRUMO_API_URL: "https://api.prumo.test///",
    VITE_PRUMO_AUTH_URL: "https://auth.prumo.test/",
  });
  assert.equal(configuracao.modo, "corporativo");
  assert.equal(configuracao.apiUrl, "https://api.prumo.test");
  assert.equal(configuracao.autenticacaoUrl, "https://auth.prumo.test");
  assert.equal(diagnosticarInfraestrutura(configuracao).length, 6);
});

test("cliente corporativo consulta a rota de saúde", async () => {
  const chamadas = [];
  const cliente = criarClientePrumo({
    baseUrl: "https://api.prumo.test/",
    fetchImpl: async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      return {
        ok: true,
        status: 200,
        json: async () => ({ mensagem: "operacional" }),
      };
    },
  });

  assert.deepEqual(await cliente.verificarSaude(), { mensagem: "operacional" });
  assert.equal(chamadas[0].url, "https://api.prumo.test/health");
  assert.equal(chamadas[0].opcoes.headers.Accept, "application/json");
});

test("cliente corporativo expõe falha HTTP de forma compreensível", async () => {
  const cliente = criarClientePrumo({
    baseUrl: "https://api.prumo.test",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  await assert.rejects(cliente.verificarSaude(), /código 503/);
});

test("cliente corporativo envia contexto, idempotência e versão sem confiar no frontend", async () => {
  const chamadas = [];
  const cliente = criarClientePrumo({
    baseUrl: "https://api.prumo.test",
    obterContexto: () => ({
      tenantId: "EMP-1",
      teamId: "EQ-1",
      accessToken: "token-em-memoria",
    }),
    fetchImpl: async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      return { ok: true, status: 200, json: async () => ({ id: "ORC-1" }) };
    },
  });

  await cliente.criar("orcamentos", { nome: "Obra" }, "chave-1");
  await cliente.atualizar("orcamentos", "ORC-1", { nome: "Obra 2" }, 7);

  assert.equal(chamadas[0].opcoes.headers["X-Prumo-Tenant-Id"], "EMP-1");
  assert.equal(chamadas[0].opcoes.headers["X-Prumo-Team-Id"], "EQ-1");
  assert.equal(chamadas[0].opcoes.headers.Authorization, "Bearer token-em-memoria");
  assert.equal(chamadas[0].opcoes.headers["Idempotency-Key"], "chave-1");
  assert.equal(chamadas[0].url, "https://api.prumo.test/v1/orcamentos");
  assert.equal(chamadas[1].opcoes.headers["If-Match"], "7");
});

test("cliente bloqueia recurso corporativo sem empresa ativa e reconhece conflito", async () => {
  const semEmpresa = criarClientePrumo({
    baseUrl: "https://api.prumo.test",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] }),
  });
  await assert.rejects(semEmpresa.listar("orcamentos"), /Selecione uma empresa/);

  const concorrente = criarClientePrumo({
    baseUrl: "https://api.prumo.test",
    obterContexto: () => ({ tenantId: "EMP-1" }),
    fetchImpl: async () => ({ ok: false, status: 412 }),
  });
  await assert.rejects(
    concorrente.atualizar("orcamentos", "ORC-1", {}, 2),
    /alterado por outro usuário/,
  );
});
