export const TIPOS_TRABALHO = Object.freeze([
  "sistema.diagnostico",
  "catalogo.importar",
  "orcamento.recalcular",
  "integracao.sincronizar",
]);

export function validarSolicitacaoTrabalho(dados = {}) {
  const erros = [];
  if (!TIPOS_TRABALHO.includes(dados.tipo)) erros.push("Tipo de trabalho não suportado.");
  if (!dados.payload || typeof dados.payload !== "object" || Array.isArray(dados.payload)) {
    erros.push("O trabalho exige um payload válido.");
  }
  if (dados.tipo === "catalogo.importar") {
    if (!dados.payload?.publicacaoId) erros.push("Informe a publicação do catálogo.");
    if (!Array.isArray(dados.payload?.itens) || dados.payload.itens.length === 0) {
      erros.push("Informe os itens que serão importados.");
    }
  }
  if (dados.tipo === "orcamento.recalcular" && !dados.payload?.orcamentoId) {
    erros.push("Informe o orçamento que será recalculado.");
  }
  if (dados.tipo === "integracao.sincronizar" && !dados.payload?.integracaoId) {
    erros.push("Informe a integração que será sincronizada.");
  }
  return { valido: erros.length === 0, erros };
}

export function resumirRecalculoOrcamento(orcamento) {
  const itens = Array.isArray(orcamento?.dados?.itens) ? orcamento.dados.itens : [];
  const servicos = itens.filter((item) => item.tipo !== "grupo");
  const custoDireto = servicos.reduce(
    (total, item) => total + (Number(item.quantidade) || 0) * (Number(item.unitario) || 0),
    0,
  );
  return {
    orcamentoId: orcamento?.id || "",
    itens: servicos.length,
    custoDireto,
    processadoEm: new Date().toISOString(),
  };
}
