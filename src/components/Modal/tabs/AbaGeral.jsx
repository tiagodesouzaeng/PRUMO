/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: AbaGeral.jsx

   RESPONSABILIDADE:
   Exibir as principais informações do PPCI.
========================================================= */

import React from "react";

export default function AbaGeral({

    ppci,

    textoOuPadrao

}) {

    return (

        <div className="aba-geral">

            <div className="modal-grid">

                <Campo
                    titulo="ID"
                    valor={ppci?.ID}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Unidade"
                    valor={ppci?.Unidade}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Prédio / Edificação"
                    valor={ppci?.["Prédio / Edificação"]}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Categoria"
                    valor={ppci?.Categoria}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Status"
                    valor={ppci?.["Status / Situação"]}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Responsável"
                    valor={ppci?.Responsável}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Solicitante"
                    valor={ppci?.Solicitante}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="Prioridade"
                    valor={ppci?.Prioridade}
                    textoOuPadrao={textoOuPadrao}
                />

                <Campo
                    titulo="% Conclusão"
                    valor={`${Math.round((ppci?.["% Conclusão"] ?? 0) * 100)} %`}
                    textoOuPadrao={textoOuPadrao}
                />

            </div>

            <section className="modal-secao">

                <h4>Descrição / Itens</h4>

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