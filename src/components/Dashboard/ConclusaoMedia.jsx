/* =========================================================
   RELEASE........: v0.9.1
   COMPONENTE.....: ConclusaoMedia
   CAMINHO........: src/components/Dashboard/
   RESPONSABILIDADE:
   Exibir a barra de progresso da conclusão média
   dos PPCIs.

   DEPENDÊNCIAS:
   - App.css
   - resumo-conclusao
   - resumo-titulo
   - progress-bar-geral
   - progress-fill-geral
   - resumo-percentual

   STATUS:
   ✔ Arquivo Novo
   ✔ Não altera a lógica do App
   ✔ Não remover código antigo nesta etapa
========================================================= */

import React from "react";

export default function ConclusaoMedia({

    mediaConclusao

}) {
    return (

        <div className="resumo-conclusao">
            <div className="resumo-titulo">
                CONCLUSÃO MÉDIA GERAL
            </div>

            <div className="progress-bar-geral">
                <div
                    className="progress-fill-geral"
                    style={{
                        width: `${mediaConclusao}%`,
                        background:
                            mediaConclusao < 40
                                ? "#d32f2f"
                                : mediaConclusao < 70
                                    ? "#f9a825"
                                    : "#2e7d32"
                    }}
                />
            </div>

            <div className="resumo-percentual">
                {mediaConclusao}%
            </div>
        </div>
    );
}