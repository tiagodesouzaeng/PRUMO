/* =========================================================
   RELEASE........: v5.7.0 RC1
   ARQUIVO........: src/services/exportQualidadeCSV.js
   DESCRIÇÃO......: Exporta relatórios de pendências e relatório gerencial
                    da saúde da base PPCI
========================================================= */

import { PPCI_CAMPOS } from "../domain/ppciCampos";

function normalizarValor(valor) {
  if (valor === null || valor === undefined) return "";

  return String(valor)
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escaparCSV(valor) {
  const texto = normalizarValor(valor).replace(/"/g, '""');

  if (/[;"\n\r]/.test(texto)) {
    return `"${texto}"`;
  }

  return texto;
}

function baixarCSV(nomeArquivo, linhas = []) {
  if (!linhas.length) return;

  const csv = linhas
    .map((linha) => linha.map(escaparCSV).join(";"))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(link.href);
}

function montarLinhasPendencias(registros = []) {
  const cabecalho = [
    "Nível",
    "Pendência",
    "Campo avaliado",
    "Descrição",
    "ID",
    "Unidade",
    "Prédio / Edificação",
    "Status / Situação",
    "Responsável",
    "Data limite / vencimento PPCI",
    "Número do PPCI / Processo CBMRS",
    "Prioridade",
    "Categoria",
    "Link Processo",
    "Providência / Próximo passo",
    "Observações",
  ];

  const linhas = registros.map((registro) => {
    const item = registro.item || {};

    return [
      registro.nivel || "",
      registro.pendencia || "",
      registro.campo || "",
      registro.descricao || "",
      item[PPCI_CAMPOS.ID] || registro.id || "",
      item[PPCI_CAMPOS.UNIDADE] || registro.unidade || "",
      item[PPCI_CAMPOS.PREDIO] || registro.predio || "",
      item[PPCI_CAMPOS.STATUS] || registro.status || "",
      item[PPCI_CAMPOS.RESPONSAVEL] || registro.responsavel || "",
      item[PPCI_CAMPOS.DATA_VENCIMENTO] || registro.vencimento || "",
      item[PPCI_CAMPOS.PROCESSO] || "",
      item[PPCI_CAMPOS.PRIORIDADE] || "",
      item[PPCI_CAMPOS.CATEGORIA] || "",
      item[PPCI_CAMPOS.LINK_PROCESSO] || "",
      item[PPCI_CAMPOS.PROXIMO_PASSO] || "",
      item[PPCI_CAMPOS.OBSERVACOES] || "",
    ];
  });

  return [cabecalho, ...linhas];
}

function montarLinhasGerenciais(qualidade) {
  const linhas = [
    ["Seção", "Indicador", "Valor 1", "Valor 2", "Valor 3", "Observação"],
    ["Resumo", "PPCIs monitorados", qualidade.total, "", "", ""],
    ["Resumo", "Preenchimento geral", `${qualidade.percentualPreenchimento}%`, "", "", ""],
    ["Resumo", "Campos avaliados por PPCI", qualidade.camposAvaliados, "", "", ""],
    ["Resumo", "Registros completos", qualidade.registrosCompletos, "", "", ""],
    ["Resumo", "Registros com pendência", qualidade.registrosComPendencia, "", "", ""],
    ["Resumo", "Pendências totais", qualidade.totalPendencias, "", "", ""],
    ["Resumo", "Pendências críticas", qualidade.pendenciasCriticas, "", "", ""],
    ["Resumo", "Pendências de atenção", qualidade.pendenciasAtencao, "", "", ""],
    [],
    ["Ranking por unidade", "Unidade", "PPCIs", "PPCIs com pendência", "Pendências", "Saúde"],
  ];

  (qualidade.rankingUnidades || []).forEach((item) => {
    linhas.push([
      "Ranking por unidade",
      item.nome,
      item.total,
      item.registrosComPendencia,
      item.totalPendencias,
      `${item.percentualSaude}%`,
    ]);
  });

  linhas.push([]);
  linhas.push(["Ranking por responsável", "Responsável", "PPCIs", "PPCIs com pendência", "Pendências", "Saúde"]);

  (qualidade.rankingResponsaveis || []).forEach((item) => {
    linhas.push([
      "Ranking por responsável",
      item.nome,
      item.total,
      item.registrosComPendencia,
      item.totalPendencias,
      `${item.percentualSaude}%`,
    ]);
  });

  linhas.push([]);
  linhas.push(["Checklist", "Prioridade", "Pendência", "Campo", "Quantidade", "Ação sugerida"]);

  (qualidade.checklistSaneamento || []).forEach((item) => {
    linhas.push([
      "Checklist",
      item.prioridade,
      item.label,
      item.campo,
      item.quantidade,
      item.acao,
    ]);
  });

  linhas.push([]);
  linhas.push(["Pendências por tipo", "Nível", "Pendência", "Campo", "Quantidade", "% da base"]);

  (qualidade.itens || [])
    .filter((item) => item.quantidade > 0)
    .forEach((item) => {
      linhas.push([
        "Pendências por tipo",
        item.nivel,
        item.label,
        item.campo,
        item.quantidade,
        `${item.percentual}%`,
      ]);
    });

  return linhas;
}

export function exportarQualidadeCSV(registros = [], sufixo = "geral") {
  if (!Array.isArray(registros) || !registros.length) return;

  const data = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `PPCI_qualidade_base_${sufixo}_${data}.csv`;

  baixarCSV(nomeArquivo, montarLinhasPendencias(registros));
}

export function exportarQualidadeGerencialCSV(qualidade) {
  if (!qualidade || !qualidade.total) return;

  const data = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `PPCI_saude_base_gerencial_${data}.csv`;

  baixarCSV(nomeArquivo, montarLinhasGerenciais(qualidade));
}
