import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { criarPacoteMigracao } from "../src/services/migracaoCorporativa.js";

async function criarApiTeste() {
  const repository = criarRepositorioMemoria({
    tenants: [
      { id: "EMP-1", nome: "Empresa 1", status: "ativo" },
      { id: "EMP-2", nome: "Empresa 2", status: "ativo" },
    ],
    memberships: [
      {
        tenantId: "EMP-1",
        subject: "USR-1",
        perfilId: "gestor",
        teamIds: ["EQ-A", "EQ-B"],
        status: "ativo",
      },
      {
        tenantId: "EMP-2",
        subject: "USR-2",
        perfilId: "consulta",
        teamIds: ["EQ-C"],
        status: "ativo",
      },
      {
        tenantId: "EMP-1",
        subject: "USR-3",
        perfilId: "fiscal",
        teamIds: ["EQ-A"],
        status: "ativo",
      },
      {
        tenantId: "EMP-1",
        subject: "USR-4",
        perfilId: "administrador",
        teamIds: ["EQ-A"],
        status: "ativo",
      },
    ],
  });
  return criarAplicacaoApi({
    repository,
    authenticate: async (request) => ({
      subject: request.headers["x-test-user"] || "USR-1",
    }),
    corsOrigins: ["http://127.0.0.1:4173"],
  });
}

function headers({
  user = "USR-1",
  tenant = "EMP-1",
  team = "EQ-A",
  extras = {},
} = {}) {
  return {
    "x-test-user": user,
    "x-prumo-tenant-id": tenant,
    "x-prumo-team-id": team,
    ...extras,
  };
}

test("API informa saúde sem exigir autenticação ou empresa", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const resposta = await app.inject({ method: "GET", url: "/health" });
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.json().armazenamento, "memory");
  assert.equal(resposta.json().versao, "10.6.0");
});

test("API valida vínculo de empresa e equipe antes de consultar dados", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());

  const semEmpresa = await app.inject({
    method: "GET",
    url: "/v1/context",
    headers: { "x-test-user": "USR-1" },
  });
  assert.equal(semEmpresa.statusCode, 400);
  assert.equal(semEmpresa.json().erro.codigo, "EMPRESA_AUSENTE");

  const outraEmpresa = await app.inject({
    method: "GET",
    url: "/v1/context",
    headers: headers({ tenant: "EMP-2" }),
  });
  assert.equal(outraEmpresa.statusCode, 403);
  assert.equal(outraEmpresa.json().erro.codigo, "EMPRESA_NAO_AUTORIZADA");

  const outraEquipe = await app.inject({
    method: "GET",
    url: "/v1/context",
    headers: headers({ team: "EQ-C" }),
  });
  assert.equal(outraEquipe.statusCode, 403);
  assert.equal(outraEquipe.json().erro.codigo, "EQUIPE_NAO_AUTORIZADA");
});

test("criação é idempotente e o orçamento fica isolado por equipe", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const requisicao = {
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers({ extras: { "idempotency-key": "CRIAR-1" } }),
    payload: { nome: "Obra teste", dados: { total: 100 } },
  };
  const primeira = await app.inject(requisicao);
  const repetida = await app.inject(requisicao);
  assert.equal(primeira.statusCode, 201);
  assert.equal(repetida.statusCode, 201);
  assert.equal(primeira.json().id, repetida.json().id);

  const equipeA = await app.inject({
    method: "GET",
    url: "/v1/orcamentos",
    headers: headers({ team: "EQ-A" }),
  });
  const equipeB = await app.inject({
    method: "GET",
    url: "/v1/orcamentos",
    headers: headers({ team: "EQ-B" }),
  });
  assert.equal(equipeA.json().length, 1);
  assert.equal(equipeB.json().length, 0);
});

test("alteração exige versão e rejeita sobrescrita concorrente", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const criado = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers({ extras: { "idempotency-key": "CRIAR-2" } }),
    payload: { nome: "Obra teste", dados: {} },
  });
  const id = criado.json().id;

  const semVersao = await app.inject({
    method: "PUT",
    url: `/v1/orcamentos/${id}`,
    headers: headers(),
    payload: { nome: "Alterado", dados: {} },
  });
  assert.equal(semVersao.statusCode, 428);

  const atualizado = await app.inject({
    method: "PUT",
    url: `/v1/orcamentos/${id}`,
    headers: headers({ extras: { "if-match": "1" } }),
    payload: { nome: "Alterado", dados: { total: 200 } },
  });
  assert.equal(atualizado.statusCode, 200);
  assert.equal(atualizado.json().versao, 2);
  assert.equal(atualizado.headers.etag, '"2"');

  const concorrente = await app.inject({
    method: "PUT",
    url: `/v1/orcamentos/${id}`,
    headers: headers({ extras: { "if-match": "1" } }),
    payload: { nome: "Sobrescrever", dados: {} },
  });
  assert.equal(concorrente.statusCode, 412);
  assert.equal(concorrente.json().erro.codigo, "VERSAO_DIVERGENTE");
});

