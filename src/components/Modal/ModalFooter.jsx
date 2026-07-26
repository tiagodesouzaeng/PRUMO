/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: ModalFooter.jsx
========================================================= */

import React from "react";

export default function ModalFooter({

    setPpciSelecionado

}) {

    return (

        <footer className="modal-footer">

            <button

                className="btn-secundario"

                onClick={() => setPpciSelecionado(null)}

            >

                Fechar

            </button>

            {/*
                RC3

                <button
                    className="btn-primario"
                >

                    Editar

                </button>
            */}

        </footer>

    );

}