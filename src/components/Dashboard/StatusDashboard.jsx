/*====================================================
RELEASE: v0.9.1
ETAPA: 01
COMPONENTE: StatusDashboard
ARQUIVO: src/components/Dashboard/StatusDashboard.jsx

AÇÃO:
✔ Criar novo arquivo
✔ Não apagar nenhum código existente

RISCO:
🟢 Muito baixo

VALIDAÇÃO:
Aplicação continua compilando normalmente.
====================================================*/

import React from "react";

export default function StatusDashboard({

    statusOrdenados,
    maiorStatus,
    filtroStatus,
    setFiltroStatus

}) {

    return (

        <div className="dashboard-coluna">
            <h3>

                Status dos PPCIs

            </h3>

            {
                statusOrdenados.map(

                    ([status, quantidade]) => (

                        <div
                            key={status}
                            className={`barra-item ${
                                filtroStatus === status
                                    ? "ativo"
                                    : ""
                            }`}

                            onClick={() =>
                                setFiltroStatus(
                                    filtroStatus === status
                                        ? ""
                                        : status
                                )
                            }
                        >

                            <div className="barra-header">
                                <span>
                                    {status}
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
                                            (quantidade / maiorStatus) * 100
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