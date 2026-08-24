import { ApiError } from "../errors.js";

export function truncarObra(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) throw new ApiError(422, "VALOR_OBRA_INVALIDO", "Informe um valor válido.");
  return Math.trunc((numero + Number.EPSILON) * 100) / 100;
}
export function validarPeriodoObra(inicio, fim, codigo = "PERIODO_OBRA_INVALIDO") {
  if (!inicio || !fim || Number.isNaN(Date.parse(inicio)) || Number.isNaN(Date.parse(fim)) || fim < inicio) {
    throw new ApiError(422, codigo, "Informe um período válido, com término igual ou posterior ao início.");
  }
  return { inicio, fim };
}

const TRANSICOES_OBRA = {
  iniciar: { de: ["planejamento", "suspensa"], para: "em_andamento", permissao: "obras.editar" },
  suspender: { de: ["em_andamento"], para: "suspensa", permissao: "obras.fiscalizar" },
  retomar: { de: ["suspensa"], para: "em_andamento", permissao: "obras.fiscalizar" },
  concluir: { de: ["em_andamento"], para: "concluida", permissao: "obras.fiscalizar" },
  cancelar: { de: ["planejamento", "suspensa"], para: "cancelada", permissao: "obras.editar" },
};

const TRANSICOES_MEDICAO = {
  enviar: { de: ["rascunho"], para: "em_analise", permissao: "medicao.registrar" },
  aprovar: { de: ["em_analise"], para: "aprovada", permissao: "medicao.aprovar" },
  glosar: { de: ["em_analise"], para: "glosada", permissao: "medicao.aprovar" },
  devolver: { de: ["em_analise"], para: "rascunho", permissao: "medicao.aprovar" },
  aceitar: { de: ["aprovada"], para: "aceita", permissao: "medicao.aprovar" },
  cancelar: { de: ["rascunho"], para: "cancelada", permissao: "medicao.registrar" },
};

function resolverTransicao(tabela, statusAtual, acao, codigo) {
  const regra = tabela[acao];
  if (!regra) throw new ApiError(422, codigo, "A ação informada não pertence a este fluxo.");
  if (!regra.de.includes(statusAtual)) throw new ApiError(422, codigo, `A ação ${acao} não é permitida no status ${statusAtual}.`);
  return regra;
}

export function resolverTransicaoObra(statusAtual, acao) {
  return resolverTransicao(TRANSICOES_OBRA, statusAtual, acao, "TRANSICAO_OBRA_INVALIDA");
}

export function resolverTransicaoMedicao(statusAtual, acao) {
  return resolverTransicao(TRANSICOES_MEDICAO, statusAtual, acao, "TRANSICAO_MEDICAO_INVALIDA");
}

export function calcularMedicao(dados, valorDisponivel = Infinity) {
  const valorBruto = truncarObra(dados.valorBruto);
  const retencoes = truncarObra(dados.retencoes);
  const glosas = truncarObra(dados.glosas);
  const multas = truncarObra(dados.multas);
  if (valorBruto <= 0) throw new ApiError(422, "VALOR_MEDICAO_INVALIDO", "A medição deve possuir valor bruto positivo.");
  if ([retencoes, glosas, multas].some((valor) => valor < 0) || retencoes + glosas + multas > valorBruto) {
    throw new ApiError(422, "DEDUCOES_MEDICAO_INVALIDAS", "Retenções, glosas e multas não podem superar o valor bruto.");
  }
  if (valorBruto > truncarObra(valorDisponivel)) {
    throw new ApiError(422, "MEDICAO_SUPERIOR_AO_SALDO", "A medição ultrapassa o saldo físico-financeiro disponível da obra.");
  }
  return { valorBruto, retencoes, glosas, multas, valorLiquido: truncarObra(valorBruto - retencoes - glosas - multas) };
}

export function calcularProgressoObra(obra, medicoes = []) {
  const valorPrevisto = truncarObra(obra.valorPrevisto);
  const valorMedido = truncarObra(medicoes.filter((item) => ["aprovada", "aceita"].includes(item.status)).reduce((total, item) => total + Number(item.valorBruto || 0), 0));
  const progressoFinanceiro = valorPrevisto > 0 ? Math.min(100, Math.trunc((valorMedido / valorPrevisto) * 10000) / 100) : 0;
  return { valorPrevisto, valorMedido, saldoMedir: truncarObra(Math.max(0, valorPrevisto - valorMedido)), progressoFinanceiro };
}
