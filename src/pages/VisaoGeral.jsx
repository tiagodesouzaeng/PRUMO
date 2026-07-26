/* =====================================================
   RELEASE........: v7.4.0 RC1
   ARQUIVO........: src/pages/VisaoGeral.jsx
   DESCRIÇÃO......: Dashboard geral do SIGIU, pronto para múltiplos módulos
===================================================== */

import PainelFeedback from "../components/Feedback/PainelFeedback";
import useAlertasPPCI from "../hooks/useAlertasPPCI";
import useQualidadeDados from "../hooks/useQualidadeDados";
import { PPCI_CAMPOS } from "../domain/ppciCampos";

function formatarNumero(valor) {
  return new Intl.NumberFormat("pt-BR").format(valor || 0);
}

function KpiResumo({ icone, titulo, valor, detalhe, variante = "primary", onClick }) {
  return (
    <button
      type="button"
      className={`sigiu-overview-kpi sigiu-overview-kpi--${variante}`}
      onClick={onClick}
    >
      <span className="sigiu-overview-kpi__icon">{icone}</span>
      <span className="sigiu-overview-kpi__body">
        <small>{titulo}</small>
        <strong>{valor}</strong>
        <em>{detalhe}</em>
      </span>
    </button>
  );
}

function obterAlertasPrioritarios(alertasPPCI) {
  const ids = ["vencido", "critico", "sem_responsavel", "sem_data"];

  return ids
    .flatMap((id) => {
      const alerta = alertasPPCI?.contadores?.[id];
      if (!alerta) return [];

      return (alerta.exemplos || []).map((item) => ({
        alerta,
        item,
      }));
    })
    .slice(0, 3);
}

