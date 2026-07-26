/* =========================================================
   RELEASE........: v1.1.0 RC1
   ARQUIVO........: src/components/Analises/PainelAnalises.jsx

   RESPONSABILIDADE:
   Agrupar os painéis analíticos complementares do Dashboard.
========================================================= */

import React from "react";

import AnaliseCarteira from "./AnaliseCarteira";
import DistribuicaoResponsabilidades from "./DistribuicaoResponsabilidades";

export default function PainelAnalises({
  mostrarAnalise,
  setMostrarAnalise,

  mostrarResponsabilidades,
  setMostrarResponsabilidades,

  statusOrdenados,
  categoriasOrdenadas,

  responsaveisOrdenados,
  unidadesOrdenadas,

  filtroStatus,
  filtroCategoria,
  filtroResponsavel,
  filtroUnidade,

  aplicarFiltroRapido,
}) {
  return (
    <>
      <AnaliseCarteira
        mostrar={mostrarAnalise}
        setMostrar={setMostrarAnalise}
        statusOrdenados={statusOrdenados}
        categoriasOrdenadas={categoriasOrdenadas}
        filtroStatus={filtroStatus}
        filtroCategoria={filtroCategoria}
        aplicarFiltroRapido={aplicarFiltroRapido}
      />

      <DistribuicaoResponsabilidades
        mostrar={mostrarResponsabilidades}
        setMostrar={setMostrarResponsabilidades}
        responsaveisOrdenados={responsaveisOrdenados}
        unidadesOrdenadas={unidadesOrdenadas}
        filtroResponsavel={filtroResponsavel}
        filtroUnidade={filtroUnidade}
        aplicarFiltroRapido={aplicarFiltroRapido}
      />
    </>
  );
}
