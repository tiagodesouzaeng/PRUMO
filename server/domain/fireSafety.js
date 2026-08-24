export const NIVEIS_PATRIMONIAIS_PPCI = Object.freeze(["site", "predio", "sala"]);

export function validarLocalPpci(unidade) {
  if (!unidade || !NIVEIS_PATRIMONIAIS_PPCI.includes(unidade.nivel)) {
    throw new Error("O PPCI deve estar vinculado a um Site, Prédio ou Sala válido.");
  }
  if (unidade.status && unidade.status !== "ativo") {
    throw new Error("O local patrimonial selecionado está inativo.");
  }
  return unidade;
}

export function classificarSituacaoPpci(item, referencia = new Date()) {
  if (["cancelado", "dispensado"].includes(item?.status)) return item.status;
  if (!item?.dataValidade) return item?.status || "em_elaboracao";
  const validade = new Date(`${item.dataValidade}T12:00:00Z`);
  const hoje = new Date(referencia);
  hoje.setUTCHours(12, 0, 0, 0);
  const dias = Math.ceil((validade - hoje) / 86400000);
  if (dias < 0) return "vencido";
  if (dias <= 60) return "a_vencer";
  return item?.status === "aprovado" ? "regular" : item?.status || "em_elaboracao";
}

export function resumirPpcis(itens = [], referencia = new Date()) {
  const classificados = itens.map((item) => classificarSituacaoPpci(item, referencia));
  return {
    total: itens.length,
    regulares: classificados.filter((x) => x === "regular").length,
    aVencer: classificados.filter((x) => x === "a_vencer").length,
    vencidos: classificados.filter((x) => x === "vencido").length,
    emTramitacao: classificados.filter((x) => ["em_elaboracao", "protocolado", "em_analise", "exigencia"].includes(x)).length,
  };
}
