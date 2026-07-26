/* =========================================================
   RELEASE........: v4.4.0 RC1
   COMPONENTE.....: Acoes
   CAMINHO........: src/components/Toolbar/Acoes.jsx
   DESCRIÇÃO......: Ações compactas da toolbar com links centralizados
========================================================= */

import React from "react";

import { SIGIU_LINKS } from "../../config/sigiuConfig";

export default function Acoes({
  onLimpar,
  onExportar,
  onAtualizar,
}) {
  const abrirPlanilha = () => {
    if (!SIGIU_LINKS.PLANILHA_PPCI) return;

    window.open(
      SIGIU_LINKS.PLANILHA_PPCI,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="acoes toolbar-item">
      <button
        type="button"
        className="refresh-button refresh-button-secundario"
        onClick={onLimpar}
      >
        Limpar
      </button>

      <button
        type="button"
        className="refresh-button"
        onClick={onExportar}
      >
        CSV
      </button>

      <button
        type="button"
        className="refresh-button"
        onClick={onAtualizar}
      >
        Atualizar
      </button>

      <button
        type="button"
        className="refresh-button refresh-button-planilha"
        onClick={abrirPlanilha}
      >
        Planilha
      </button>
    </div>
  );
}
