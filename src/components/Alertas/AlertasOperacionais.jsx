/* =====================================================
   RELEASE........: v6.6.0 RC1
   ARQUIVO........: src/components/Alertas/AlertasOperacionais.jsx
   DESCRIÇÃO......: Painel de alertas operacionais PPCI com exportação CSV
===================================================== */

import React from "react";

function obterClasseNivel(nivel) {
  switch (nivel) {
    case "critico":
      return "alerta-card-critico";
    case "atencao":
      return "alerta-card-atencao";
    case "regular":
      return "alerta-card-regular";
    default:
      return "alerta-card-neutro";
  }
}

export default function AlertasOperacionais({
  alertas,
  filtroAlerta,
  onFiltrarAlerta,
  onExportarAlertas,
  onExportarFiltro,
  onExportarRisco,
}) {
  if (!alertas?.totalPPCIs) return null;

  const filtroAtivoId = filtroAlerta?.id ?? null;

  return (
    <section className="secao-painel alertas-operacionais">
      <div className="alertas-cabecalho">
        <div>
          <h3 className="secao-titulo alertas-titulo">Alertas Operacionais</h3>
          <p className="alertas-subtitulo">
            Controle de prazos, riscos e pendências operacionais dos PPCIs.
          </p>
        </div>

        <div className="alertas-acoes-resumo">
          <div className="alertas-resumo-geral" aria-label="Resumo geral dos alertas">
            <span>
              <strong>{alertas.totalCriticos}</strong>
              críticos
            </span>
            <span>
              <strong>{alertas.totalAtencao}</strong>
              atenção
            </span>
            <span>
              <strong>{alertas.totalRegulares}</strong>
              regulares
            </span>
          </div>

          <div className="alertas-acoes" aria-label="Exportações dos alertas operacionais">
            <button type="button" className="alertas-botao" onClick={onExportarAlertas}>
              CSV alertas
            </button>
            <button type="button" className="alertas-botao" onClick={onExportarRisco}>
              CSV risco
            </button>
            {filtroAtivoId && (
              <button type="button" className="alertas-botao alertas-botao-ativo" onClick={onExportarFiltro}>
                CSV filtro
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="alertas-grid">
        {alertas.cards.map((alerta) => {
          const ativo = filtroAtivoId === alerta.id;

          return (
            <button
              key={alerta.id}
              type="button"
              className={`alerta-card ${obterClasseNivel(alerta.nivel)} ${ativo ? "ativo" : ""}`}
              onClick={() => onFiltrarAlerta?.(alerta)}
              aria-pressed={ativo}
              title={`Filtrar por alerta: ${alerta.label}`}
            >
              <span className="alerta-card-label">{alerta.label}</span>
              <strong className="alerta-card-total">{alerta.total}</strong>
              <small className="alerta-card-descricao">{alerta.descricao}</small>
            </button>
          );
        })}
      </div>

      <p className="alertas-ajuda">
        Clique em um alerta para filtrar a listagem principal. Use os filtros ativos para remover o filtro aplicado.
      </p>
    </section>
  );
}
