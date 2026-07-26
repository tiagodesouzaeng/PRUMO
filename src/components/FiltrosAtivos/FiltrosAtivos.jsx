/* =========================================================
   RELEASE........: v6.2.0 RC1
   ARQUIVO........: src/components/FiltrosAtivos/FiltrosAtivos.jsx
   DESCRIÇÃO......: Barra compacta de filtros ativos do Painel PPCI,
                    incluindo pendência de qualidade cadastral e alerta operacional.
========================================================= */

import React from "react";

function rotuloValor(valor) {
  if (!valor) return "";
  if (typeof valor === "object") return valor.label ?? valor.id ?? "Filtro aplicado";
  return valor;
}

export default function FiltrosAtivos({
  filtro,
  filtroStatus,
  filtroSituacao,
  filtroCategoria,
  filtroResponsavel,
  filtroUnidade,
  filtroQualidade,
  filtroAlerta,
  setFiltro,
  setFiltroStatus,
  setFiltroSituacao,
  setFiltroCategoria,
  setFiltroResponsavel,
  setFiltroUnidade,
  setFiltroQualidade,
  setFiltroAlerta,
  onLimpar,
}) {
  const filtros = [
    {
      id: "busca",
      rotulo: "Busca",
      valor: filtro,
      limpar: () => setFiltro(""),
    },
    {
      id: "status",
      rotulo: "Status",
      valor: filtroStatus,
      limpar: () => setFiltroStatus(""),
    },
    {
      id: "situacao",
      rotulo: "Situação",
      valor: filtroSituacao,
      limpar: () => setFiltroSituacao(""),
    },
    {
      id: "categoria",
      rotulo: "Categoria",
      valor: filtroCategoria,
      limpar: () => setFiltroCategoria(""),
    },
    {
      id: "responsavel",
      rotulo: "Responsável",
      valor: filtroResponsavel,
      limpar: () => setFiltroResponsavel(""),
    },
    {
      id: "unidade",
      rotulo: "Unidade",
      valor: filtroUnidade,
      limpar: () => setFiltroUnidade(""),
    },
    {
      id: "qualidade",
      rotulo: "Pendência",
      valor: filtroQualidade,
      limpar: () => setFiltroQualidade(null),
    },
    {
      id: "alerta",
      rotulo: "Alerta",
      valor: filtroAlerta,
      limpar: () => setFiltroAlerta(null),
    },
  ]
    .map((item) => ({
      ...item,
      valorFormatado: rotuloValor(item.valor),
    }))
    .filter((item) => item.valorFormatado);

  if (!filtros.length) return null;

  return (
    <section className="filtros-ativos-painel" aria-label="Filtros ativos">
      <div className="filtros-ativos-header">
        <span>Filtros ativos</span>
        <strong>{filtros.length}</strong>
      </div>

      <div className="filtros-ativos-lista">
        {filtros.map((item) => (
          <button
            key={item.id}
            type="button"
            className="filtro-ativo-chip"
            onClick={item.limpar}
            title={`Remover filtro: ${item.rotulo}`}
          >
            <span className="filtro-ativo-rotulo">{item.rotulo}</span>
            <span className="filtro-ativo-valor">{item.valorFormatado}</span>
            <span className="filtro-ativo-remover" aria-hidden="true">
              ×
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="filtros-ativos-limpar"
        onClick={onLimpar}
      >
        Limpar todos
      </button>
    </section>
  );
}
