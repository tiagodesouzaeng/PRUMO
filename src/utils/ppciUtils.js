/* =========================================================
   RELEASE........: v1.0.0 RC1
   ARQUIVO........: src/utils/ppciUtils.js
========================================================= */

export function formatarData(data) {
  if (!data) return "-";
  const dataObj = new Date(data);
  if (Number.isNaN(dataObj.getTime())) return "-";
  return dataObj.toLocaleDateString("pt-BR");
}

export function textoOuPadrao(valor, padrao = "Não informado") {
  if (valor === null || valor === undefined) return padrao;
  if (String(valor).trim() === "") return padrao;
  return valor;
}

export function obterDiasParaVencer(dataVencimento) {
  if (!dataVencimento) return null;

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  const vencimento = new Date(dataVencimento);
  vencimento.setHours(0,0,0,0);

  return Math.ceil((vencimento - hoje) / 86400000);
}

export function obterClasseVencimento(dataVencimento) {

  if (!dataVencimento) return "vencimento-sem-data";

  const dias = obterDiasParaVencer(dataVencimento);

  if (dias < 0) return "vencimento-vencido";
  if (dias <= 60) return "vencimento-critico";
  if (dias <= 180) return "vencimento-atencao";

  return "vencimento-ok";
}