function obterUnidadesMonitoradas(ppcis = []) {
  const mapa = new Map();

  ppcis.forEach((item) => {
    const unidade = item?.[PPCI_CAMPOS.UNIDADE] || "Unidade não informada";
    const predio = item?.[PPCI_CAMPOS.PREDIO] || "Edificação não informada";
    const chave = `${unidade}__${predio}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        unidade,
        predio,
        totalPPCI: 0,
        alertas: 0,
        atualizado: item?.[PPCI_CAMPOS.DATA_ENTRADA] || "-",
      });
    }

    const registro = mapa.get(chave);
    registro.totalPPCI += 1;

    const vencimento = item?.[PPCI_CAMPOS.DATA_VENCIMENTO];
    if (!vencimento || String(vencimento).trim() === "-") {
      registro.alertas += 1;
    }
  });

  return Array.from(mapa.values()).slice(0, 5);
}

export default function VisaoGeral({ dadosPPCI, onAbrirModulo }) {
  const { ppcis, loading, erro, carregarDados, ultimaAtualizacao } = dadosPPCI;
  const alertasPPCI = useAlertasPPCI(ppcis);
  const qualidade = useQualidadeDados(ppcis);

  const alertasPrioritarios = obterAlertasPrioritarios(alertasPPCI);
  const unidadesMonitoradas = obterUnidadesMonitoradas(ppcis);
  const pendenciasQualidade = qualidade?.totalPendencias || 0;

  const deveExibirConteudo = !loading && !erro && ppcis.length > 0;

  return (
    <section className="sigiu-page sigiu-page-overview">
      <div className="sigiu-page-heading sigiu-page-heading--compact">
        <div>
          <span className="sigiu-page-eyebrow">Visão Geral</span>
          <h1>Plataforma de Inteligência e Gestão</h1>
          <p>Resumo executivo dos módulos do PRUMO com foco em custos, alertas, unidades e prioridades.</p>
        </div>
      </div>

      <PainelFeedback
        loading={loading}
        erro={erro}
        total={ppcis.length}
        onTentarNovamente={carregarDados}
      />

      {deveExibirConteudo && (
        <>
          <div className="sigiu-overview-kpis">
            <KpiResumo
              icone="🛡"
              titulo="PPCIs Ativos"
              valor={formatarNumero(ppcis.length)}
              detalhe="Módulo PPCI"
              variante="primary"
              onClick={() => onAbrirModulo("ppci")}
            />
            <KpiResumo
              icone="⚠"
              titulo="Alertas Críticos"
              valor={formatarNumero(alertasPPCI.totalCriticos)}
              detalhe="Requer atenção"
              variante="danger"
              onClick={() => onAbrirModulo("alertas")}
            />
            <KpiResumo
              icone="💧"
              titulo="Consumo do Mês"
              valor="18,6 mil m³"
              detalhe="Módulo em preparação"
              variante="info"
              onClick={() => onAbrirModulo("hidrico")}
            />
            <KpiResumo
              icone="🏗"
              titulo="Obras em Andamento"
              valor="12"
              detalhe="Módulo em preparação"
              variante="warning"
              onClick={() => onAbrirModulo("obras")}
            />
            <KpiResumo
              icone="▤"
              titulo="Orçamentos Ativos"
              valor="3"
              detalhe="R$ 12,8 milhões"
              variante="primary"
              onClick={() => onAbrirModulo("orcamento")}
            />
          </div>

          <section className="sigiu-overview-alertas sigiu-card">
            <header className="sigiu-card-header-row">
              <div>
                <h2>Alertas e Pendências</h2>
                <p>Prioridades consolidadas dos módulos monitorados.</p>
              </div>
              <button type="button" className="sigiu-link-button" onClick={() => onAbrirModulo("alertas")}>Ver todos ›</button>
            </header>

            <div className="sigiu-alert-tabs">
              <span className="is-active">Críticos <strong>{alertasPPCI.totalCriticos}</strong></span>
              <span>Atenção <strong>{alertasPPCI.totalAtencao}</strong></span>
              <span>Qualidade da Base <strong>{pendenciasQualidade}</strong></span>
            </div>

            <div className="sigiu-alert-list">
              {alertasPrioritarios.length ? (
                alertasPrioritarios.map(({ alerta, item }, index) => (
                  <button
                    type="button"
                    className="sigiu-alert-row"
                    key={`${alerta.id}-${item?.[PPCI_CAMPOS.ID] || index}`}
                    onClick={() => onAbrirModulo("alertas")}
                  >
                    <span className="sigiu-alert-row__icon">⚠</span>
                    <span className="sigiu-alert-row__main">
                      <strong>{alerta.label}</strong>
                      <small>{item?.[PPCI_CAMPOS.PREDIO] || item?.[PPCI_CAMPOS.UNIDADE] || "PPCI sem identificação"}</small>
                    </span>
                    <span className="sigiu-alert-row__meta">
                      <small>Responsável</small>
                      <strong>{item?.[PPCI_CAMPOS.RESPONSAVEL] || "—"}</strong>
                    </span>
                    <span className="sigiu-alert-row__chevron">›</span>
                  </button>
                ))
              ) : (
                <div className="sigiu-empty-inline">Nenhum alerta crítico no momento.</div>
              )}
            </div>
          </section>

          <div className="sigiu-overview-grid">
            <section className="sigiu-card sigiu-overview-unidades">
              <header className="sigiu-card-header-row">
                <div>
                  <h2>Unidades Monitoradas</h2>
                  <p>Resumo de edificações e módulos vinculados.</p>
                </div>
                <button type="button" className="sigiu-link-button" onClick={() => onAbrirModulo("ppci")}>Ver PPCIs ›</button>
              </header>

              <div className="sigiu-unidades-lista">
                {unidadesMonitoradas.map((unidade) => (
                  <button
                    key={`${unidade.unidade}-${unidade.predio}`}
                    type="button"
                    className="sigiu-unidade-row"
                    onClick={() => onAbrirModulo("ppci")}
                  >
                    <span className="sigiu-unidade-row__icon">🏢</span>
                    <span className="sigiu-unidade-row__main">
                      <strong>{unidade.predio}</strong>
                      <small>{unidade.unidade}</small>
                    </span>
                    <span className="sigiu-chip sigiu-chip--primary">PPCI</span>
                    <span className={`sigiu-chip ${unidade.alertas ? "sigiu-chip--warning" : "sigiu-chip--success"}`}>
                      {unidade.alertas ? "Atenção" : "Normal"}
                    </span>
                    <span className="sigiu-unidade-row__alerta">{unidade.alertas}</span>
                    <span className="sigiu-alert-row__chevron">›</span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="sigiu-overview-side">
              <section className="sigiu-card sigiu-widget-mini">
                <header className="sigiu-card-header-row">
                  <div>
                    <h2>Consumo Hídrico</h2>
                    <p>Módulo em preparação</p>
                  </div>
                  <button type="button" className="sigiu-link-button" onClick={() => onAbrirModulo("hidrico")}>Abrir ›</button>
                </header>
                <div className="sigiu-chart-placeholder">
                  <span style={{ height: "38%" }}></span>
                  <span style={{ height: "52%" }}></span>
                  <span style={{ height: "48%" }}></span>
                  <span style={{ height: "62%" }}></span>
                  <span className="is-alert" style={{ height: "86%" }}></span>
                  <span style={{ height: "50%" }}></span>
                  <span style={{ height: "45%" }}></span>
                </div>
              </section>

              <section className="sigiu-card sigiu-widget-mini">
                <header className="sigiu-card-header-row">
                  <div>
                    <h2>Obras em Andamento</h2>
                    <p>Resumo operacional</p>
                  </div>
                  <button type="button" className="sigiu-link-button" onClick={() => onAbrirModulo("obras")}>Abrir ›</button>
                </header>
                <div className="sigiu-obras-mini">
                  <div><strong>Reforma Bloco C</strong><span><i style={{ width: "72%" }}></i></span><small>72%</small></div>
                  <div><strong>Cobertura Ginásio</strong><span><i style={{ width: "45%" }}></i></span><small>45%</small></div>
                  <div><strong>Auditório Central</strong><span><i style={{ width: "20%" }}></i></span><small>20%</small></div>
                </div>
              </section>
            </aside>
          </div>

          <div className="sigiu-overview-update">
            Dados atualizados em {ultimaAtualizacao || "—"}
          </div>
        </>
      )}
    </section>
  );
}
