/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: AbaProcesso.jsx
========================================================= */

import React from "react";

export default function AbaProcesso({

    ppci,

    textoOuPadrao

}) {

    return (

        <div className="aba-processo">

            <div className="modal-grid">

                <Campo
                    titulo="Número do PPCI"
                    valor={ppci?.["Número do PPCI / Processo CBMRS"]}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Processo CBMRS"
                    valor={ppci?.["Número do PPCI / Processo CBMRS"]}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Categoria"
                    valor={ppci?.Categoria}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Status Atual"
                    valor={ppci?.["Status / Situação"]}
                    textoOuPadrao={textoOuPadrao}
                />

            </div>

            <section className="modal-secao">

                <h4>Observações</h4>

                <p>

                    {textoOuPadrao(
                        ppci?.["Descrição / Itens"]
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