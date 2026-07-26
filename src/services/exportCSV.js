/* =========================================================
   RELEASE........: v2.5.0 RC1
   ARQUIVO........: src/services/exportCSV.js
   DESCRIÇÃO......: Exportação CSV completa dos dados PPCI

   OBSERVAÇÃO.....: Os campos exportados são controlados por
                    src/domain/ppciCampos.js.
========================================================= */

import { PPCI_CAMPOS_CSV } from "../domain/ppciCampos";

function normalizarValorCSV(valor) {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor)
    .replace(/\r?\n|\r/g, " ")
    .trim();

  return `"${texto.replace(/"/g, '""')}"`;
}

function gerarNomeArquivo() {
  const data = new Date().toISOString().slice(0, 10);
  return `PPCIs_${data}.csv`;
}

export function exportarCSV(ppcisFiltrados = []) {
  if (!ppcisFiltrados.length) return;

  const cabecalho = PPCI_CAMPOS_CSV.map(normalizarValorCSV).join(";");

  const linhas = ppcisFiltrados.map((item) =>
    PPCI_CAMPOS_CSV.map((campo) => normalizarValorCSV(item?.[campo])).join(";")
  );

  const csv = [cabecalho, ...linhas].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = gerarNomeArquivo();
  link.click();

  URL.revokeObjectURL(url);
}
