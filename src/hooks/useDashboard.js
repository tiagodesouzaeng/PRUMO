/* =========================================================
   RELEASE........: v2.3.0 RC1
   ARQUIVO........: src/hooks/useDashboard.js

   RESPONSABILIDADE:
   Centralizar os indicadores gerenciais do Dashboard PPCI.
========================================================= */

import { useMemo } from "react";

import { PPCI_CAMPOS, PPCI_VALORES_PADRAO } from "../domain/ppciCampos";
import { obterDiasParaVencer } from "../utils/ppciUtils";

export default function useDashboard(ppcis = []) {
  return useMemo(() => {
    const contar = (campo) => {
      const mapa = {};

      ppcis.forEach((item) => {
        const chave = item?.[campo] || PPCI_VALORES_PADRAO.NAO_INFORMADO;
        mapa[chave] = (mapa[chave] || 0) + 1;
      });

      return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    };

    const vencidos = ppcis.filter((item) => {
      const dias = obterDiasParaVencer(item?.[PPCI_CAMPOS.DATA_VENCIMENTO]);
      return dias !== null && dias < 0;
    }).length;

    const criticos = ppcis.filter((item) => {
      const dias = obterDiasParaVencer(item?.[PPCI_CAMPOS.DATA_VENCIMENTO]);
      return dias !== null && dias >= 0 && dias <= 60;
    }).length;

    const semData = ppcis.filter(
      (item) => !item?.[PPCI_CAMPOS.DATA_VENCIMENTO]
    ).length;

    const regulares = Math.max(
      ppcis.length - vencidos - criticos - semData,
      0
    );

    const mediaConclusao = ppcis.length
      ? Math.round(
          (ppcis.reduce(
            (total, item) => total + (Number(item?.[PPCI_CAMPOS.CONCLUSAO]) || 0),
            0
          ) /
            ppcis.length) *
            100
        )
      : 0;

    const statusOrdenados = contar(PPCI_CAMPOS.STATUS);
    const categoriasOrdenadas = contar(PPCI_CAMPOS.CATEGORIA);
    const responsaveisOrdenados = contar(PPCI_CAMPOS.RESPONSAVEL);
    const unidadesOrdenadas = contar(PPCI_CAMPOS.UNIDADE);

    const maiorStatus = Math.max(1, ...statusOrdenados.map(([, quantidade]) => quantidade));
    const maiorSituacao = Math.max(1, vencidos, criticos, regulares, semData);

    return {
      statusOrdenados,
      categoriasOrdenadas,
      responsaveisOrdenados,
      unidadesOrdenadas,
      vencidos,
      criticos,
      regulares,
      semData,
      mediaConclusao,
      maiorStatus,
      maiorSituacao,
    };
  }, [ppcis]);
}