test("API recusa criação sem chave de idempotência", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const resposta = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers(),
    payload: { nome: "Obra teste", dados: {} },
  });
  assert.equal(resposta.statusCode, 428);
  assert.equal(resposta.json().erro.codigo, "IDEMPOTENCIA_AUSENTE");
});

test("contexto retorna somente módulos permitidos pelo perfil", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const gestor = await app.inject({
    method: "GET",
    url: "/v1/modules",
    headers: headers(),
  });
  const fiscal = await app.inject({
    method: "GET",
    url: "/v1/modules",
    headers: headers({ user: "USR-3" }),
  });
  assert.equal(gestor.statusCode, 200);
  assert.equal(gestor.json().some((item) => item.id === "orcamentos"), true);
  assert.equal(gestor.json().some((item) => item.id === "medicoes"), true);
  assert.equal(fiscal.json().some((item) => item.id === "medicoes"), true);
  assert.equal(fiscal.json().some((item) => item.id === "bases-precos"), false);
});

test("empreendimento compartilhado nasce no módulo Obras e respeita a equipe", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const criado = await app.inject({
    method: "POST",
    url: "/v1/empreendimentos",
    headers: headers({ extras: { "idempotency-key": "EMPREE-1" } }),
    payload: { codigo: "OBRA-1", nome: "Nova edificação", tipo: "obra" },
  });
  assert.equal(criado.statusCode, 201);
  assert.equal(criado.json().teamId, "EQ-A");

  const outraEquipe = await app.inject({
    method: "GET",
    url: "/v1/empreendimentos",
    headers: headers({ team: "EQ-B" }),
  });
  assert.equal(outraEquipe.json().length, 0);
});

test("revisão e medição possuem persistência idempotente vinculada ao orçamento", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const orcamento = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers({ extras: { "idempotency-key": "ORC-INTEGRADO" } }),
    payload: { nome: "Obra integrada", dados: {} },
  });
  const orcamentoId = orcamento.json().id;

  const revisao = await app.inject({
    method: "POST",
    url: `/v1/orcamentos/${orcamentoId}/revisoes`,
    headers: headers({ extras: { "idempotency-key": "REV-1" } }),
    payload: {
      numero: 1,
      tipo: "aditivo",
      impactoValor: 15000,
      impactoPrazoDias: 30,
      dados: {},
    },
  });
  assert.equal(revisao.statusCode, 201);
  assert.equal(revisao.json().tipo, "aditivo");

  const medicaoRequest = {
    method: "POST",
    url: `/v1/orcamentos/${orcamentoId}/medicoes`,
    headers: headers({
      user: "USR-3",
      extras: { "idempotency-key": "MED-1" },
    }),
    payload: {
      revisaoId: revisao.json().id,
      numero: 1,
      valorBruto: 10000,
      retencoes: 500,
      multas: 250,
      dados: {},
    },
  };
  const medicao = await app.inject(medicaoRequest);
  const repetida = await app.inject(medicaoRequest);
  assert.equal(medicao.statusCode, 201);
  assert.equal(medicao.json().valorLiquido, 9250);
  assert.equal(medicao.json().id, repetida.json().id);

  const listagem = await app.inject({
    method: "GET",
    url: `/v1/orcamentos/${orcamentoId}/medicoes`,
    headers: headers({ user: "USR-3" }),
  });
  assert.equal(listagem.json().length, 1);
});

test("perfil sem permissão de edição não cria orçamento", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const resposta = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers({
      user: "USR-3",
      extras: { "idempotency-key": "NEGADO-1" },
    }),
    payload: { nome: "Não autorizado", dados: {} },
  });
  assert.equal(resposta.statusCode, 403);
  assert.equal(resposta.json().erro.codigo, "PERMISSAO_NEGADA");
});

test("medição rejeita retenções e multas superiores ao valor bruto", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const orcamento = await app.inject({
    method: "POST",
    url: "/v1/orcamentos",
    headers: headers({ extras: { "idempotency-key": "ORC-DEDUCOES" } }),
    payload: { nome: "Obra com deduções", dados: {} },
  });
  const resposta = await app.inject({
    method: "POST",
    url: `/v1/orcamentos/${orcamento.json().id}/medicoes`,
    headers: headers({
      user: "USR-3",
      extras: { "idempotency-key": "MED-DEDUCOES" },
    }),
    payload: {
      numero: 1,
      valorBruto: 1000,
      retencoes: 800,
      multas: 300,
      dados: {},
    },
  });
  assert.equal(resposta.statusCode, 422);
  assert.equal(resposta.json().erro.codigo, "DEDUCOES_SUPERIORES_AO_BRUTO");
});

