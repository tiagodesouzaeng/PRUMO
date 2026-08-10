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
    patrimonioUnidadeId: { type: "string" },
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
      enum: ["sistema.diagnostico", "catalogo.importar", "orcamento.recalcular", "integracao.sincronizar"],
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

const esquemaUnidadePatrimonial = {
  type: "object",
  required: ["nivel", "codigo", "nome"],
  additionalProperties: false,
  properties: {
    parentId: { type: "string" },
    nivel: { enum: ["cliente", "site", "predio", "sala"] },
    codigo: { type: "string", minLength: 1, maxLength: 80 },
    nome: { type: "string", minLength: 2, maxLength: 240 },
    status: { enum: ["ativo", "inativo"] },
    endereco: { type: "object", additionalProperties: true },
    areaM2: { type: ["number", "null"], minimum: 0 },
    responsavel: { type: "string", maxLength: 240 },
    ocupacao: { type: "string", maxLength: 240 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaAtivoPatrimonial = {
  type: "object",
  required: ["salaId", "codigo", "nome"],
  additionalProperties: false,
  properties: {
    salaId: { type: "string", minLength: 1 },
    codigo: { type: "string", minLength: 1, maxLength: 80 },
    nome: { type: "string", minLength: 2, maxLength: 240 },
    categoria: { type: "string", maxLength: 120 },
    numeroPatrimonio: { type: "string", maxLength: 120 },
    fabricante: { type: "string", maxLength: 160 },
    modelo: { type: "string", maxLength: 160 },
    numeroSerie: { type: "string", maxLength: 160 },
    status: { enum: ["ativo", "em_manutencao", "inativo", "baixado"] },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaMovimentacaoPatrimonial = {
  type: "object",
  required: ["destinoSalaId", "motivo"],
  additionalProperties: false,
  properties: {
    destinoSalaId: { type: "string", minLength: 1 },
    motivo: { type: "string", minLength: 3, maxLength: 1000 },
  },
};

const esquemaProgramaInvestimento = {
  type: "object", required: ["codigo", "nome"], additionalProperties: false,
  properties: {
    codigo: { type: "string", minLength: 1, maxLength: 80 },
    nome: { type: "string", minLength: 2, maxLength: 240 },
    objetivo: { type: "string", maxLength: 4000 },
    anoInicio: { type: ["integer", "null"], minimum: 2000, maximum: 2200 },
    anoFim: { type: ["integer", "null"], minimum: 2000, maximum: 2200 },
    limiteFinanceiro: { type: "number", minimum: 0 },
    status: { enum: ["ativo", "inativo", "encerrado"] },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaCarteiraInvestimento = {
  type: "object", required: ["codigo", "nome", "ano"], additionalProperties: false,
  properties: {
    codigo: { type: "string", minLength: 1, maxLength: 80 },
    nome: { type: "string", minLength: 2, maxLength: 240 },
    ano: { type: "integer", minimum: 2000, maximum: 2200 },
    limiteFinanceiro: { type: "number", minimum: 0 },
    status: { enum: ["elaboracao", "em_aprovacao", "aprovada", "encerrada"] },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaDemandaInvestimento = {
  type: "object", required: ["patrimonioUnidadeId", "codigo", "titulo"], additionalProperties: false,
  properties: {
    patrimonioUnidadeId: { type: "string", minLength: 1 }, programaId: { type: "string" },
    codigo: { type: "string", minLength: 1, maxLength: 80 }, titulo: { type: "string", minLength: 2, maxLength: 240 },
    descricao: { type: "string", maxLength: 8000 }, solicitante: { type: "string", maxLength: 240 },
    categoria: { enum: ["obra_reforma", "manutencao", "regularidade", "eficiencia", "acessibilidade", "tecnologia", "outro"] },
    valorEstimado: { type: "number", minimum: 0 }, dataDesejada: { type: "string", format: "date" },
    urgencia: { type: "integer", minimum: 1, maximum: 5 }, impacto: { type: "integer", minimum: 1, maximum: 5 },
    risco: { type: "integer", minimum: 1, maximum: 5 }, alinhamento: { type: "integer", minimum: 1, maximum: 5 },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaDecisaoDemanda = {
  type: "object", required: ["acao"], additionalProperties: false,
  properties: {
    acao: { enum: ["enviar_analise", "priorizar", "aprovar", "rejeitar", "reabrir"] },
    justificativa: { type: "string", maxLength: 4000 },
  },
};

const esquemaItemCarteiraInvestimento = {
  type: "object", required: ["demandId", "ordem", "valorPlanejado"], additionalProperties: false,
  properties: {
    demandId: { type: "string", minLength: 1 }, ordem: { type: "integer", minimum: 1 },
    valorPlanejado: { type: "number", minimum: 0 }, observacao: { type: "string", maxLength: 4000 },
  },
};

const esquemaFornecedor = {
  type: "object", required: ["codigo", "razaoSocial"], additionalProperties: false,
  properties: {
    codigo: { type: "string", minLength: 1, maxLength: 80 }, razaoSocial: { type: "string", minLength: 2, maxLength: 240 },
    nomeFantasia: { type: "string", maxLength: 240 }, documento: { type: "string", maxLength: 40 },
    email: { type: "string", maxLength: 240 }, telefone: { type: "string", maxLength: 80 },
    status: { enum: ["ativo", "suspenso", "inativo"] }, qualificacao: { enum: ["pendente", "qualificado", "restrito"] },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaProcessoContratacao = {
  type: "object", required: ["codigo", "titulo", "objeto"], additionalProperties: false,
  properties: {
    demandId: { type: "string" }, orcamentoId: { type: "string" }, codigo: { type: "string", minLength: 1, maxLength: 80 },
    titulo: { type: "string", minLength: 2, maxLength: 240 }, objeto: { type: "string", minLength: 3, maxLength: 8000 },
    tipo: { enum: ["material", "servico", "obra", "solucao_integrada"] }, regime: { enum: ["publico", "federacao", "privado"] },
    criterioJulgamento: { enum: ["menor_preco", "maior_desconto", "tecnica_preco", "melhor_tecnica"] },
    valorEstimado: { type: "number", minimum: 0 }, estudoTecnico: { type: "object", additionalProperties: true },
    riscos: { type: "array", items: { type: "object", additionalProperties: true } }, termoReferencia: { type: "object", additionalProperties: true },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaCotacao = {
  type: "object", required: ["supplierId", "valorTotal"], additionalProperties: false,
  properties: {
    supplierId: { type: "string", minLength: 1 }, dataProposta: { type: "string", format: "date" },
    validadeDias: { type: "integer", minimum: 0 }, prazoEntregaDias: { type: "integer", minimum: 0 },
    valorTotal: { type: "number", exclusiveMinimum: 0 }, status: { enum: ["recebida", "classificada", "desclassificada", "vencedora"] },
    justificativa: { type: "string", maxLength: 4000 }, proposta: { type: "object", additionalProperties: true },
  },
};

const esquemaDecisaoContratacao = {
  type: "object", required: ["acao"], additionalProperties: false,
  properties: {
    acao: { enum: ["iniciar_planejamento", "abrir_pesquisa", "iniciar_selecao", "aprovar", "devolver", "cancelar"] },
    justificativa: { type: "string", maxLength: 4000 }, dados: { type: "object", additionalProperties: true },
  },
};

const esquemaPedidoCompra = {
  type: "object", required: ["supplierId", "codigo", "valorTotal"], additionalProperties: false,
  properties: {
    supplierId: { type: "string", minLength: 1 }, quoteId: { type: "string" }, codigo: { type: "string", minLength: 1, maxLength: 80 },
    valorTotal: { type: "number", exclusiveMinimum: 0 }, dataEmissao: { type: "string", format: "date" }, dataPrevista: { type: "string", format: "date" },
    dados: { type: "object", additionalProperties: true },
  },
};

const esquemaRecebimentoPedido = {
  type: "object", required: ["valorRecebido"], additionalProperties: false,
  properties: {
    dataRecebimento: { type: "string", format: "date" }, valorRecebido: { type: "number", exclusiveMinimum: 0 },
    aceite: { enum: ["aceito", "aceito_com_ressalva", "rejeitado"] }, observacao: { type: "string", maxLength: 4000 },
  },
};

const esquemaContrato = {
  type: "object", required: ["processId","supplierId","codigo","numero","titulo","objeto","dataInicio","dataFim","valorInicial"], additionalProperties: false,
  properties: {
    processId:{type:"string",minLength:1}, supplierId:{type:"string",minLength:1}, codigo:{type:"string",minLength:1,maxLength:80}, numero:{type:"string",minLength:1,maxLength:120},
    titulo:{type:"string",minLength:2,maxLength:240}, objeto:{type:"string",minLength:3,maxLength:8000}, tipoInstrumento:{enum:["contrato","ata_registro_precos","ordem_servico","termo","instrumento_equivalente"]}, regime:{enum:["publico","federacao","privado"]},
    dataAssinatura:{type:"string",format:"date"}, dataInicio:{type:"string",format:"date"}, dataFim:{type:"string",format:"date"}, valorInicial:{type:"number",exclusiveMinimum:0}, dados:{type:"object",additionalProperties:true},
  },
};
const esquemaDecisaoContrato = { type:"object",required:["acao"],additionalProperties:false,properties:{ acao:{enum:["ativar","suspender","reativar","concluir","rescindir","encerrar","cancelar"]},justificativa:{type:"string",maxLength:4000},dados:{type:"object",additionalProperties:true} } };
const esquemaResponsavelContrato = { type:"object",required:["papel","nome","dataInicio"],additionalProperties:false,properties:{ papel:{enum:["gestor","fiscal_tecnico","fiscal_administrativo","substituto"]},nome:{type:"string",minLength:2,maxLength:240},documento:{type:"string",maxLength:80},email:{type:"string",maxLength:240},dataInicio:{type:"string",format:"date"},dataFim:{type:"string",format:"date"},atoDesignacao:{type:"string",maxLength:500} } };
const esquemaAditivoContrato = { type:"object",required:["numero","tipo","justificativa"],additionalProperties:false,properties:{ numero:{type:"string",minLength:1,maxLength:120},tipo:{enum:["valor","prazo","prazo_valor","supressao","reajuste"]},justificativa:{type:"string",minLength:3,maxLength:4000},valor:{type:"number",minimum:0},novaDataFim:{type:"string",format:"date"},dados:{type:"object",additionalProperties:true} } };
const esquemaGarantiaContrato = { type:"object",required:["tipo"],additionalProperties:false,properties:{ tipo:{enum:["caucao","seguro_garantia","fianca_bancaria","retencao","dispensada"]},numero:{type:"string",maxLength:120},instituicao:{type:"string",maxLength:240},valor:{type:"number",minimum:0},dataInicio:{type:"string",format:"date"},dataFim:{type:"string",format:"date"},status:{enum:["ativa","liberada","executada","vencida","dispensada"]},dados:{type:"object",additionalProperties:true} } };
const esquemaOcorrenciaContrato = { type:"object",required:["descricao"],additionalProperties:false,properties:{ dataOcorrencia:{type:"string",format:"date"},tipo:{type:"string",maxLength:120},severidade:{enum:["baixa","media","alta","critica"]},descricao:{type:"string",minLength:3,maxLength:8000},providencia:{type:"string",maxLength:8000},status:{enum:["aberta","em_tratamento","resolvida"]} } };
const esquemaSancaoContrato = { type:"object",required:["tipo","fundamento"],additionalProperties:false,properties:{ occurrenceId:{type:"string"},tipo:{enum:["advertencia","multa","suspensao","impedimento","declaracao_inidoneidade"]},fundamento:{type:"string",minLength:3,maxLength:8000},valor:{type:"number",minimum:0},dataAplicacao:{type:"string",format:"date"},dataFim:{type:"string",format:"date"} } };
const esquemaExecucaoContrato = { type:"object",required:["valor"],additionalProperties:false,properties:{ origem:{enum:["manual","medicao","recebimento","financeiro"]},referenciaId:{type:"string",maxLength:240},dataExecucao:{type:"string",format:"date"},valor:{type:"number",exclusiveMinimum:0},descricao:{type:"string",maxLength:4000} } };

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

const esquemaVinculoDocumento = {
  type: "object", required: ["moduleId", "entidadeTipo", "entidadeId"], additionalProperties: false,
  properties: {
    moduleId: { type: "string", minLength: 1, maxLength: 80 },
    entidadeTipo: { type: "string", minLength: 1, maxLength: 120 },
    entidadeId: { type: "string", minLength: 1, maxLength: 240 },
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
    throw new ApiError(428, "VERSAO_AUSENTE", "Informe a versão conhecida do registro em If-Match.");
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
      versao: "14.0.0",
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

  app.get("/v1/patrimonio/unidades", async (request) => (
    repository.listarUnidadesPatrimoniais(
      contextoDaRequisicao(request, request.identity),
      request.query || {},
    )
  ));

  app.get("/v1/patrimonio/unidades/:id", async (request, reply) => {
    const item = await repository.obterUnidadePatrimonial(
      contextoDaRequisicao(request, request.identity), request.params.id,
    );
    reply.header("ETag", `"${item.versao}"`);
    return item;
  });

  app.post("/v1/patrimonio/unidades", {
    schema: { body: esquemaUnidadePatrimonial },
  }, async (request, reply) => {
    const item = await repository.criarUnidadePatrimonial(
      contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request),
    );
    reply.code(201).header("ETag", `"${item.versao}"`);
    return item;
  });

  app.put("/v1/patrimonio/unidades/:id", {
    schema: { body: esquemaUnidadePatrimonial },
  }, async (request, reply) => {
    const item = await repository.atualizarUnidadePatrimonial(
      contextoDaRequisicao(request, request.identity), request.params.id,
      request.body, versaoIfMatch(request),
    );
    reply.header("ETag", `"${item.versao}"`);
    return item;
  });

  app.delete("/v1/patrimonio/unidades/:id", async (request, reply) => {
    await repository.excluirUnidadePatrimonial(
      contextoDaRequisicao(request, request.identity), request.params.id,
      versaoIfMatch(request),
    );
    return reply.code(204).send();
  });

  app.get("/v1/patrimonio/ativos", async (request) => (
    repository.listarAtivosPatrimoniais(
      contextoDaRequisicao(request, request.identity), request.query || {},
    )
  ));

  app.post("/v1/patrimonio/ativos", {
    schema: { body: esquemaAtivoPatrimonial },
  }, async (request, reply) => {
    const item = await repository.criarAtivoPatrimonial(
      contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request),
    );
    reply.code(201).header("ETag", `"${item.versao}"`);
    return item;
  });

  app.put("/v1/patrimonio/ativos/:id", {
    schema: { body: esquemaAtivoPatrimonial },
  }, async (request, reply) => {
    const item = await repository.atualizarAtivoPatrimonial(
      contextoDaRequisicao(request, request.identity), request.params.id,
      request.body, versaoIfMatch(request),
    );
    reply.header("ETag", `"${item.versao}"`);
    return item;
  });

  app.get("/v1/patrimonio/ativos/:id/movimentacoes", async (request) => (
    repository.listarMovimentacoesPatrimoniais(
      contextoDaRequisicao(request, request.identity), request.params.id,
    )
  ));

  app.post("/v1/patrimonio/ativos/:id/movimentacoes", {
    schema: { body: esquemaMovimentacaoPatrimonial },
  }, async (request, reply) => {
    const item = await repository.movimentarAtivoPatrimonial(
      contextoDaRequisicao(request, request.identity), request.params.id,
      request.body, chaveIdempotencia(request),
    );
    reply.code(201);
    return item;
  });

  app.get("/v1/planejamento/programas", async (request) => repository.listarProgramasInvestimento(contextoDaRequisicao(request, request.identity)));
  app.post("/v1/planejamento/programas", { schema: { body: esquemaProgramaInvestimento } }, async (request, reply) => {
    const item = await repository.criarProgramaInvestimento(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.versao}"`); return item;
  });
  app.put("/v1/planejamento/programas/:id", { schema: { body: esquemaProgramaInvestimento } }, async (request, reply) => {
    const item = await repository.atualizarProgramaInvestimento(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request));
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.get("/v1/planejamento/carteiras", async (request) => repository.listarCarteirasInvestimento(contextoDaRequisicao(request, request.identity)));
  app.post("/v1/planejamento/carteiras", { schema: { body: esquemaCarteiraInvestimento } }, async (request, reply) => {
    const item = await repository.criarCarteiraInvestimento(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.versao}"`); return item;
  });
  app.put("/v1/planejamento/carteiras/:id", { schema: { body: esquemaCarteiraInvestimento } }, async (request, reply) => {
    const item = await repository.atualizarCarteiraInvestimento(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request));
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.post("/v1/planejamento/carteiras/:id/demandas", { schema: { body: esquemaItemCarteiraInvestimento } }, async (request, reply) => {
    const item = await repository.incorporarDemandaCarteira(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request), chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.demanda.versao}"`); return item;
  });
  app.get("/v1/planejamento/demandas", async (request) => repository.listarDemandasInvestimento(contextoDaRequisicao(request, request.identity), request.query || {}));
  app.get("/v1/planejamento/demandas/:id", async (request, reply) => {
    const item = await repository.obterDemandaInvestimento(contextoDaRequisicao(request, request.identity), request.params.id);
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.post("/v1/planejamento/demandas", { schema: { body: esquemaDemandaInvestimento } }, async (request, reply) => {
    const item = await repository.criarDemandaInvestimento(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.versao}"`); return item;
  });
  app.put("/v1/planejamento/demandas/:id", { schema: { body: esquemaDemandaInvestimento } }, async (request, reply) => {
    const item = await repository.atualizarDemandaInvestimento(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request));
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.get("/v1/planejamento/demandas/:id/decisoes", async (request) => repository.listarDecisoesDemanda(contextoDaRequisicao(request, request.identity), request.params.id));
  app.post("/v1/planejamento/demandas/:id/decisoes", { schema: { body: esquemaDecisaoDemanda } }, async (request, reply) => {
    const item = await repository.decidirDemandaInvestimento(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request), chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.demanda.versao}"`); return item;
  });

  app.get("/v1/suprimentos/fornecedores", async (request) => repository.listarFornecedores(contextoDaRequisicao(request, request.identity), request.query || {}));
  app.post("/v1/suprimentos/fornecedores", { schema: { body: esquemaFornecedor } }, async (request, reply) => {
    const item = await repository.criarFornecedor(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.versao}"`); return item;
  });
  app.put("/v1/suprimentos/fornecedores/:id", { schema: { body: esquemaFornecedor } }, async (request, reply) => {
    const item = await repository.atualizarFornecedor(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request));
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.get("/v1/suprimentos/processos", async (request) => repository.listarProcessosContratacao(contextoDaRequisicao(request, request.identity), request.query || {}));
  app.get("/v1/suprimentos/processos/:id", async (request, reply) => {
    const item = await repository.obterProcessoContratacao(contextoDaRequisicao(request, request.identity), request.params.id);
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.post("/v1/suprimentos/processos", { schema: { body: esquemaProcessoContratacao } }, async (request, reply) => {
    const item = await repository.criarProcessoContratacao(contextoDaRequisicao(request, request.identity), request.body, chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.versao}"`); return item;
  });
  app.put("/v1/suprimentos/processos/:id", { schema: { body: esquemaProcessoContratacao } }, async (request, reply) => {
    const item = await repository.atualizarProcessoContratacao(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request));
    reply.header("ETag", `"${item.versao}"`); return item;
  });
  app.post("/v1/suprimentos/processos/:id/cotacoes", { schema: { body: esquemaCotacao } }, async (request, reply) => {
    const item = await repository.registrarCotacao(contextoDaRequisicao(request, request.identity), request.params.id, request.body, chaveIdempotencia(request));
    reply.code(201); return item;
  });
  app.post("/v1/suprimentos/processos/:id/decisoes", { schema: { body: esquemaDecisaoContratacao } }, async (request, reply) => {
    const item = await repository.decidirProcessoContratacao(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request), chaveIdempotencia(request));
    reply.code(201).header("ETag", `"${item.processo.versao}"`); return item;
  });
  app.post("/v1/suprimentos/processos/:id/pedidos", { schema: { body: esquemaPedidoCompra } }, async (request, reply) => {
    const item = await repository.emitirPedidoCompra(contextoDaRequisicao(request, request.identity), request.params.id, request.body, versaoIfMatch(request), chaveIdempotencia(request));
    reply.code(201); return item;
  });
  app.get("/v1/suprimentos/pedidos", async (request) => repository.listarPedidosCompra(contextoDaRequisicao(request, request.identity), request.query || {}));
  app.post("/v1/suprimentos/pedidos/:id/recebimentos", { schema: { body: esquemaRecebimentoPedido } }, async (request, reply) => {
    const item = await repository.registrarRecebimentoPedido(contextoDaRequisicao(request, request.identity), request.params.id, request.body, chaveIdempotencia(request));
    reply.code(201); return item;
  });

  app.get("/v1/contratos", async (request) => repository.listarContratos(contextoDaRequisicao(request, request.identity),request.query||{}));
  app.get("/v1/contratos/:id", async (request,reply) => { const item=await repository.obterContrato(contextoDaRequisicao(request,request.identity),request.params.id); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/contratos", {schema:{body:esquemaContrato}}, async (request,reply) => { const item=await repository.criarContrato(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.put("/v1/contratos/:id", {schema:{body:esquemaContrato}}, async (request,reply) => { const item=await repository.atualizarContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request)); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/contratos/:id/decisoes", {schema:{body:esquemaDecisaoContrato}}, async (request,reply) => { const item=await repository.decidirContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.contrato.versao}"`); return item; });
  app.post("/v1/contratos/:id/responsaveis", {schema:{body:esquemaResponsavelContrato}}, async (request,reply) => { const item=await repository.adicionarResponsavelContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.post("/v1/contratos/:id/aditivos", {schema:{body:esquemaAditivoContrato}}, async (request,reply) => { const item=await repository.registrarAditivoContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.contrato.versao}"`); return item; });
  app.post("/v1/contratos/:id/garantias", {schema:{body:esquemaGarantiaContrato}}, async (request,reply) => { const item=await repository.registrarGarantiaContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.post("/v1/contratos/:id/ocorrencias", {schema:{body:esquemaOcorrenciaContrato}}, async (request,reply) => { const item=await repository.registrarOcorrenciaContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.post("/v1/contratos/:id/sancoes", {schema:{body:esquemaSancaoContrato}}, async (request,reply) => { const item=await repository.aplicarSancaoContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.post("/v1/contratos/:id/execucoes", {schema:{body:esquemaExecucaoContrato}}, async (request,reply) => { const item=await repository.registrarExecucaoContrato(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.contrato.versao}"`); return item; });

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
  app.post("/v1/documentos/:id/vinculos", { schema: { body: esquemaVinculoDocumento } }, async (request) => (
    repository.vincularDocumento(contextoDaRequisicao(request, request.identity), request.params.id, request.body)
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
