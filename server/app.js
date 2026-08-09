import Fastify from "fastify";
import cors from "@fastify/cors";
import { ApiError, asApiError } from "./errors.js";
import { criarWorkerTrabalhos } from "./workers/jobWorker.js";
import { exportarAuditoriaCsv } from "./domain/audit.js";

const esquemaOrcamento = {
  type: "object",
  required: ["nome", "dados"],
  additionalProperties: false,
  properties: {
    nome: { type: "string", minLength: 2, maxLength: 240 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaEmpreendimento = {
  type: "object",
  required: ["nome"],
  additionalProperties: false,
  properties: {
    unidadeId: { type: "string" },
    codigo: { type: "string", maxLength: 80 },
    nome: { type: "string", minLength: 2, maxLength: 240 },
    tipo: { type: "string", maxLength: 60 },
    status: { type: "string", maxLength: 60 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaRevisao = {
  type: "object",
  required: ["numero", "tipo", "dados"],
  additionalProperties: false,
  properties: {
    numero: { type: "integer", minimum: 1 },
    tipo: { enum: ["original", "revisao", "aditivo", "supressao"] },
    status: { type: "string", maxLength: 60 },
    impactoValor: { type: "number" },
    impactoPrazoDias: { type: "integer" },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaMedicao = {
  type: "object",
  required: ["numero", "valorBruto", "dados"],
  additionalProperties: false,
  properties: {
    revisaoId: { type: "string" },
    numero: { type: "integer", minimum: 1 },
    status: { type: "string", maxLength: 60 },
    periodoInicio: { type: "string", format: "date" },
    periodoFim: { type: "string", format: "date" },
    valorBruto: { type: "number", minimum: 0 },
    retencoes: { type: "number", minimum: 0 },
    multas: { type: "number", minimum: 0 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaPublicacaoCatalogo = {
  type: "object",
  required: ["sourceId", "fonte", "referencia"],
  additionalProperties: false,
  properties: {
    sourceId: { type: "string", minLength: 1, maxLength: 160 },
    fonte: { type: "string", minLength: 1, maxLength: 160 },
    gestor: { type: "string", maxLength: 240 },
    referencia: { type: "string", minLength: 1, maxLength: 40 },
    regime: { type: "string", maxLength: 80 },
    hashFonte: { type: "string", maxLength: 128 },
    arquivoNome: { type: "string", maxLength: 500 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaItensCatalogo = {
  type: "object",
  required: ["itens"],
  additionalProperties: false,
  properties: {
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 1000,
      items: { type: "object", additionalProperties: true },
    },
  },
};

const esquemaPacoteMigracao = {
  type: "object",
  required: [
    "contrato",
    "tenantId",
    "usuarioId",
    "criadoEm",
    "dominios",
    "hash",
    "idempotencyKey",
  ],
  additionalProperties: false,
  properties: {
    contrato: { type: "integer", minimum: 1 },
    tenantId: { type: "string", minLength: 1 },
    teamId: { type: "string" },
    usuarioId: { type: "string", minLength: 1 },
    criadoEm: { type: "string" },
    dominios: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "total", "registros"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          total: { type: "integer", minimum: 0 },
          registros: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    hash: { type: "string", minLength: 64, maxLength: 64 },
    idempotencyKey: { type: "string", minLength: 1, maxLength: 240 },
  },
};

const esquemaTrabalho = {
  type: "object",
  required: ["tipo", "payload"],
  additionalProperties: false,
  properties: {
    tipo: {
      enum: ["sistema.diagnostico", "catalogo.importar", "orcamento.recalcular"],
    },
    prioridade: { type: "integer", minimum: 1, maximum: 100 },
    maxTentativas: { type: "integer", minimum: 1, maximum: 10 },
    payload: { type: "object", additionalProperties: true },
  },
};

const esquemaTransicaoRepositorio = {
  type: "object",
  required: ["modo"],
  additionalProperties: false,
  properties: {
    modo: { enum: ["local", "hibrido", "corporativo"] },
  },
};

const esquemaPoliticaAuditoria = {
  type: "object",
  required: ["retencaoDias", "frequenciaBackup"],
  additionalProperties: false,
  properties: {
    retencaoDias: { type: "integer", minimum: 365, maximum: 36500 },
    frequenciaBackup: { enum: ["diario", "semanal", "mensal"] },
    ultimoBackupEm: { type: "string", format: "date-time" },
    ultimoBackupHash: { type: "string", pattern: "^[0-9a-f]{64}$" },
    ultimoTesteRestauracaoEm: { type: "string", format: "date-time" },
    ultimoTesteRestauracaoOk: { type: "boolean" },
  },
};

const esquemaDocumento = {
  type: "object", required: ["titulo"], additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 2, maxLength: 240 },
    tipo: { type: "string", maxLength: 80 },
    status: { enum: ["rascunho", "em_revisao", "aprovado", "arquivado"] },
    metadados: { type: "object", additionalProperties: true },
  },
};

const esquemaVersaoDocumento = {
  type: "object", required: ["nomeArquivo", "sha256", "storageKey"], additionalProperties: false,
  properties: {
    nomeArquivo: { type: "string", minLength: 1, maxLength: 500 },
    tipoMime: { type: "string", maxLength: 160 },
    tamanhoBytes: { type: "integer", minimum: 0 },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    storageKey: { type: "string", minLength: 1, maxLength: 1000 },
    metadados: { type: "object", additionalProperties: true },
  },
};

const esquemaIntegracao = {
  type: "object", required: ["nome", "provedor"], additionalProperties: false,
  properties: {
    nome: { type: "string", minLength: 2, maxLength: 240 },
    provedor: { type: "string", minLength: 2, maxLength: 160 },
    status: { enum: ["ativa", "inativa", "suspensa"] },
    credentialReference: { type: "string", maxLength: 500 },
    configuracao: { type: "object", additionalProperties: true },
  },
};

const esquemaExecucaoIntegracao = {
  type: "object", additionalProperties: false,
  properties: {
    status: { enum: ["iniciada", "concluida", "falhou"] },
    direcao: { enum: ["entrada", "saida", "bidirecional"] },
    contagens: { type: "object", additionalProperties: true },
    erroSanitizado: { type: "string", maxLength: 2000 },
  },
};

const esquemaPerfilProduto = {
  type: "object", required: ["perfil"], additionalProperties: false,
  properties: {
    perfil: { enum: ["publico", "federacao", "privado", "escritorio", "facilities"] },
    terminologia: { type: "object", additionalProperties: true },
    templates: { type: "object", additionalProperties: true },
  },
};

const esquemaContratoModulo = {
  type: "object", additionalProperties: false,
  properties: {
    disponivel: { type: "boolean" }, contratado: { type: "boolean" }, habilitado: { type: "boolean" },
    pacote: { type: "string", maxLength: 120 }, limites: { type: "object", additionalProperties: true },
  },
};

function contextoDaRequisicao(request, identity) {
  const tenantId = String(request.headers["x-prumo-tenant-id"] || "").trim();
  const teamId = String(request.headers["x-prumo-team-id"] || "").trim();
  if (!tenantId) {
    throw new ApiError(400, "EMPRESA_AUSENTE", "Selecione a empresa ativa.");
  }
  return { identity, tenantId, teamId };
}

function versaoIfMatch(request) {
  const valor = String(request.headers["if-match"] || "").replace(/^W\//, "").replaceAll('"', "");
  const versao = Number(valor);
  if (!Number.isInteger(versao) || versao <= 0) {
    throw new ApiError(428, "VERSAO_AUSENTE", "Informe a versão conhecida do orçamento em If-Match.");
  }
  return versao;
}

function chaveIdempotencia(request) {
  const chave = String(request.headers["idempotency-key"] || "").trim();
  if (!chave) {
    throw new ApiError(
      428,
      "IDEMPOTENCIA_AUSENTE",
      "Informe uma chave de idempotência para criar o registro.",
    );
  }
  return chave;
}

export async function criarAplicacaoApi({
  repository,
  authenticate,
  corsOrigins = [],
  logger = false,
  jobWorker,
} = {}) {
  if (!repository) throw new Error("O repositório da API é obrigatório.");
  if (typeof authenticate !== "function") throw new Error("O autenticador da API é obrigatório.");

  const app = Fastify({ logger });
  const worker = jobWorker || criarWorkerTrabalhos({
    repository,
    logger: app.log,
  });
  await app.register(cors, {
    origin(origem, callback) {
      if (!origem || corsOrigins.includes(origem)) callback(null, true);
      else callback(new ApiError(403, "ORIGEM_NAO_AUTORIZADA", "Origem não autorizada."));
    },
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "If-Match",
      "X-Prumo-Tenant-Id",
      "X-Prumo-Team-Id",
      "X-Prumo-Dev-User",
    ],
    exposedHeaders: ["ETag"],
  });

  app.setErrorHandler((erro, request, reply) => {
    if (erro.validation) {
      return reply.status(400).send({
        erro: {
          codigo: "DADOS_INVALIDOS",
          mensagem: "Os dados enviados não atendem ao contrato da API.",
          detalhes: erro.validation,
        },
      });
    }
    const tratado = asApiError(erro);
    if (tratado.statusCode >= 500) {
      request.log.error({ err: erro }, "Falha interna ao processar a requisição");
    }
    return reply.status(tratado.statusCode).send({
      erro: {
        codigo: tratado.code,
        mensagem: tratado.message,
        ...(tratado.details ? { detalhes: tratado.details } : {}),
      },
    });
  });

  app.get("/health", async () => {
    const banco = await repository.health();
    return {
      ok: true,
      servico: "PRUMO API",
      versao: "10.6.0",
      armazenamento: repository.tipo,
      banco,
    };
  });

  app.addHook("preHandler", async (request) => {
    if (!request.url.startsWith("/v1/")) return;
    request.identity = await authenticate(request);
  });

  app.get("/v1/context", async (request) => (
    repository.validarContexto(contextoDaRequisicao(request, request.identity))
  ));

  app.get("/v1/modules", async (request) => {
    const contexto = await repository.validarContexto(
      contextoDaRequisicao(request, request.identity),
    );
    return contexto.modulos;
  });

  app.get("/v1/empreendimentos", async (request) => (
    repository.listarEmpreendimentos(contextoDaRequisicao(request, request.identity))
  ));

  app.post("/v1/empreendimentos", {
    schema: { body: esquemaEmpreendimento },
  }, async (request, reply) => {
    const item = await repository.criarEmpreendimento(
      contextoDaRequisicao(request, request.identity),
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201).header("ETag", `"${item.versao}"`);
    return item;
  });

  app.get("/v1/orcamentos", async (request) => (
    repository.listarOrcamentos(contextoDaRequisicao(request, request.identity))
  ));

  app.get("/v1/orcamentos/:id", async (request, reply) => {
    const item = await repository.obterOrcamento(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
    );
    reply.header("ETag", `"${item.versao}"`);
    return item;
  });

  app.post("/v1/orcamentos", {
    schema: { body: esquemaOrcamento },
  }, async (request, reply) => {
    const item = await repository.criarOrcamento(
      contextoDaRequisicao(request, request.identity),
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201).header("ETag", `"${item.versao}"`);
    return item;
  });

  app.put("/v1/orcamentos/:id", {
    schema: { body: esquemaOrcamento },
  }, async (request, reply) => {
    const item = await repository.atualizarOrcamento(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.body,
      versaoIfMatch(request),
    );
    reply.header("ETag", `"${item.versao}"`);
    return item;
  });

  app.get("/v1/orcamentos/:id/revisoes", async (request) => (
    repository.listarRevisoes(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
    )
  ));

  app.post("/v1/orcamentos/:id/revisoes", {
    schema: { body: esquemaRevisao },
  }, async (request, reply) => {
    const item = await repository.criarRevisao(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201);
    return item;
  });

  app.get("/v1/orcamentos/:id/medicoes", async (request) => (
    repository.listarMedicoes(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
    )
  ));

  app.post("/v1/orcamentos/:id/medicoes", {
    schema: { body: esquemaMedicao },
  }, async (request, reply) => {
    const item = await repository.criarMedicao(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201).header("ETag", `"${item.versao}"`);
    return item;
  });

  app.get("/v1/catalogo/publicacoes", async (request) => (
    repository.listarPublicacoesCatalogo(
      contextoDaRequisicao(request, request.identity),
      request.query || {},
    )
  ));

  app.post("/v1/catalogo/publicacoes", {
    schema: { body: esquemaPublicacaoCatalogo },
  }, async (request, reply) => {
    const item = await repository.criarPublicacaoCatalogo(
      contextoDaRequisicao(request, request.identity),
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201);
    return item;
  });

  app.get("/v1/catalogo/publicacoes/:id/itens", async (request) => (
    repository.listarItensCatalogo(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.query || {},
    )
  ));

  app.post("/v1/catalogo/publicacoes/:id/itens", {
    schema: { body: esquemaItensCatalogo },
  }, async (request, reply) => {
    const resultado = await repository.salvarItensCatalogo(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.body.itens,
      chaveIdempotencia(request),
    );
    reply.code(201);
    return resultado;
  });

  app.get("/v1/catalogo/publicacoes/:id/composicoes/:codigo/componentes", async (request) => (
    repository.listarComponentesCatalogo(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
      request.params.codigo,
      request.query || {},
    )
  ));

  app.get("/v1/migracoes", async (request) => (
    repository.listarLotesMigracao(contextoDaRequisicao(request, request.identity))
  ));

  app.post("/v1/migracoes", {
    schema: { body: esquemaPacoteMigracao },
  }, async (request, reply) => {
    const item = await repository.receberLoteMigracao(
      contextoDaRequisicao(request, request.identity),
      request.body,
      chaveIdempotencia(request),
    );
    reply.code(201);
    return item;
  });

  app.post("/v1/migracoes/:id/validacao", async (request) => (
    repository.validarLoteMigracao(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
    )
  ));

  app.post("/v1/migracoes/:id/homologacao", async (request) => (
    repository.homologarLoteMigracao(
      contextoDaRequisicao(request, request.identity),
      request.params.id,
    )
  ));

  app.get("/v1/trabalhos", async (request) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    const trabalhos = await repository.listarTrabalhos(contexto, request.query || {});
    trabalhos
      .filter((item) => item.status === "pendente")
      .forEach((item) => worker.agendar(contexto, item.id));
    return trabalhos;
  });

  app.post("/v1/trabalhos", {
    schema: { body: esquemaTrabalho },
  }, async (request, reply) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    const item = await repository.criarTrabalho(
      contexto,
      request.body,
      chaveIdempotencia(request),
    );
    worker.agendar(contexto, item.id);
    reply.code(202);
    return item;
  });

  app.post("/v1/trabalhos/:id/reprocessamento", async (request) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    const item = await repository.reprocessarTrabalho(contexto, request.params.id);
    worker.agendar(contexto, item.id);
    return item;
  });

  app.get("/v1/repositorios/transicoes", async (request) => (
    repository.listarTransicoesRepositorio(
      contextoDaRequisicao(request, request.identity),
    )
  ));

  app.put("/v1/repositorios/transicoes/:dominioId", {
    schema: { body: esquemaTransicaoRepositorio },
  }, async (request) => (
    repository.alterarTransicaoRepositorio(
      contextoDaRequisicao(request, request.identity),
      request.params.dominioId,
      request.body.modo,
    )
  ));

  app.get("/v1/auditoria", async (request) => (
    repository.listarAuditoria(
      contextoDaRequisicao(request, request.identity),
      request.query || {},
    )
  ));

  app.get("/v1/auditoria/exportacao.csv", async (request, reply) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    const filtros = request.query || {};
    const itens = [];
    let deslocamento = 0;
    let total = 0;
    do {
      const pagina = await repository.listarAuditoria(contexto, {
        ...filtros,
        limite: 200,
        deslocamento,
      });
      itens.push(...pagina.itens);
      total = pagina.total;
      deslocamento += pagina.itens.length;
      if (!pagina.itens.length) break;
    } while (deslocamento < total && deslocamento < 10_000);
    reply
      .type("text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="prumo-auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
    return exportarAuditoriaCsv(itens);
  });

  app.get("/v1/auditoria/politica", async (request) => (
    repository.obterPoliticaAuditoria(
      contextoDaRequisicao(request, request.identity),
    )
  ));

  app.put("/v1/auditoria/politica", {
    schema: { body: esquemaPoliticaAuditoria },
  }, async (request) => (
    repository.atualizarPoliticaAuditoria(
      contextoDaRequisicao(request, request.identity),
      request.body,
    )
  ));

  app.get("/v1/documentos", async (request) => (
    repository.listarDocumentos(contextoDaRequisicao(request, request.identity))
  ));
  app.post("/v1/documentos", { schema: { body: esquemaDocumento } }, async (request, reply) => {
    const item = await repository.criarDocumento(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201);
    return item;
  });
  app.post("/v1/documentos/:id/versoes", { schema: { body: esquemaVersaoDocumento } }, async (request) => (
    repository.adicionarVersaoDocumento(contextoDaRequisicao(request, request.identity), request.params.id, request.body)
  ));

  app.get("/v1/integracoes", async (request) => (
    repository.listarIntegracoes(contextoDaRequisicao(request, request.identity))
  ));
  app.post("/v1/integracoes", { schema: { body: esquemaIntegracao } }, async (request, reply) => {
    const item = await repository.criarIntegracao(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201);
    return item;
  });
  app.post("/v1/integracoes/:id/execucoes", { schema: { body: esquemaExecucaoIntegracao } }, async (request) => (
    repository.registrarExecucaoIntegracao(contextoDaRequisicao(request, request.identity), request.params.id, request.body)
  ));

  app.get("/v1/produto-modular", async (request) => (
    repository.obterProdutoModular(contextoDaRequisicao(request, request.identity))
  ));
  app.put("/v1/produto-modular/perfil", { schema: { body: esquemaPerfilProduto } }, async (request) => (
    repository.atualizarPerfilProduto(contextoDaRequisicao(request, request.identity), request.body)
  ));
  app.put("/v1/produto-modular/modulos/:moduleId", { schema: { body: esquemaContratoModulo } }, async (request) => (
    repository.atualizarContratoModulo(contextoDaRequisicao(request, request.identity), request.params.moduleId, request.body)
  ));

  app.addHook("onClose", async () => {
    await worker.fechar();
    await repository.fechar();
  });
  return app;
}
