/* =====================================================
   RELEASE........: v2.5.0 RC1
   ARQUIVO........: src/domain/ppciCampos.js
   DESCRIÇÃO......: Constantes dos campos da API/planilha PPCI
===================================================== */

export const PPCI_CAMPOS = Object.freeze({
  ID: "ID",
  UNIDADE: "Unidade",
  PREDIO: "Prédio / Edificação",
  PROCESSO: "Número do PPCI / Processo CBMRS",
  PRIORIDADE: "Prioridade",
  CATEGORIA: "Categoria",
  STATUS: "Status / Situação",
  CONCLUSAO: "% Conclusão",
  DESCRICAO: "Descrição / Itens",
  PROXIMO_PASSO: "Providência / Próximo passo",
  SOLICITANTE: "Solicitante",
  RESPONSAVEL: "Responsável",
  DATA_ENTRADA: "Data de entrada",
  DATA_INICIO: "Data de início Obra/Projeto",
  DATA_ENTREGA: "Data prevista entrega Obra/Projeto",
  DATA_VENCIMENTO: "Data limite / vencimento PPCI",
  LINK_PROCESSO: "Link Processo",
  OBSERVACOES: "Observações",
});

export const PPCI_CAMPOS_CSV = Object.freeze([
  PPCI_CAMPOS.ID,
  PPCI_CAMPOS.UNIDADE,
  PPCI_CAMPOS.PREDIO,
  PPCI_CAMPOS.PROCESSO,
  PPCI_CAMPOS.PRIORIDADE,
  PPCI_CAMPOS.CATEGORIA,
  PPCI_CAMPOS.STATUS,
  PPCI_CAMPOS.CONCLUSAO,
  PPCI_CAMPOS.DESCRICAO,
  PPCI_CAMPOS.PROXIMO_PASSO,
  PPCI_CAMPOS.SOLICITANTE,
  PPCI_CAMPOS.RESPONSAVEL,
  PPCI_CAMPOS.DATA_ENTRADA,
  PPCI_CAMPOS.DATA_INICIO,
  PPCI_CAMPOS.DATA_ENTREGA,
  PPCI_CAMPOS.DATA_VENCIMENTO,
  PPCI_CAMPOS.LINK_PROCESSO,
  PPCI_CAMPOS.OBSERVACOES,
]);

export const PPCI_SITUACOES = Object.freeze({
  VENCIDOS: "vencidos",
  CRITICOS: "criticos",
  REGULARES: "regulares",
  SEM_DATA: "semData",
});

export const PPCI_VALORES_PADRAO = Object.freeze({
  NAO_INFORMADO: "Não informado",
  ORDENACAO_PADRAO: "prioridade",
});
