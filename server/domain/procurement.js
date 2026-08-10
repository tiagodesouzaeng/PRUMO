import { ApiError } from "../errors.js";

const TRANSICOES = {
  iniciar_planejamento: { de: ["rascunho"], para: "planejamento", permissao: "suprimentos.editar" },
  abrir_pesquisa: { de: ["planejamento"], para: "pesquisa_precos", permissao: "suprimentos.cotar" },
  iniciar_selecao: { de: ["pesquisa_precos"], para: "selecao", permissao: "suprimentos.julgar" },
  aprovar: { de: ["selecao"], para: "aprovada", permissao: "suprimentos.aprovar" },
  devolver: { de: ["planejamento", "pesquisa_precos", "selecao"], para: "rascunho", permissao: "suprimentos.aprovar" },
  cancelar: { de: ["rascunho", "planejamento", "pesquisa_precos", "selecao", "aprovada"], para: "cancelada", permissao: "suprimentos.aprovar" },
  emitir_pedido: { de: ["aprovada"], para: "pedido_emitido", permissao: "suprimentos.aprovar" },
  concluir: { de: ["pedido_emitido"], para: "concluida", permissao: "suprimentos.receber" },
};

export function resolverTransicaoContratacao(statusAtual, acao) {
  const regra = TRANSICOES[acao];
  if (!regra) throw new ApiError(422, "ACAO_CONTRATACAO_INVALIDA", "A decisão não pertence ao fluxo de suprimentos.");
  if (!regra.de.includes(statusAtual)) {
    throw new ApiError(422, "TRANSICAO_CONTRATACAO_INVALIDA", `A ação ${acao} não é permitida para um processo ${statusAtual}.`);
  }
  return { statusNovo: regra.para, permissao: regra.permissao };
}

export function validarPesquisaPrecos(cotacoes = []) {
  const validas = cotacoes.filter((item) => item.status !== "desclassificada" && Number(item.valorTotal) > 0);
  if (!validas.length) throw new ApiError(422, "PESQUISA_PRECOS_INSUFICIENTE", "Registre ao menos uma proposta válida antes do julgamento.");
  const valores = validas.map((item) => Number(item.valorTotal)).sort((a, b) => a - b);
  const centro = Math.floor(valores.length / 2);
  const mediana = valores.length % 2 ? valores[centro] : (valores[centro - 1] + valores[centro]) / 2;
  return {
    quantidade: validas.length,
    menor: valores[0],
    maior: valores.at(-1),
    mediana: Math.round(mediana * 100) / 100,
    media: Math.round((valores.reduce((soma, valor) => soma + valor, 0) / valores.length) * 100) / 100,
  };
}

export const ACOES_CONTRATACAO = Object.freeze(Object.keys(TRANSICOES));
