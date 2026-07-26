/* =========================================================
   RELEASE........: v6.4.0 RC1
   ARQUIVO........: src/hooks/useOrdenacao.js

   RESPONSABILIDADE:
   Ordenar a lista de PPCIs conforme o critério selecionado,
   incluindo risco operacional calculado automaticamente.
========================================================= */

import { useMemo } from "react";

import { PPCI_CAMPOS, PPCI_VALORES_PADRAO } from "../domain/ppciCampos";
import { compararRiscoOperacional } from "../domain/ppciAlertas";

export default function useOrdenacao(
  ppcis = [],
  ordenacao = PPCI_VALORES_PADRAO.ORDENACAO_PADRAO
) {
  return useMemo(() => {
    const lista = [...ppcis];

    lista.sort((a, b) => {
      switch (ordenacao) {
        case "risco_operacional":
          return compararRiscoOperacional(a, b);

        case "prioridade":
          return (
            (Number(a?.[PPCI_CAMPOS.PRIORIDADE]) || 999) -
            (Number(b?.[PPCI_CAMPOS.PRIORIDADE]) || 999)
          );

        case "vencimento":
          return (
            new Date(a?.[PPCI_CAMPOS.DATA_VENCIMENTO] || "2999-12-31") -
            new Date(b?.[PPCI_CAMPOS.DATA_VENCIMENTO] || "2999-12-31")
          );

        case "predio":
          return String(a?.[PPCI_CAMPOS.PREDIO] || "").localeCompare(
            String(b?.[PPCI_CAMPOS.PREDIO] || ""),
            "pt-BR"
          );

        case "responsavel":
          return String(a?.[PPCI_CAMPOS.RESPONSAVEL] || "").localeCompare(
            String(b?.[PPCI_CAMPOS.RESPONSAVEL] || ""),
            "pt-BR"
          );

        default:
          return 0;
      }
    });

    return lista;
  }, [ppcis, ordenacao]);
}
