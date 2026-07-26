/* =========================================================
   RELEASE........: v1.1.0 RC2
   ARQUIVO........: ModalHeader.jsx
========================================================= */

import React from "react";

export default function ModalHeader({

    ppci,

    textoOuPadrao,

    setPpciSelecionado

}) {

    const conclusao = Math.round(
        (ppci?.["% Conclusão"] ?? 0) * 100
    );

    return (

        <header className="modal-header">

            <button

                className="modal-close"

                onClick={() => setPpciSelecionado(null)}

            >

                ✕

            </button>

            <div className="modal-header-topo">

                <div>

                    <h2>

                        {textoOuPadrao(ppci?.ID)}

                    </h2>

                    <h3>

                        {textoOuPadrao(
                            ppci?.["Prédio / Edificação"]
                        )}

                    </h3>

                    <p>

                        {textoOuPadrao(
                            ppci?.Unidade
                        )}

                    </p>

                </div>

                <div className="modal-kpis">

                    <div className="modal-chip status">

                        {textoOuPadrao(
                            ppci?.["Status / Situação"]
                        )}

                    </div>

                    <div className="modal-chip prioridade">

                        Prioridade

                        <strong>

                            {textoOuPadrao(
                                ppci?.Prioridade
                            )}

                        </strong>

                    </div>

                </div>

            </div>

            <div className="modal-progresso">

                <div className="progress-header">

                    <span>

                        Conclusão

                    </span>

                    <strong>

                        {conclusao}%

                    </strong>

                </div>

                <div className="progress-bar">

                    <div

                        className="progress-fill"

                        style={{

                            width: `${conclusao}%`

                        }}

                    />

                </div>

            </div>

        </header>

    );

}