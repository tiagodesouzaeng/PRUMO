import { ApiError } from "../errors.js";

export function truncarFinanceiro(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) {
    throw new ApiError(422, "VALOR_FINANCEIRO_INVALIDO", "Informe um valor financeiro válido.");
  }
  return Math.trunc((numero + Number.EPSILON) * 100) / 100;
}

export function calcularResumoCompromisso(compromisso, movimentos = []) {
  const totais = movimentos.reduce((resumo, movimento) => {
    const valor = truncarFinanceiro(movimento.valor);
    if (movimento.tipo === "liquidacao") {
      resumo.liquidadoBruto += valor;
      resumo.retencoes += truncarFinanceiro(movimento.retencoes);
      resumo.glosas += truncarFinanceiro(movimento.glosas);
    }
    if (movimento.tipo === "pagamento") resumo.pago += valor;
    return resumo;
  }, { liquidadoBruto: 0, retencoes: 0, glosas: 0, pago: 0 });

  const valorTotal = truncarFinanceiro(compromisso.valorTotal);
  const liquidadoLiquido = truncarFinanceiro(totais.liquidadoBruto - totais.retencoes - totais.glosas);
  return {
    ...Object.fromEntries(Object.entries(totais).map(([chave, valor]) => [chave, truncarFinanceiro(valor)])),
    liquidadoLiquido,
    saldoCompromisso: truncarFinanceiro(valorTotal - totais.liquidadoBruto),
    saldoAPagar: truncarFinanceiro(liquidadoLiquido - totais.pago),
  };
}

export function aplicarMovimentoFinanceiro(compromisso, movimentos, dados) {
  const tipo = dados.tipo;
  const resumo = calcularResumoCompromisso(compromisso, movimentos);
  const valor = truncarFinanceiro(dados.valor);
  const retencoes = truncarFinanceiro(dados.retencoes);
  const glosas = truncarFinanceiro(dados.glosas);

  if (!['reserva', 'compromisso', 'liquidacao', 'pagamento', 'cancelamento'].includes(tipo)) {
    throw new ApiError(422, "TIPO_MOVIMENTO_FINANCEIRO_INVALIDO", "O movimento não pertence ao fluxo financeiro.");
  }
  if (tipo !== "cancelamento" && valor <= 0) {
    throw new ApiError(422, "VALOR_FINANCEIRO_INVALIDO", "O movimento financeiro deve possuir valor positivo.");
  }

  let statusNovo = compromisso.status;
  if (tipo === "reserva") {
    if (compromisso.status !== "rascunho") throw new ApiError(422, "RESERVA_FINANCEIRA_INVALIDA", "Somente compromisso em rascunho pode ser reservado.");
    if (valor !== truncarFinanceiro(compromisso.valorTotal)) throw new ApiError(422, "RESERVA_FINANCEIRA_DIVERGENTE", "A reserva deve corresponder ao valor total do compromisso.");
    statusNovo = "reservado";
  }
  if (tipo === "compromisso") {
    if (!["rascunho", "reservado"].includes(compromisso.status)) throw new ApiError(422, "COMPROMISSO_FINANCEIRO_INVALIDO", "O registro não pode ser comprometido neste estágio.");
    if (valor !== truncarFinanceiro(compromisso.valorTotal)) throw new ApiError(422, "COMPROMISSO_FINANCEIRO_DIVERGENTE", "O valor comprometido deve corresponder ao valor total.");
    statusNovo = "comprometido";
  }
  if (tipo === "liquidacao") {
    if (!["comprometido", "parcialmente_liquidado", "parcialmente_pago"].includes(compromisso.status)) throw new ApiError(422, "LIQUIDACAO_FINANCEIRA_INVALIDA", "Somente compromisso vigente pode ser liquidado.");
    if (valor > resumo.saldoCompromisso) throw new ApiError(422, "LIQUIDACAO_SUPERIOR_AO_SALDO", "A liquidação ultrapassa o saldo do compromisso.");
    if (retencoes < 0 || glosas < 0 || retencoes + glosas > valor) throw new ApiError(422, "DEDUCOES_FINANCEIRAS_INVALIDAS", "Retenções e glosas não podem superar o valor liquidado.");
    statusNovo = valor === resumo.saldoCompromisso ? "liquidado" : "parcialmente_liquidado";
  }
  if (tipo === "pagamento") {
    if (!["liquidado", "parcialmente_liquidado", "parcialmente_pago"].includes(compromisso.status)) throw new ApiError(422, "PAGAMENTO_FINANCEIRO_INVALIDO", "O compromisso não possui valor liquidado disponível para pagamento.");
    if (valor > resumo.saldoAPagar) throw new ApiError(422, "PAGAMENTO_SUPERIOR_AO_LIQUIDADO", "O pagamento ultrapassa o saldo líquido liquidado.");
    statusNovo = valor === resumo.saldoAPagar && resumo.saldoCompromisso === 0 ? "pago" : "parcialmente_pago";
  }
  if (tipo === "cancelamento") {
    if (resumo.liquidadoBruto > 0 || resumo.pago > 0 || !["rascunho", "reservado", "comprometido"].includes(compromisso.status)) {
      throw new ApiError(422, "CANCELAMENTO_FINANCEIRO_INVALIDO", "Não é possível cancelar um compromisso com execução financeira.");
    }
    if (String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa do cancelamento.");
    statusNovo = "cancelado";
  }

  return { tipo, valor, retencoes, glosas, statusNovo, resumoAnterior: resumo };
}

export function validarLimiteOrcamentario(orçamento, compromissos, valor, ignorarId = "") {
  const consumido = compromissos
    .filter((item) => item.budgetId === orçamento.id && item.id !== ignorarId && item.status !== "cancelado")
    .reduce((total, item) => total + Number(item.valorTotal || 0), 0);
  const disponivel = truncarFinanceiro(Number(orçamento.valorAtual || 0) - consumido);
  if (truncarFinanceiro(valor) > disponivel) {
    throw new ApiError(422, "LIMITE_ORCAMENTARIO_EXCEDIDO", "O compromisso ultrapassa o saldo disponível do orçamento financeiro.");
  }
  return { consumido: truncarFinanceiro(consumido), disponivel };
}
