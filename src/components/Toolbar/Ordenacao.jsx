/* =========================================================
   RELEASE........: v6.4.0 RC1
   COMPONENTE.....: Ordenacao
   CAMINHO........: src/components/Toolbar/Ordenacao.jsx
========================================================= */

import React from "react";

export default function Ordenacao({
  ordenacao,
  setOrdenacao
}) {

  return (
    <div className="grupo-filtro toolbar-item">

      <label className="titulo-filtro">
        ⇅ Ordenar por
      </label>

      <select
        className="campo-categoria"
        value={ordenacao}
        onChange={(e) => setOrdenacao(e.target.value)}
      >
        <option value="risco_operacional">Risco operacional</option>
        <option value="prioridade">Prioridade</option>
        <option value="vencimento">Vencimento</option>
        <option value="predio">Prédio</option>
        <option value="responsavel">Responsável</option>
      </select>

    </div>
  );

}
