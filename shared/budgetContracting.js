const STATUS_SOLICITACAO = {
  rascunho: { submeter: "submetida" },
  submetida: { iniciar_analise: "em_analise" },
  em_analise: { aprovar: "aprovada", rejeitar: "rejeitada" },
  aprovada: { converter: "convertida" },
};

export function truncarValorContratual(valor, casas = 2) {
  const fator = 10 ** casas;
  const numero = Number(valor);
  return Math.trunc((numero + Math.sign(numero) * 1e-9) * fator) / fator;
}

export function criarBaseContratada({ orcamentoId, revisaoId = "", processoId = "", contratoId = "", fornecedor, descontoPercentual = 0, justificativa, itens = [], criadoEm = new Date().toISOString() }) {
  const desconto = Number(descontoPercentual);
  if (!orcamentoId) throw new TypeError("O orçamento é obrigatório.");
  if (!String(fornecedor || "").trim()) throw new TypeError("O fornecedor vencedor é obrigatório.");
  if (!Number.isFinite(desconto) || desconto < 0 || desconto >= 100) throw new RangeError("O desconto deve estar entre 0% e menos de 100%.");
  if (String(justificativa || "").trim().length < 3) throw new TypeError("Informe a justificativa da homologação.");
  const fator = 1 - desconto / 100;
  const itensContratados = itens.filter((item) => item.tipo !== "grupo").map((item) => {
    const quantidade = Number(item.quantidade || 0);
    const precoPublicadoUnitario = truncarValorContratual(item.precoPublicadoUnitario ?? item.precoUnitario ?? item.unitario ?? 0, 4);
    const precoContratadoUnitario = truncarValorContratual(precoPublicadoUnitario * fator, 4);
    return { itemId: item.itemId || item.id || "", codigo: String(item.codigo || ""), descricao: String(item.descricao || ""), unidade: String(item.unidade || ""), quantidade, precoPublicadoUnitario, precoContratadoUnitario, totalPublicado: truncarValorContratual(quantidade * precoPublicadoUnitario), totalContratado: truncarValorContratual(quantidade * precoContratadoUnitario) };
  });
  const valorPublicado = truncarValorContratual(itensContratados.reduce((total, item) => total + item.totalPublicado, 0));
  const valorContratado = truncarValorContratual(itensContratados.reduce((total, item) => total + item.totalContratado, 0));
  if (valorPublicado <= 0 || !itensContratados.length) throw new RangeError("A base contratada precisa conter itens com valor publicado.");
  return { orcamentoId, revisaoId, processoId, contratoId, fornecedor: String(fornecedor).trim(), descontoPercentual: desconto, valorPublicado, valorContratado, economia: truncarValorContratual(valorPublicado - valorContratado), justificativa: String(justificativa).trim(), status: "homologada", itens: itensContratados, criadoEm };
}

export function resolverTransicaoSolicitacaoAditivo(status, acao) {
  const para = STATUS_SOLICITACAO[status]?.[acao];
  if (!para) throw new RangeError("A decisão não é permitida neste estágio da solicitação de aditivo.");
  return { de: status, para, permissao: ["aprovar", "rejeitar", "converter", "iniciar_analise"].includes(acao) ? "orcamento.analisar-aditivo" : "obras.solicitar-aditivo" };
}

export function calcularSaldoBaseContratada(base, medicoes = []) {
  const valorMedido = truncarValorContratual(medicoes.filter((item) => !["cancelada", "rejeitada"].includes(item.status)).reduce((total, item) => total + Number(item.valorBruto || item.valorMedido || 0), 0));
  return { valorContratado: truncarValorContratual(base?.valorContratado || 0), valorMedido, saldo: truncarValorContratual(Math.max(0, Number(base?.valorContratado || 0) - valorMedido)) };
}
