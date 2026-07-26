/* =========================================================
   RELEASE........: v1.1.0 RC1
   ARQUIVO........: src/components/Analises/AnaliseCarteira.jsx

   RESPONSABILIDADE:
   Exibir a análise da carteira PPCI com filtros analíticos
   por Status e Categoria.
========================================================= */

import React from "react";

export default function AnaliseCarteira({
  mostrar,
  setMostrar,

  statusOrdenados = [],
  categoriasOrdenadas = [],

  filtroStatus = "",
  filtroCategoria = "",

  aplicarFiltroRapido,
}) {
  return (
    <div className="secao-painel">
      <h3
        className="secao-titulo titulo-expansivel"
        onClick={() => setMostrar(!mostrar)}
      >
        <span className="icone-expansivel">
          {mostrar ? "▼" : "▶"}
        </span>

        <span>ANÁLISE DA CARTEIRA PPCI</span>
      </h3>

      {mostrar && (
        <div className="graficos-grid">
          {/* ===========================
              STATUS
          ============================ */}

          <div className="grafico-card">
            <h4>Status dos PPCIs</h4>

            {statusOrdenados.map(([status, quantidade]) => (
              <button
                key={status}
                type="button"
                className={`grafico-item ${
                  filtroStatus === status ? "ativo" : ""
                }`}
                aria-pressed={filtroStatus === status}
                onClick={() => {
                  if (aplicarFiltroRapido) {
                    aplicarFiltroRapido("status", status);
                  }
                }}
              >
                <span>{status}</span>
                <strong>{quantidade}</strong>
              </button>
            ))}
          </div>

          {/* ===========================
              CATEGORIAS
          ============================ */}

          <div className="grafico-card">
            <h4>Categorias</h4>

            {categoriasOrdenadas.map(([categoria, quantidade]) => (
              <button
                key={categoria}
                type="button"
                className={`grafico-item ${
                  filtroCategoria === categoria ? "ativo" : ""
                }`}
                aria-pressed={filtroCategoria === categoria}
                onClick={() => {
                  if (aplicarFiltroRapido) {
                    aplicarFiltroRapido("categoria", categoria);
                  }
                }}
              >
                <span>{categoria}</span>
                <strong>{quantidade}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
