import Fastify from "fastify";
import cors from "@fastify/cors";
import { ApiError, asApiError } from "./errors.js";
import { criarWorkerTrabalhos } from "./workers/jobWorker.js";
import { exportarAuditoriaCsv } from "./domain/audit.js";
import { criarArmazenamentoDesabilitado } from "./storage/objectStorage.js";

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
const esquemaCentroCustoFinanceiro = { type:"object",required:["codigo","nome"],additionalProperties:false,properties:{ codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},responsavel:{type:"string",maxLength:240},status:{enum:["ativo","inativo"]},dados:{type:"object",additionalProperties:true} } };
const esquemaFonteFinanceira = { type:"object",required:["codigo","nome"],additionalProperties:false,properties:{ codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},tipo:{enum:["tesouro","transferencia","convenio","propria","financiamento","outra"]},status:{enum:["ativa","inativa"]},dados:{type:"object",additionalProperties:true} } };
const esquemaOrcamentoFinanceiro = { type:"object",required:["costCenterId","fundingSourceId","codigo","descricao","ano","classificacao","valorInicial"],additionalProperties:false,properties:{ costCenterId:{type:"string",minLength:1},fundingSourceId:{type:"string",minLength:1},codigo:{type:"string",minLength:1,maxLength:80},descricao:{type:"string",minLength:2,maxLength:500},ano:{type:"integer",minimum:2000,maximum:2200},classificacao:{enum:["capex","opex"]},valorInicial:{type:"number",minimum:0},ajustes:{type:"number"},status:{enum:["ativo","bloqueado","encerrado"]},dados:{type:"object",additionalProperties:true} } };
const esquemaCompromissoFinanceiro = { type:"object",required:["budgetId","codigo","descricao","competencia","valorTotal"],additionalProperties:false,properties:{ budgetId:{type:"string",minLength:1},codigo:{type:"string",minLength:1,maxLength:80},descricao:{type:"string",minLength:2,maxLength:1000},origemTipo:{enum:["manual","pedido","contrato","medicao"]},origemId:{type:"string",maxLength:240},beneficiario:{type:"string",maxLength:240},competencia:{type:"string",format:"date"},dataVencimento:{type:"string",format:"date"},valorTotal:{type:"number",exclusiveMinimum:0},referenciaExterna:{type:"string",maxLength:240},dados:{type:"object",additionalProperties:true} } };
const esquemaMovimentoFinanceiro = { type:"object",required:["tipo"],additionalProperties:false,properties:{ tipo:{enum:["reserva","compromisso","liquidacao","pagamento","cancelamento"]},dataMovimento:{type:"string",format:"date"},valor:{type:"number",minimum:0},retencoes:{type:"number",minimum:0},glosas:{type:"number",minimum:0},documento:{type:"string",maxLength:240},referenciaExterna:{type:"string",maxLength:240},justificativa:{type:"string",maxLength:4000},dados:{type:"object",additionalProperties:true} } };
const esquemaObraCorporativa = { type:"object",required:["patrimonioUnidadeId","codigo","nome","dataInicio","dataFimPrevista","valorPrevisto"],additionalProperties:false,properties:{ patrimonioUnidadeId:{type:"string",minLength:1},contractId:{type:"string"},orcamentoId:{type:"string"},codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},responsavel:{type:"string",maxLength:240},dataInicio:{type:"string",format:"date"},dataFimPrevista:{type:"string",format:"date"},valorPrevisto:{type:"number",minimum:0},progressoFisico:{type:"number",minimum:0,maximum:100},dados:{type:"object",additionalProperties:true} } };
const esquemaDecisaoObra = { type:"object",required:["acao"],additionalProperties:false,properties:{ acao:{enum:["iniciar","suspender","retomar","concluir","cancelar"]},justificativa:{type:"string",maxLength:4000} } };
const esquemaCronogramaObra = { type:"object",required:["codigo","titulo","dataInicio","dataFim"],additionalProperties:false,properties:{ codigo:{type:"string",minLength:1,maxLength:80},titulo:{type:"string",minLength:2,maxLength:240},dataInicio:{type:"string",format:"date"},dataFim:{type:"string",format:"date"},peso:{type:"number",minimum:0,maximum:100},progresso:{type:"number",minimum:0,maximum:100},valorPrevisto:{type:"number",minimum:0},status:{enum:["planejado","em_andamento","concluido","atrasado","cancelado"]},dados:{type:"object",additionalProperties:true} } };
const esquemaDiarioObra = { type:"object",required:["dataRegistro","atividades"],additionalProperties:false,properties:{ dataRegistro:{type:"string",format:"date"},clima:{type:"string",maxLength:120},efetivo:{type:"integer",minimum:0},atividades:{type:"string",minLength:3,maxLength:8000},ocorrencias:{type:"string",maxLength:8000},evidencias:{type:"array",maxItems:50,items:{type:"object",additionalProperties:true}} } };
const esquemaMedicaoObra = { type:"object",required:["numero","periodoInicio","periodoFim","valorBruto"],additionalProperties:false,properties:{ numero:{type:"integer",minimum:1},periodoInicio:{type:"string",format:"date"},periodoFim:{type:"string",format:"date"},valorBruto:{type:"number",exclusiveMinimum:0},retencoes:{type:"number",minimum:0},glosas:{type:"number",minimum:0},multas:{type:"number",minimum:0},itens:{type:"array",maxItems:1000,items:{type:"object",additionalProperties:true}},dados:{type:"object",additionalProperties:true} } };
const esquemaDecisaoMedicao = { type:"object",required:["acao"],additionalProperties:false,properties:{ acao:{enum:["enviar","aprovar","glosar","devolver","aceitar","cancelar"]},justificativa:{type:"string",maxLength:4000} } };
const esquemaPlanoManutencao = { type:"object",required:["codigo","nome","periodicidadeDias","proximaExecucao"],additionalProperties:false,properties:{ patrimonioUnidadeId:{type:"string"},ativoId:{type:"string"},codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},especialidade:{type:"string",maxLength:120},periodicidadeDias:{type:"integer",minimum:1,maximum:3650},proximaExecucao:{type:"string",format:"date"},responsavel:{type:"string",maxLength:240},status:{enum:["ativo","suspenso","encerrado"]},dados:{type:"object",additionalProperties:true} } };
const esquemaChamadoManutencao = { type:"object",required:["patrimonioUnidadeId","codigo","titulo","descricao","prioridade"],additionalProperties:false,properties:{ patrimonioUnidadeId:{type:"string",minLength:1},ativoId:{type:"string"},planoId:{type:"string"},codigo:{type:"string",minLength:1,maxLength:80},titulo:{type:"string",minLength:2,maxLength:240},descricao:{type:"string",minLength:3,maxLength:8000},tipo:{enum:["corretiva","preventiva","inspecao","melhoria"]},prioridade:{enum:["critica","alta","media","baixa"]},solicitante:{type:"string",maxLength:240},responsavel:{type:"string",maxLength:240},dados:{type:"object",additionalProperties:true} } };
const esquemaDecisaoManutencao = { type:"object",required:["acao"],additionalProperties:false,properties:{ acao:{enum:["triar","programar","iniciar","resolver","reabrir","fechar","cancelar"]},justificativa:{type:"string",maxLength:4000},responsavel:{type:"string",maxLength:240} } };
const esquemaOrdemManutencao = { type:"object",required:["codigo"],additionalProperties:false,properties:{ codigo:{type:"string",minLength:1,maxLength:80},equipe:{type:"string",maxLength:240},fornecedorId:{type:"string"},dataProgramada:{type:"string",format:"date"},diagnostico:{type:"string",maxLength:8000},dados:{type:"object",additionalProperties:true} } };
const esquemaRecursoManutencao = { type:"object",required:["tipo","descricao","quantidade"],additionalProperties:false,properties:{ tipo:{enum:["material","mao_obra","equipamento","servico"]},descricao:{type:"string",minLength:2,maxLength:500},unidade:{type:"string",maxLength:40},quantidade:{type:"number",exclusiveMinimum:0},valorUnitario:{type:"number",minimum:0} } };
const esquemaConciliacaoFinanceira = { type:"object",required:["referenciaExterna","status"],additionalProperties:false,properties:{ referenciaExterna:{type:"string",minLength:1,maxLength:240},dataConciliacao:{type:"string",format:"date"},status:{enum:["conciliado","divergente","pendente"]},diferenca:{type:"number"},observacao:{type:"string",maxLength:4000} } };
const esquemaConvenio = {type:"object",required:["codigo","titulo","concedente","convenente","objeto","dataInicio","dataFim"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},numero:{type:"string",maxLength:120},titulo:{type:"string",minLength:2,maxLength:240},programa:{type:"string",maxLength:240},concedente:{type:"string",minLength:2,maxLength:240},convenente:{type:"string",minLength:2,maxLength:240},objeto:{type:"string",minLength:3,maxLength:8000},dataInicio:{type:"string",format:"date"},dataFim:{type:"string",format:"date"},valorRepasse:{type:"number",minimum:0},valorContrapartida:{type:"number",minimum:0},dados:{type:"object",additionalProperties:true}}};
const esquemaDecisaoConvenio={type:"object",required:["acao"],additionalProperties:false,properties:{acao:{enum:["ativar","cancelar","iniciar_execucao","prestar_contas","encerrar","reabrir_execucao"]},justificativa:{type:"string",maxLength:4000}}};
const esquemaMetaConvenio={type:"object",required:["codigo","descricao"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},descricao:{type:"string",minLength:2,maxLength:2000},unidade:{type:"string",maxLength:40},quantidadePrevista:{type:"number",minimum:0},valorPrevisto:{type:"number",minimum:0},inicioPrevisto:{type:"string",format:"date"},fimPrevisto:{type:"string",format:"date"},status:{enum:["planejada","em_execucao","concluida","cancelada"]},dados:{type:"object",additionalProperties:true}}};
const esquemaRepasseConvenio={type:"object",required:["tipo","valor"],additionalProperties:false,properties:{tipo:{enum:["repasse","contrapartida","rendimento","devolucao"]},parcela:{type:"string",maxLength:120},dataPrevista:{type:"string",format:"date"},dataRealizada:{type:"string",format:"date"},valor:{type:"number",exclusiveMinimum:0},status:{enum:["previsto","recebido","devolvido","cancelado"]},referencia:{type:"string",maxLength:240},dados:{type:"object",additionalProperties:true}}};
const esquemaExecucaoConvenio={type:"object",required:["dataExecucao","descricao"],additionalProperties:false,properties:{goalId:{type:"string"},dataExecucao:{type:"string",format:"date"},descricao:{type:"string",minLength:2,maxLength:4000},quantidadeExecutada:{type:"number",minimum:0},valorExecutado:{type:"number",minimum:0},evidenciaDocumentoId:{type:"string"},referencia:{type:"string",maxLength:240},dados:{type:"object",additionalProperties:true}}};
const esquemaPrestacaoConvenio={type:"object",required:["periodoInicio","periodoFim"],additionalProperties:false,properties:{tipo:{enum:["parcial","final"]},periodoInicio:{type:"string",format:"date"},periodoFim:{type:"string",format:"date"},valorInformado:{type:"number",minimum:0},protocolo:{type:"string",maxLength:240},parecer:{type:"string",maxLength:8000},dados:{type:"object",additionalProperties:true}}};
const esquemaDecisaoPrestacao={type:"object",required:["acao"],additionalProperties:false,properties:{acao:{enum:["submeter","analisar","aprovar","rejeitar"]},protocolo:{type:"string",maxLength:240},parecer:{type:"string",maxLength:8000}}};
const esquemaDiligenciaConvenio={type:"object",required:["titulo","descricao","prazo"],additionalProperties:false,properties:{accountabilityId:{type:"string"},titulo:{type:"string",minLength:2,maxLength:240},descricao:{type:"string",minLength:3,maxLength:8000},prazo:{type:"string",format:"date"},dados:{type:"object",additionalProperties:true}}};
const esquemaRequisitoCompliance={type:"object",required:["patrimonioUnidadeId","codigo","tipo","titulo"],additionalProperties:false,properties:{patrimonioUnidadeId:{type:"string",minLength:1},codigo:{type:"string",minLength:1,maxLength:80},tipo:{type:"string",minLength:2,maxLength:120},titulo:{type:"string",minLength:2,maxLength:240},orgaoEmissor:{type:"string",maxLength:240},numeroDocumento:{type:"string",maxLength:240},dataEmissao:{type:"string",format:"date"},dataValidade:{type:"string",format:"date"},responsavel:{type:"string",maxLength:240},status:{enum:["pendente","regular","a_vencer","vencido","dispensado","cancelado"]},criticidade:{enum:["baixa","media","alta","critica"]},documentoId:{type:"string"},dados:{type:"object",additionalProperties:true}}};
const esquemaRiscoCompliance={type:"object",required:["codigo","titulo","descricao","probabilidade","impacto"],additionalProperties:false,properties:{requirementId:{type:"string"},codigo:{type:"string",minLength:1,maxLength:80},titulo:{type:"string",minLength:2,maxLength:240},descricao:{type:"string",minLength:3,maxLength:4000},probabilidade:{type:"integer",minimum:1,maximum:5},impacto:{type:"integer",minimum:1,maximum:5},controle:{type:"string",maxLength:4000},responsavel:{type:"string",maxLength:240},status:{enum:["aberto","mitigando","aceito","encerrado"]},dados:{type:"object",additionalProperties:true}}};
const esquemaAcaoCompliance={type:"object",required:["titulo","descricao","responsavel","prazo"],additionalProperties:false,properties:{titulo:{type:"string",minLength:2,maxLength:240},descricao:{type:"string",minLength:3,maxLength:4000},responsavel:{type:"string",minLength:2,maxLength:240},prazo:{type:"string",format:"date"},percentual:{type:"number",minimum:0,maximum:100},status:{enum:["aberta","em_andamento","concluida","cancelada"]},evidenciaDocumentoId:{type:"string"},dados:{type:"object",additionalProperties:true}}};
const esquemaAuditoriaCompliance={type:"object",required:["codigo","titulo","escopo","dataAuditoria","auditor","conclusao"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},titulo:{type:"string",minLength:2,maxLength:240},escopo:{type:"string",minLength:3,maxLength:4000},dataAuditoria:{type:"string",format:"date"},auditor:{type:"string",minLength:2,maxLength:240},conclusao:{type:"string",minLength:3,maxLength:8000},classificacao:{enum:["conforme","ressalva","nao_conforme"]},evidencias:{type:"array",items:{type:"object",additionalProperties:true}},dados:{type:"object",additionalProperties:true}}};
const esquemaPublicacaoTransparencia={type:"object",required:["codigo","titulo","categoria","descricaoPublica"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},titulo:{type:"string",minLength:2,maxLength:240},categoria:{type:"string",minLength:2,maxLength:120},descricaoPublica:{type:"string",minLength:3,maxLength:4000},periodoReferencia:{type:"string",maxLength:120},conteudo:{type:"object",additionalProperties:true},dadosInternos:{type:"object",additionalProperties:true}}};
const esquemaDefinicaoRelatorio={type:"object",required:["codigo","nome"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},descricao:{type:"string",maxLength:1000},modulos:{type:"array",items:{type:"string"}},configuracao:{type:"object",additionalProperties:true},compartilhado:{type:"boolean"}}};
const esquemaAcessoPortal={type:"object",required:["tipo","nome","email","expiraEm"],additionalProperties:false,properties:{tipo:{enum:["cliente","fornecedor","fiscalizacao"]},nome:{type:"string",minLength:2,maxLength:240},email:{type:"string",minLength:3,maxLength:240},escopo:{type:"object",additionalProperties:true},expiraEm:{type:"string",format:"date-time"}}};
const esquemaCanalIntegracao={type:"object",required:["codigo","nome","tipo"],additionalProperties:false,properties:{codigo:{type:"string",minLength:1,maxLength:80},nome:{type:"string",minLength:2,maxLength:240},tipo:{enum:["contabil","bancaria","oficial","webhook","arquivo"]},direcao:{enum:["entrada","saida","bidirecional"]},configuracaoPublica:{type:"object",additionalProperties:true},segredoReferencia:{type:"string",maxLength:500}}};

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

