/* =========================================================
   RELEASE........: v1.0.3 RC1
   ARQUIVO........: src/components/Dashboard/DashboardExecutivo.jsx

   RESPONSABILIDADE:
   Exibir indicadores executivos sem duplicar o filtro de
   Status dos PPCIs, que permanece na Análise da Carteira.
========================================================= */

import React from "react";

export default function DashboardExecutivo({
  vencidos = 0,
  criticos = 0,
  regulares = 0,
  semData = 0,

  maiorSituacao = 1,

  mediaConclusao = 0,

  filtroSituacao,
  setFiltroSituacao,
}) {
  const situacoes = [
    {
      id: "vencidos",
      titulo: "Vencidos",
      quantidade: vencidos,
    },
    {
      id: "criticos",
      titulo: "Críticos",
      quantidade: criticos,
    },
    {
      id: "regulares",
      titulo: "Regulares",
      quantidade: regulares,
    },
    {
      id: "semData",
      titulo: "Sem Data",
      quantidade: semData,
    },
  ];

  const maiorSituacaoSeguro = maiorSituacao || 1;

  return (
    <div className="dashboard-executivo dashboard-executivo-sem-status">
      {/* SITUAÇÃO */}

      <div className="dashboard-coluna">
        <h3>Situação Geral</h3>

        {situacoes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`barra-item ${
              filtroSituacao === item.id ? "ativo" : ""
            }`}
            onClick={() =>
              setFiltroSituacao(
                filtroSituacao === item.id ? "" : item.id
              )
            }
          >
            <div className="barra-header">
              <span>{item.titulo}</span>
              <strong>{item.quantidade}</strong>
            </div>

            <div className="barra-fundo">
              <div
                className="barra-preenchimento"
                style={{
                  width: `${(item.quantidade / maiorSituacaoSeguro) * 100}%`,
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* CONCLUSÃO */}

      <div className="dashboard-conclusao">
        <h3>Conclusão Média</h3>

        <div className="barra-fundo">
          <div
            className="barra-preenchimento"
            style={{
              width: `${mediaConclusao}%`,
            }}
          />
        </div>

        <strong>{mediaConclusao}%</strong>
      </div>
    </div>
  );
}
