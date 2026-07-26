/* =========================================================
   RELEASE........: v1.0.0 RC1
   COMPONENTE.....: Busca
   CAMINHO........: src/components/Toolbar/Busca.jsx
========================================================= */

import React from "react";

export default function Busca({
  filtro,
  setFiltro
}) {

  return (
    <div className="grupo-filtro toolbar-item toolbar-busca">

      <label className="titulo-filtro">
        🔎 Buscar PPCI
      </label>

      <input
        type="search"
        className="campo-busca"
        placeholder="Pesquisar por prédio, unidade, responsável ou processo..."
        autoComplete="off"
        spellCheck={false}
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />

    </div>
  );

}
