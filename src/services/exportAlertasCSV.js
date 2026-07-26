/* =========================================================
   RELEASE........: v6.6.0 RC1
   ARQUIVO........: src/services/exportAlertasCSV.js
   DESCRIÇÃO......: Exportação CSV dos alertas operacionais PPCI
========================================================= */

import { PPCI_CAMPOS } from "../domain/ppciCampos";
import {
  calcularScoreOperacionalPPCI,
  compararRiscoOperacional,
  correspondeFiltroAlerta,
  obterAlertasPPCI,
  obterAlertaPrazoPPCI,
  normalizarFiltroAlerta,
  PPCI_ALERTAS,
} from "../domain/ppciAlertas";

function valorCampo(item, campo) {
  const valor = item?.[campo];
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function escaparCSV(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  const normalizado = texto.replace(/\r?\n|\r/g, " ").trim();

  if (
    normalizado.includes(";") ||
    normalizado.includes('"') ||
    normalizado.includes("\n")
  ) {
    return `"${normalizado.replace(/"/g, '""')}"`;
  }

  return normalizado;
}

function baixarCSV(nomeArquivo, cabecalho, linhas) {
  if (!linhas.length) return false;

  const csv = [
    cabecalho.map(escaparCSV).join(";"),
    ...linhas.map((linha) => linha.map(escaparCSV).join(";")),
  ].join("\n");

  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(link.href);
  return true;
}

function dataArquivo() {
  return new Date().toISOString().slice(0, 10);
}

function obterNivelAlertaPrincipal(item) {
  const alertaPrazo = obterAlertaPrazoPPCI(item);
  const alertas = obterAlertasPPCI(item);

  if (alertas.some((alerta) => alerta.id === PPCI_ALERTAS.SEM_RESPONSAVEL.id)) {
    if (
      alertaPrazo.id === PPCI_ALERTAS.REGULAR.id ||
      alertaPrazo.id === PPCI_ALERTAS.ATENCAO.id
    ) {
      return "Sem responsável";
    }
  }

  return alertaPrazo.label;
}

function montarLinhaAlerta(item) {
  const alertaPrazo = obterAlertaPrazoPPCI(item);
  const risco = calcularScoreOperacionalPPCI(item);

  return [
    valorCampo(item, PPCI_CAMPOS.ID),
    valorCampo(item, PPCI_CAMPOS.UNIDADE),
    valorCampo(item, PPCI_CAMPOS.PREDIO),
    valorCampo(item, PPCI_CAMPOS.STATUS),
    valorCampo(item, PPCI_CAMPOS.CATEGORIA),
    valorCampo(item, PPCI_CAMPOS.PRIORIDADE),
    valorCampo(item, PPCI_CAMPOS.RESPONSAVEL),
    valorCampo(item, PPCI_CAMPOS.DATA_VENCIMENTO),
    alertaPrazo.dias === null ? "" : alertaPrazo.dias,
    obterNivelAlertaPrincipal(item),
    alertaPrazo.textoPrazo,
    risco.label,
    risco.score,
    risco.criterios.map((criterio) => criterio.label).join(" | "),
    valorCampo(item, PPCI_CAMPOS.PROXIMO_PASSO),
    valorCampo(item, PPCI_CAMPOS.LINK_PROCESSO),
  ];
}

const CABECALHO_ALERTAS = [
  "ID",
  "Unidade",
  "Prédio / Edificação",
  "Status / Situação",
  "Categoria",
  "Prioridade",
  "Responsável",
  "Data limite / vencimento PPCI",
  "Dias para vencer",
  "Nível de alerta",
  "Situação do prazo",
  "Risco operacional",
  "Score operacional",
  "Critérios de risco",
  "Providência / Próximo passo",
  "Link Processo",
];

function filtrarAlertasOperacionais(ppcis = []) {
  return ppcis.filter((item) => {
    const alertaPrazo = obterAlertaPrazoPPCI(item);
    const alertas = obterAlertasPPCI(item);
    const temSemResponsavel = alertas.some(
      (alerta) => alerta.id === PPCI_ALERTAS.SEM_RESPONSAVEL.id
    );

    return alertaPrazo.id !== PPCI_ALERTAS.REGULAR.id || temSemResponsavel;
  });
}

export function exportarAlertasOperacionaisCSV(ppcis = []) {
  const linhas = filtrarAlertasOperacionais(ppcis)
    .sort(compararRiscoOperacional)
    .map(montarLinhaAlerta);

  return baixarCSV(
    `PPCIs_Alertas_Operacionais_${dataArquivo()}.csv`,
    CABECALHO_ALERTAS,
    linhas
  );
}

export function exportarAlertasFiltradosCSV(ppcis = [], filtroAlerta = null) {
  const filtro = normalizarFiltroAlerta(filtroAlerta);

  if (!filtro) {
    return exportarAlertasOperacionaisCSV(ppcis);
  }

  const linhas = ppcis
    .filter((item) => correspondeFiltroAlerta(item, filtro))
    .sort(compararRiscoOperacional)
    .map(montarLinhaAlerta);

  return baixarCSV(
    `PPCIs_Alerta_${filtro.id}_${dataArquivo()}.csv`,
    CABECALHO_ALERTAS,
    linhas
  );
}

export function exportarRankingRiscoOperacionalCSV(ppcis = []) {
  const linhas = [...ppcis]
    .sort(compararRiscoOperacional)
    .map(montarLinhaAlerta);

  return baixarCSV(
    `PPCIs_Ranking_Risco_Operacional_${dataArquivo()}.csv`,
    CABECALHO_ALERTAS,
    linhas
  );
}
