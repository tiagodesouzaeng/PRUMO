/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: AbaCronograma.jsx
========================================================= */

import React from "react";

export default function AbaCronograma({

    ppci,

    textoOuPadrao,

    formatarData

}) {

    return (

        <div className="aba-cronograma">

            <div className="modal-grid">

                <Campo
                    titulo="Entrada"
                    valor={formatarData(ppci?.["Data de entrada"])}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Início"
                    valor={formatarData(ppci?.["Data de início Obra/Projeto"])}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Entrega Prevista"
                    valor={formatarData(ppci?.["Data prevista entrega Obra/Projeto"])}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Vencimento PPCI"
                    valor={formatarData(ppci?.["Data limite / vencimento PPCI"])}
                    textoOuPadrao={textoOuPadrao}
                />

            </div>

            <section className="modal-secao">

                <h4>Próximo Passo</h4>

                <p>

                    {textoOuPadrao(
                        ppci?.["Providência / Próximo passo"]
                    )}

                </p>

            </section>

        </div>

    );

}

function Campo({

    titulo,

    valor,

    textoOuPadrao

}) {

    return (

        <div className="campo-modal">

            <label>

                {titulo}

            </label>

            <span>

                {textoOuPadrao(valor)}

            </span>

        </div>

    );

}