test("catálogo corporativo pagina itens, escolhe UF e abre composição analítica", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const cabecalhos = headers({
    user: "USR-4",
    extras: { "idempotency-key": "PUB-1" },
  });
  const publicacao = await app.inject({
    method: "POST",
    url: "/v1/catalogo/publicacoes",
    headers: cabecalhos,
    payload: {
      sourceId: "SINAPI",
      fonte: "SINAPI",
      referencia: "06/2026",
      regime: "NAO_DESONERADO",
    },
  });
  assert.equal(publicacao.statusCode, 201);
  const id = publicacao.json().id;
  const carga = await app.inject({
    method: "POST",
    url: `/v1/catalogo/publicacoes/${id}/itens`,
    headers: headers({
      user: "USR-4",
      extras: { "idempotency-key": "ITENS-1" },
    }),
    payload: {
      itens: [
        {
          tipo: "insumo",
          codigo: "I-1",
          descricao: "Cimento",
          unidade: "kg",
          precosPorUf: { RS: 1.5, SP: 1.4 },
        },
        {
          tipo: "composicao",
          codigo: "C-1",
          descricao: "Serviço",
          unidade: "m²",
          precosPorUf: { RS: 12 },
          componentes: [{
            referenciaTipo: "insumo",
            referenciaCodigo: "I-1",
            coeficiente: 2,
          }],
        },
      ],
    },
  });
  assert.equal(carga.statusCode, 201);
  assert.equal(carga.json().total, 2);

  const itens = await app.inject({
    method: "GET",
    url: `/v1/catalogo/publicacoes/${id}/itens?limite=1&uf=RS`,
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(itens.statusCode, 200);
  assert.equal(itens.json().total, 2);
  assert.equal(itens.json().itens.length, 1);

  const componentes = await app.inject({
    method: "GET",
    url: `/v1/catalogo/publicacoes/${id}/composicoes/C-1/componentes?uf=RS`,
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(componentes.statusCode, 200);
  assert.equal(componentes.json()[0].referenciaCodigo, "I-1");
});

test("lote de migração é recebido, validado e homologado sem duplicação", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const contexto = {
    tenantId: "EMP-1",
    teamId: "EQ-A",
    usuarioId: "USR-4",
  };
  const pacote = await criarPacoteMigracao({
    contexto,
    usuarioId: "USR-4",
    criadoEm: "2026-07-30T15:00:00.000Z",
    dados: {
      orcamentos: [{ id: "ORC-LOCAL", nome: "Orçamento local" }],
      composicoesProprias: [{
        id: "CPU-LOCAL",
        codigo: "CPU-1",
        descricao: "Composição própria",
        unidade: "un",
      }],
    },
  });
  const requisicao = {
    method: "POST",
    url: "/v1/migracoes",
    headers: headers({
      user: "USR-4",
      extras: { "idempotency-key": pacote.idempotencyKey },
    }),
    payload: pacote,
  };
  const recebido = await app.inject(requisicao);
  const repetido = await app.inject(requisicao);
  assert.equal(recebido.statusCode, 201);
  assert.equal(recebido.json().id, repetido.json().id);

  const validado = await app.inject({
    method: "POST",
    url: `/v1/migracoes/${recebido.json().id}/validacao`,
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(validado.json().status, "validado");

  const homologado = await app.inject({
    method: "POST",
    url: `/v1/migracoes/${recebido.json().id}/homologacao`,
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(homologado.json().status, "homologado");

  const orcamentos = await app.inject({
    method: "GET",
    url: "/v1/orcamentos",
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(orcamentos.json().some((item) => item.nome === "Orçamento local"), true);

  const transicoes = await app.inject({
    method: "GET",
    url: "/v1/repositorios/transicoes",
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(
    transicoes.json().some((item) => (
      item.dominioId === "orcamentos" && item.modo === "hibrido"
    )),
    true,
  );

  const corporativo = await app.inject({
    method: "PUT",
    url: "/v1/repositorios/transicoes/orcamentos",
    headers: headers({ user: "USR-4" }),
    payload: { modo: "corporativo" },
  });
  assert.equal(corporativo.statusCode, 200);
  assert.equal(corporativo.json().modo, "corporativo");
});

test("fila executa trabalho assíncrono e registra conclusão", async (t) => {
  const app = await criarApiTeste();
  t.after(() => app.close());
  const criado = await app.inject({
    method: "POST",
    url: "/v1/trabalhos",
    headers: headers({
      user: "USR-4",
      extras: { "idempotency-key": "TRABALHO-DIAGNOSTICO-1" },
    }),
    payload: {
      tipo: "sistema.diagnostico",
      payload: { origem: "teste" },
    },
  });
  assert.equal(criado.statusCode, 202);
  assert.equal(criado.json().status, "pendente");

  await new Promise((resolve) => setTimeout(resolve, 20));
  const fila = await app.inject({
    method: "GET",
    url: "/v1/trabalhos",
    headers: headers({ user: "USR-4" }),
  });
  assert.equal(fila.statusCode, 200);
  const trabalho = fila.json().find((item) => item.id === criado.json().id);
  assert.equal(trabalho.status, "concluido");
  assert.equal(trabalho.progresso, 100);
  assert.equal(trabalho.resultado.ok, true);
});
