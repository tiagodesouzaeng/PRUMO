import { ApiError } from "../errors.js";

const TRANSICOES = {
  ativar: { de: ["rascunho"], para: "vigente", permissao: "contratos.gerir" },
  suspender: { de: ["vigente"], para: "suspenso", permissao: "contratos.gerir" },
  reativar: { de: ["suspenso"], para: "vigente", permissao: "contratos.gerir" },
  concluir: { de: ["vigente"], para: "concluido", permissao: "contratos.encerrar" },
  rescindir: { de: ["vigente", "suspenso"], para: "rescindido", permissao: "contratos.encerrar" },
  encerrar: { de: ["concluido", "rescindido"], para: "encerrado", permissao: "contratos.encerrar" },
  cancelar: { de: ["rascunho"], para: "cancelado", permissao: "contratos.encerrar" },
};

export function resolverTransicaoContrato(statusAtual, acao) {
  const regra = TRANSICOES[acao];
  if (!regra) throw new ApiError(422, "ACAO_CONTRATO_INVALIDA", "A decisão não pertence ao fluxo contratual.");
  if (!regra.de.includes(statusAtual)) {
    throw new ApiError(422, "TRANSICAO_CONTRATO_INVALIDA", `A ação ${acao} não é permitida para um contrato ${statusAtual}.`);
  }
  return { statusNovo: regra.para, permissao: regra.permissao };
}

export function validarVigenciaContrato(dataInicio, dataFim) {
  if (!dataInicio || !dataFim || Number.isNaN(Date.parse(dataInicio)) || Number.isNaN(Date.parse(dataFim))) {
    throw new ApiError(422, "VIGENCIA_CONTRATO_INVALIDA", "Informe datas válidas para início e fim da vigência.");
  }
  if (dataFim < dataInicio) throw new ApiError(422, "VIGENCIA_CONTRATO_INVALIDA", "O fim da vigência não pode ser anterior ao início.");
  return { dataInicio, dataFim };
}

export function calcularSaldoContrato(contrato) {
  return Math.round((Number(contrato.valorAtual || contrato.valorInicial || 0) - Number(contrato.valorExecutado || 0)) * 100) / 100;
}

export function calcularAditivoContrato(contrato, dados) {
  const valor = Number(dados.valor || 0);
  const tipo = dados.tipo;
  if (!["valor", "prazo", "prazo_valor", "supressao", "reajuste"].includes(tipo)) {
    throw new ApiError(422, "TIPO_ADITIVO_INVALIDO", "O tipo de aditivo informado é inválido.");
  }
  if (["valor", "prazo_valor", "supressao", "reajuste"].includes(tipo) && valor <= 0) {
    throw new ApiError(422, "VALOR_ADITIVO_INVALIDO", "Informe um valor positivo para o aditivo.");
  }
  const valorAtual = Number(contrato.valorAtual || contrato.valorInicial || 0);
  const novoValor = tipo === "supressao" ? valorAtual - valor : ["valor", "prazo_valor", "reajuste"].includes(tipo) ? valorAtual + valor : valorAtual;
  if (novoValor < Number(contrato.valorExecutado || 0)) {
    throw new ApiError(422, "ADITIVO_INFERIOR_EXECUTADO", "O novo valor do contrato não pode ser inferior ao valor já executado.");
  }
  const novaDataFim = ["prazo", "prazo_valor"].includes(tipo) ? dados.novaDataFim : contrato.dataFim;
  validarVigenciaContrato(contrato.dataInicio, novaDataFim);
  return { novoValor: Math.round(novoValor * 100) / 100, novaDataFim };
}

export const ACOES_CONTRATO = Object.freeze(Object.keys(TRANSICOES));
