/* =========================================================
   RELEASE........: v1.1.0 RC1
   ARQUIVO........: DistribuicaoResponsabilidades.jsx

   RESPONSABILIDADE:
   Exibir a distribuição das responsabilidades.
========================================================= */

import React from "react";

export default function DistribuicaoResponsabilidades({

  mostrar,
  setMostrar,

  responsaveisOrdenados,

  unidadesOrdenadas,

  filtroResponsavel = "",

  filtroUnidade = "",

  aplicarFiltroRapido

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

        <span>
          DISTRIBUIÇÃO DAS RESPONSABILIDADES
        </span>

      </h3>

      {mostrar && (

        <div className="graficos-grid">

          <div className="grafico-card">

            <h4>
              Responsáveis
            </h4>

            {

              responsaveisOrdenados.map(
                ([responsavel, quantidade]) => (

                  <button
                      key={responsavel}
                      type="button"
                      className={`grafico-item ${
                        filtroResponsavel === responsavel ? "ativo" : ""
                      }`}
                      aria-pressed={filtroResponsavel === responsavel}
                      onClick={() =>
                          aplicarFiltroRapido?.(
                              "responsavel",
                              responsavel
                          )
                      }
                  >

                    <span>
                      {responsavel}
                    </span>

                    <strong>
                      {quantidade}
                    </strong>

                  </button>

                )
              )

            }

          </div>

          <div className="grafico-card">

            <h4>
              Unidades
            </h4>

            {

              unidadesOrdenadas.map(
                ([unidade, quantidade]) => (

                  <button
                      key={unidade}
                      type="button"
                      className={`grafico-item ${
                        filtroUnidade === unidade ? "ativo" : ""
                      }`}
                      aria-pressed={filtroUnidade === unidade}
                      onClick={() =>
                          aplicarFiltroRapido?.(
                              "unidade",
                              unidade
                          )
                      }
                  >

                    <span>
                      {unidade}
                    </span>

                    <strong>
                      {quantidade}
                    </strong>

                  </button>

                )
              )

            }

          </div>

        </div>

      )}

    </div>

  );

}