const esquemaUploadDocumento = {
  type: "object", required: ["nomeArquivo", "tipoMime", "tamanhoBytes", "sha256"], additionalProperties: false,
  properties: {
    nomeArquivo: { type: "string", minLength: 1, maxLength: 500 },
    tipoMime: { type: "string", minLength: 1, maxLength: 160 },
    tamanhoBytes: { type: "integer", minimum: 1, maximum: 1073741824 },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
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
  objectStorage = criarArmazenamentoDesabilitado(),
  storageRequired = false,
  corsOrigins = [],
  logger = false,
  jobWorker,
} = {}) {
  if (!repository) throw new Error("O repositório da API é obrigatório.");
  if (typeof authenticate !== "function") throw new Error("O autenticador da API é obrigatório.");
  if (!objectStorage || typeof objectStorage.health !== "function") {
    throw new Error("O provedor de armazenamento de objetos é inválido.");
  }

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
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Request-Id", request.id);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return payload;
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
      versao: "23.0.0",
      armazenamento: repository.tipo,
      banco,
    };
  });

  app.get("/ready", async (_request, reply) => {
    const [banco, storage] = await Promise.all([
      repository.health(),
      objectStorage.health(),
    ]);
    const ok = Boolean(banco?.ok) && (!storageRequired || Boolean(storage?.ok));
    return reply.code(ok ? 200 : 503).send({
      ok,
      servico: "PRUMO API",
      versao: "23.0.0",
      componentes: {
        banco: { ok: Boolean(banco?.ok), tipo: repository.tipo },
        storage: {
          ok: Boolean(storage?.ok),
          tipo: objectStorage.tipo,
          obrigatorio: Boolean(storageRequired),
        },
      },
    });
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

  app.get("/v1/financeiro/centros-custo", async (request) => repository.listarCentrosCustoFinanceiros(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/financeiro/centros-custo", {schema:{body:esquemaCentroCustoFinanceiro}}, async (request,reply) => { const item=await repository.criarCentroCustoFinanceiro(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.get("/v1/financeiro/fontes", async (request) => repository.listarFontesFinanceiras(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/financeiro/fontes", {schema:{body:esquemaFonteFinanceira}}, async (request,reply) => { const item=await repository.criarFonteFinanceira(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.get("/v1/financeiro/orcamentos", async (request) => repository.listarOrcamentosFinanceiros(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.post("/v1/financeiro/orcamentos", {schema:{body:esquemaOrcamentoFinanceiro}}, async (request,reply) => { const item=await repository.criarOrcamentoFinanceiro(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.get("/v1/financeiro/compromissos", async (request) => repository.listarCompromissosFinanceiros(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.get("/v1/financeiro/compromissos/:id", async (request,reply) => { const item=await repository.obterCompromissoFinanceiro(contextoDaRequisicao(request,request.identity),request.params.id); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/financeiro/compromissos", {schema:{body:esquemaCompromissoFinanceiro}}, async (request,reply) => { const item=await repository.criarCompromissoFinanceiro(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/financeiro/compromissos/:id/movimentos", {schema:{body:esquemaMovimentoFinanceiro}}, async (request,reply) => { const item=await repository.registrarMovimentoFinanceiro(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.compromisso.versao}"`); return item; });
  app.post("/v1/financeiro/movimentos/:id/conciliacoes", {schema:{body:esquemaConciliacaoFinanceira}}, async (request,reply) => { const item=await repository.conciliarMovimentoFinanceiro(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.get("/v1/financeiro/resumo", async (request) => repository.obterResumoFinanceiro(contextoDaRequisicao(request,request.identity),request.query||{}));

  app.get("/v1/obras", async (request) => repository.listarObrasCorporativas(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.get("/v1/obras/resumo", async (request) => repository.obterResumoObras(contextoDaRequisicao(request,request.identity)));
  app.get("/v1/obras/:id", async (request,reply) => { const item=await repository.obterObraCorporativa(contextoDaRequisicao(request,request.identity),request.params.id); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/obras", {schema:{body:esquemaObraCorporativa}}, async (request,reply) => { const item=await repository.criarObraCorporativa(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.put("/v1/obras/:id", {schema:{body:esquemaObraCorporativa}}, async (request,reply) => { const item=await repository.atualizarObraCorporativa(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request)); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/obras/:id/decisoes", {schema:{body:esquemaDecisaoObra}}, async (request,reply) => { const item=await repository.decidirObraCorporativa(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.obra.versao}"`); return item; });
  app.post("/v1/obras/:id/cronograma", {schema:{body:esquemaCronogramaObra}}, async (request,reply) => { const item=await repository.adicionarItemCronogramaObra(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.post("/v1/obras/:id/diario", {schema:{body:esquemaDiarioObra}}, async (request,reply) => { const item=await repository.registrarDiarioObra(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.get("/v1/obras/:id/medicoes", async (request) => repository.listarMedicoesObra(contextoDaRequisicao(request,request.identity),request.params.id));
  app.post("/v1/obras/:id/medicoes", {schema:{body:esquemaMedicaoObra}}, async (request,reply) => { const item=await repository.criarMedicaoObra(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/medicoes/:id/decisoes", {schema:{body:esquemaDecisaoMedicao}}, async (request,reply) => { const item=await repository.decidirMedicaoObra(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.medicao.versao}"`); return item; });

  app.get("/v1/manutencao/planos", async (request) => repository.listarPlanosManutencao(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.post("/v1/manutencao/planos", {schema:{body:esquemaPlanoManutencao}}, async (request,reply) => { const item=await repository.criarPlanoManutencao(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.get("/v1/manutencao/chamados", async (request) => repository.listarChamadosManutencao(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.get("/v1/manutencao/chamados/:id", async (request,reply) => { const item=await repository.obterChamadoManutencao(contextoDaRequisicao(request,request.identity),request.params.id); reply.header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/manutencao/chamados", {schema:{body:esquemaChamadoManutencao}}, async (request,reply) => { const item=await repository.criarChamadoManutencao(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/manutencao/chamados/:id/decisoes", {schema:{body:esquemaDecisaoManutencao}}, async (request,reply) => { const item=await repository.decidirChamadoManutencao(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.chamado.versao}"`); return item; });
  app.post("/v1/manutencao/chamados/:id/ordens", {schema:{body:esquemaOrdemManutencao}}, async (request,reply) => { const item=await repository.criarOrdemManutencao(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201).header("ETag",`"${item.versao}"`); return item; });
  app.post("/v1/manutencao/ordens/:id/recursos", {schema:{body:esquemaRecursoManutencao}}, async (request,reply) => { const item=await repository.adicionarRecursoOrdemManutencao(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request)); reply.code(201); return item; });
  app.get("/v1/manutencao/resumo", async (request) => repository.obterResumoManutencao(contextoDaRequisicao(request,request.identity)));

  app.get("/v1/convenios",async(request)=>repository.listarConvenios(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.get("/v1/convenios/resumo",async(request)=>repository.obterResumoConvenios(contextoDaRequisicao(request,request.identity)));
  app.get("/v1/convenios/:id",async(request,reply)=>{const item=await repository.obterConvenio(contextoDaRequisicao(request,request.identity),request.params.id);reply.header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/convenios",{schema:{body:esquemaConvenio}},async(request,reply)=>{const item=await repository.criarConvenio(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201).header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/convenios/:id/decisoes",{schema:{body:esquemaDecisaoConvenio}},async(request,reply)=>{const item=await repository.decidirConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request));reply.header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/convenios/:id/metas",{schema:{body:esquemaMetaConvenio}},async(request,reply)=>{const item=await repository.adicionarMetaConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.post("/v1/convenios/:id/repasses",{schema:{body:esquemaRepasseConvenio}},async(request,reply)=>{const item=await repository.registrarRepasseConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.post("/v1/convenios/:id/execucoes",{schema:{body:esquemaExecucaoConvenio}},async(request,reply)=>{const item=await repository.registrarExecucaoConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.post("/v1/convenios/:id/prestacoes",{schema:{body:esquemaPrestacaoConvenio}},async(request,reply)=>{const item=await repository.criarPrestacaoConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201).header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/convenios/prestacoes/:id/decisoes",{schema:{body:esquemaDecisaoPrestacao}},async(request,reply)=>{const item=await repository.decidirPrestacaoConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,versaoIfMatch(request),chaveIdempotencia(request));reply.header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/convenios/:id/diligencias",{schema:{body:esquemaDiligenciaConvenio}},async(request,reply)=>{const item=await repository.criarDiligenciaConvenio(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201);return item;});

  app.get("/v1/regularidade/requisitos",async(request)=>repository.listarRequisitosCompliance(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.post("/v1/regularidade/requisitos",{schema:{body:esquemaRequisitoCompliance}},async(request,reply)=>{const item=await repository.criarRequisitoCompliance(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201).header("ETag",`"${item.versao}"`);return item;});
  app.get("/v1/regularidade/riscos",async(request)=>repository.listarRiscosCompliance(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/regularidade/riscos",{schema:{body:esquemaRiscoCompliance}},async(request,reply)=>{const item=await repository.criarRiscoCompliance(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201).header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/regularidade/riscos/:id/acoes",{schema:{body:esquemaAcaoCompliance}},async(request,reply)=>{const item=await repository.criarAcaoCompliance(contextoDaRequisicao(request,request.identity),request.params.id,request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.post("/v1/regularidade/auditorias",{schema:{body:esquemaAuditoriaCompliance}},async(request,reply)=>{const item=await repository.registrarAuditoriaCompliance(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.get("/v1/regularidade/transparencia",async(request)=>repository.listarPublicacoesTransparencia(contextoDaRequisicao(request,request.identity),request.query||{}));
  app.post("/v1/regularidade/transparencia",{schema:{body:esquemaPublicacaoTransparencia}},async(request,reply)=>{const item=await repository.criarPublicacaoTransparencia(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201).header("ETag",`"${item.versao}"`);return item;});
  app.post("/v1/regularidade/transparencia/:id/publicacao",async(request,reply)=>{const item=await repository.publicarTransparencia(contextoDaRequisicao(request,request.identity),request.params.id,versaoIfMatch(request));reply.header("ETag",`"${item.versao}"`);return item;});
  app.get("/v1/regularidade/resumo",async(request)=>repository.obterResumoCompliance(contextoDaRequisicao(request,request.identity)));

  app.get("/v1/bi/executivo",async(request)=>repository.obterPainelExecutivo(contextoDaRequisicao(request,request.identity)));
  app.get("/v1/relatorios/definicoes",async(request)=>repository.listarDefinicoesRelatorios(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/relatorios/definicoes",{schema:{body:esquemaDefinicaoRelatorio}},async(request,reply)=>{const item=await repository.criarDefinicaoRelatorio(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.get("/v1/portais/acessos",async(request)=>repository.listarAcessosPortais(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/portais/acessos",{schema:{body:esquemaAcessoPortal}},async(request,reply)=>{const item=await repository.criarAcessoPortal(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201).header("Cache-Control","no-store");return item;});
  app.post("/v1/portais/acessos/:id/revogacao",async(request)=>repository.revogarAcessoPortal(contextoDaRequisicao(request,request.identity),request.params.id,versaoIfMatch(request)));
  app.get("/v1/integracoes/canais",async(request)=>repository.listarCanaisIntegracao(contextoDaRequisicao(request,request.identity)));
  app.post("/v1/integracoes/canais",{schema:{body:esquemaCanalIntegracao}},async(request,reply)=>{const item=await repository.criarCanalIntegracao(contextoDaRequisicao(request,request.identity),request.body,chaveIdempotencia(request));reply.code(201);return item;});
  app.get("/v1/operacao/observabilidade",async(request)=>repository.obterObservabilidade(contextoDaRequisicao(request,request.identity)));
  app.get("/v1/operacao/prontidao",async(request)=>{
    const contexto=contextoDaRequisicao(request,request.identity);
    const [operacao,banco,storage]=await Promise.all([
      repository.obterObservabilidade(contexto),
      repository.health(),
      objectStorage.health(),
    ]);
    const ok=Boolean(banco?.ok)&&(!storageRequired||Boolean(storage?.ok));
    return {
      ok,
      versao:"23.0.0",
      operacao,
      componentes:{
        banco:{ok:Boolean(banco?.ok),tipo:repository.tipo,latenciaMs:banco?.latenciaMs},
        storage:{ok:Boolean(storage?.ok),tipo:objectStorage.tipo,obrigatorio:Boolean(storageRequired)},
        identidade:{ok:true,tipo:"OIDC/JWT ou identidade local controlada"},
      },
      verificadoEm:new Date().toISOString(),
    };
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
  app.post("/v1/documentos/:id/uploads", { schema: { body: esquemaUploadDocumento } }, async (request, reply) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    await repository.prepararUploadDocumento(contexto, request.params.id);
    const upload = await objectStorage.criarUpload({
      tenantId: contexto.tenantId,
      documentoId: request.params.id,
      ...request.body,
    });
    reply.header("Cache-Control", "no-store");
    return upload;
  });
  app.get("/v1/documentos/:id/versoes/:numero/download", async (request, reply) => {
    const contexto = contextoDaRequisicao(request, request.identity);
    const versao = await repository.obterVersaoDocumento(
      contexto, request.params.id, Number(request.params.numero),
    );
    const download = await objectStorage.criarDownload({
      tenantId: contexto.tenantId,
      storageKey: versao.storageKey,
      nomeArquivo: versao.nomeArquivo,
    });
    reply.header("Cache-Control", "no-store");
    return download;
  });
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
    await objectStorage.fechar();
    await repository.fechar();
  });
  return app;
}
