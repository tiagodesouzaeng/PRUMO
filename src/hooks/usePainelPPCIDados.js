/* =====================================================
   RELEASE........: v6.2.0 RC1
   ARQUIVO........: src/hooks/usePainelPPCIDados.js
   DESCRIÇÃO......: Centraliza os dados derivados do Painel PPCI,
                    incluindo filtro por pendência de qualidade cadastral
                    e filtro por alerta operacional
===================================================== */

import { useMemo } from "react";

import useDashboard from "./useDashboard";
import useOrdenacao from "./useOrdenacao";
import usePesquisa from "./usePesquisa";

export default function usePainelPPCIDados(ppcis = [], filtrosPainel = {}) {
  const {
    filtro = "",
    filtroCategoria = "",
    filtroStatus = "",
    filtroSituacao = "",
    filtroResponsavel = "",
    filtroUnidade = "",
    filtroQualidade = null,
    filtroAlerta = null,
    ordenacao = "prioridade",
  } = filtrosPainel;

  const dashboard = useDashboard(ppcis);

  const ppcisOrdenados = useOrdenacao(ppcis, ordenacao);

  const ppcisFiltrados = usePesquisa(
    ppcisOrdenados,
    filtro,
    filtroCategoria,
    filtroStatus,
    filtroSituacao,
    filtroResponsavel,
    filtroUnidade,
    filtroQualidade,
    filtroAlerta
  );

  const categoriasFiltro = useMemo(
    () => dashboard.categoriasOrdenadas.map(([categoria]) => categoria),
    [dashboard.categoriasOrdenadas]
  );

  return {
    dashboard,
    ppcisOrdenados,
    ppcisFiltrados,
    categoriasFiltro,
  };
}
