/* =========================================================
   RELEASE........: v2.7.0 RC1
   ARQUIVO........: src/components/Toolbar/Toolbar.jsx
   DESCRIÇÃO......: Barra principal de pesquisa, ordenação e ações

   AJUSTE.........: Removido filtro de Categoria da Toolbar.
                    A filtragem por Categoria permanece disponível
                    na seção Análise da Carteira PPCI.
========================================================= */

import React from "react";

import Busca from "./Busca";
import Ordenacao from "./Ordenacao";
import Acoes from "./Acoes";

export default function Toolbar({
  filtro,
  setFiltro,

  ordenacao,
  setOrdenacao,

  onAtualizar,
  onExportar,
  onLimpar,
}) {
  return (
    <div className="toolbar">
      <Busca
        filtro={filtro}
        setFiltro={setFiltro}
      />

      <Ordenacao
        ordenacao={ordenacao}
        setOrdenacao={setOrdenacao}
      />

      <Acoes
        onAtualizar={onAtualizar}
        onExportar={onExportar}
        onLimpar={onLimpar}
      />
    </div>
  );
}
