import { ApiError } from "../errors.js";

const TRANSICOES = {
  enviar_analise: { de: ["rascunho", "rejeitada"], para: "em_analise", permissao: "planejamento.editar" },
  priorizar: { de: ["em_analise"], para: "priorizada", permissao: "planejamento.priorizar" },
  aprovar: { de: ["priorizada"], para: "aprovada", permissao: "planejamento.aprovar" },
  rejeitar: { de: ["em_analise", "priorizada"], para: "rejeitada", permissao: "planejamento.aprovar" },
  reabrir: { de: ["rejeitada"], para: "em_analise", permissao: "planejamento.editar" },
  incorporar: { de: ["aprovada"], para: "incorporada", permissao: "planejamento.aprovar" },
};

function nota(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.min(5, Math.max(1, numero)) : 3;
}

export function calcularPontuacaoDemanda({ urgencia, impacto, risco, alinhamento } = {}) {
  const pontuacao = (
    nota(urgencia) * 30
    + nota(impacto) * 30
    + nota(risco) * 20
    + nota(alinhamento) * 20
  ) / 5;
  return Math.round(pontuacao * 100) / 100;
}

export function resolverTransicaoDemanda(statusAtual, acao) {
  const regra = TRANSICOES[acao];
  if (!regra) {
    throw new ApiError(422, "ACAO_DEMANDA_INVALIDA", "A decisão informada não pertence ao fluxo de demandas.");
  }
  if (!regra.de.includes(statusAtual)) {
    throw new ApiError(422, "TRANSICAO_DEMANDA_INVALIDA", `A ação ${acao} não é permitida para uma demanda ${statusAtual}.`);
  }
  return { statusNovo: regra.para, permissao: regra.permissao };
}

export const ACOES_DEMANDA = Object.freeze(Object.keys(TRANSICOES));
