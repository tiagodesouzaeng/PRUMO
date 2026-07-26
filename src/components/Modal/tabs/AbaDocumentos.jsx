/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: AbaDocumentos.jsx
========================================================= */

import React from "react";

export default function AbaDocumentos({

    ppci,

    textoOuPadrao

}) {

    const documentos = [

        {
            titulo: "Processo CBMRS",
            campo: "Link Processo CBMRS"
        },

        {
            titulo: "Pasta SharePoint",
            campo: "Link SharePoint"
        },

        {
            titulo: "Projeto PPCI",
            campo: "Link Projeto"
        },

        {
            titulo: "ART / RRT",
            campo: "Link ART"
        },

        {
            titulo: "Alvará",
            campo: "Link Alvará"
        }

    ];

    return (

        <div className="aba-documentos">

            {

                documentos.map((doc) => (

                    <div
                        key={doc.titulo}
                        className="documento-card"
                    >

                        <h4>

                            {doc.titulo}

                        </h4>

                        {

                            ppci?.[doc.campo]

                                ? (

                                    <a

                                        href={ppci[doc.campo]}

                                        target="_blank"

                                        rel="noreferrer"

                                    >

                                        Abrir documento

                                    </a>

                                )

                                : (

                                    <span>

                                        Documento não informado

                                    </span>

                                )

                        }

                    </div>

                ))

            }

        </div>

    );

}