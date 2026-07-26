/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: ModalTabs.jsx
========================================================= */

import React from "react";

const ABAS = [
  { id: "geral", titulo: "Geral" },
  { id: "processo", titulo: "Processo" },
  { id: "cronograma", titulo: "Cronograma" },
  { id: "documentos", titulo: "Documentos" },
  { id: "historico", titulo: "Histórico" }
];

export default function ModalTabs({

    abaAtual,

    setAbaAtual

}) {

    return (

        <nav className="modal-tabs">

            {

                ABAS.map((aba) => (

                    <button

                        key={aba.id}

                        type="button"

                        className={`modal-tab ${
                            abaAtual === aba.id
                                ? "ativa"
                                : ""
                        }`}

                        onClick={() => setAbaAtual(aba.id)}

                    >

                        {aba.titulo}

                    </button>

                ))

            }

        </nav>

    );

}