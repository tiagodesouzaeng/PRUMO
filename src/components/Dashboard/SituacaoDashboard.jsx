/*=========================================================
   RELEASE........: v0.9.1
   COMPONENTE.....: SituacaoDashboard
   CAMINHO........: src/components/Dashboard/
   RESPONSABILIDADE:
   Exibir os indicadores de Situação Geral e permitir
   filtrar os PPCIs através das barras horizontais.

   DEPENDÊNCIAS:
   - App.css
   - barra-item
   - barra-header
   - barra-fundo
   - barra-preenchimento

   STATUS:
   ✔ Arquivo Novo
   ✔ Não altera a lógica do App
   ✔ Não remover código antigo nesta etapa
=========================================================*/

import React from "react";

export default function SituacaoDashboard({

    vencidos,
    criticos,
    regulares,
    semData,

    maiorSituacao,

    filtroSituacao,
    setFiltroSituacao

}) {

    return (

        <div className="dashboard-coluna">
            <h3>
                Situação Geral
            </h3>

            {
                [
                    ["Vencidos", vencidos, "vencidos"],
                    ["Críticos", criticos, "criticos"],
                    ["Regulares", regulares, "regulares"],
                    ["Sem Data", semData, "semData"]
                ].map(
                    ([titulo, quantidade, chave]) => (

                        <div
                            key={chave}
                            className={`barra-item ${
                                filtroSituacao === chave
                                    ? "ativo"
                                    : ""
                            }`}

                            onClick={() =>
                                setFiltroSituacao(
                                    filtroSituacao === chave
                                        ? ""
                                        : chave
                                )
                            }
                        >

                            <div className="barra-header">
                                <span>
                                    {titulo}
                                </span>

                                <strong>
                                    {quantidade}
                                </strong>
                            </div>

                            <div className="barra-fundo">
                                <div
                                    className="barra-preenchimento"
                                    style={{
                                        width: `${
                                            maiorSituacao === 0
                                                ? 0
                                                : (quantidade / maiorSituacao) * 100

                                        }%`
                                    }}
                                />
                            </div>
                        </div>
                    )
                )
            }
        </div>
    );
}