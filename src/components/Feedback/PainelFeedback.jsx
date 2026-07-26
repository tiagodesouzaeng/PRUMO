/* =========================================================
   RELEASE........: v2.6.0 RC1
   ARQUIVO........: src/components/Feedback/PainelFeedback.jsx
   DESCRIÇÃO......: Feedback visual de carregamento, erro e lista vazia
========================================================= */

import React from "react";

export default function PainelFeedback({
  loading = false,
  erro = null,
  total = 0,
  onTentarNovamente,
}) {
  if (loading) {
    return (
      <section className="painel-feedback painel-feedback-loading">
        <strong>Carregando dados PPCI...</strong>
        <span>Aguarde enquanto a base da planilha é atualizada.</span>
      </section>
    );
  }

  if (erro) {
    return (
      <section className="painel-feedback painel-feedback-erro">
        <strong>Não foi possível carregar os dados PPCI.</strong>
        <span>{erro}</span>

        {onTentarNovamente && (
          <button
            type="button"
            className="painel-feedback-botao"
            onClick={onTentarNovamente}
          >
            Tentar novamente
          </button>
        )}
      </section>
    );
  }

  if (!total) {
    return (
      <section className="painel-feedback painel-feedback-vazio">
        <strong>Nenhum PPCI localizado.</strong>
        <span>Verifique a planilha de origem ou atualize os dados.</span>

        {onTentarNovamente && (
          <button
            type="button"
            className="painel-feedback-botao"
            onClick={onTentarNovamente}
          >
            Atualizar dados
          </button>
        )}
      </section>
    );
  }

  return null;
}
