/* =========================================================
   RELEASE........: v1.0.0 RC1
   COMPONENTE.....: Categoria
   CAMINHO........: src/components/Toolbar/Categoria.jsx
========================================================= */

import React from "react";

export default function Categoria({
  categorias = [],
  filtroCategoria,
  setFiltroCategoria
}) {

  return (
    <div className="grupo-filtro toolbar-item">

      <label className="titulo-filtro">
        📂 Categoria
      </label>

      <select
        className="campo-categoria"
        value={filtroCategoria}
        onChange={(e) => setFiltroCategoria(e.target.value)}
      >

        <option value="">
          Todas as categorias
        </option>

        {categorias
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((categoria) => (
            <option
              key={categoria}
              value={categoria}
            >
              {categoria}
            </option>
          ))}

      </select>

    </div>
  );

}
