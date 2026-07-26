/* =====================================================
   RELEASE........: v7.5 + v7.6 RC1
   ARQUIVO........: src/pages/ConsumoHidrico.jsx
   DESCRIÇÃO......: Estrutura visual do módulo Consumo Hídrico
                    preparada para integração futura de leituras,
                    poços, hidrômetros e alertas de consumo.
===================================================== */

const CONSUMO_BARRAS = [62, 66, 64, 70, 72, 68, 76, 74, 71, 78, 82, 88, 79, 92, 74, 70, 67, 73, 81, 86, 114, 77, 72, 69, 71, 75, 78, 74, 70, 68, 72];

const UNIDADES_CONSUMO = [
  { unidade: "Campus Canoas", medicao: "18,6 mil m³", variacao: "-8%", status: "Normal", classe: "success" },
  { unidade: "Bloco C", medicao: "2,9 mil m³", variacao: "+22%", status: "Anomalia", classe: "danger" },
  { unidade: "Ginásio", medicao: "1,7 mil m³", variacao: "+11%", status: "Atenção", classe: "warning" },
  { unidade: "Bloco B", medicao: "1,2 mil m³", variacao: "-3%", status: "Normal", classe: "success" },
];

const ALERTAS_HIDRICOS = [
  { titulo: "Pico de consumo identificado", detalhe: "Bloco C · 23/05 · 114% acima da média", nivel: "Crítico" },
  { titulo: "Leitura pendente", detalhe: "Hidrômetro Poço 02 · última leitura há 3 dias", nivel: "Atenção" },
  { titulo: "Consumo estabilizado", detalhe: "Campus Canoas · tendência abaixo da média mensal", nivel: "Informativo" },
];

function StatusChip({ children, classe = "neutral" }) {
  return <span className={`sigiu-status-chip sigiu-status-chip--${classe}`}>{children}</span>;
}

function BarraConsumo({ valor, index }) {
  const alerta = valor > 100;
  return (
    <span
      className={alerta ? "is-alert" : ""}
      style={{ height: `${Math.max(26, Math.min(valor, 118))}%` }}
      title={`Dia ${String(index + 1).padStart(2, "0")}`}
    />
  );
}

export default function ConsumoHidrico() {
  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-hidrico">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div>
          <span className="sigiu-page-eyebrow">Módulo operacional</span>
          <h1>Consumo Hídrico</h1>
          <p>
            Monitoramento de poços, hidrômetros, leituras diárias, médias de consumo e alertas de anomalia.
          </p>
        </div>
        <div className="sigiu-page-heading__meta">
          <strong>31</strong>
          <span>dias monitorados</span>
        </div>
      </div>

      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--info">
          <span>💧</span>
          <small>Consumo do mês</small>
          <strong>18,6 mil m³</strong>
          <em>8% abaixo do mês anterior</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--danger">
          <span>⚠</span>
          <small>Anomalias</small>
          <strong>3</strong>
          <em>1 ocorrência crítica</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--primary">
          <span>▣</span>
          <small>Hidrômetros</small>
          <strong>24</strong>
          <em>estrutura preparada para integração</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--warning">
          <span>⌁</span>
          <small>Média diária</small>
          <strong>620 m³</strong>
          <em>referência operacional</em>
        </article>
      </div>

      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-module-card sigiu-module-card--chart">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Leituras do mês</h2>
              <p>Prévia visual para futura integração com a planilha de leituras diárias.</p>
            </div>
            <button type="button" className="sigiu-btn sigiu-btn--outline">Ver relatório</button>
          </header>

          <div className="sigiu-hidrico-chart">
            <div className="sigiu-hidrico-chart__legend">
              <span><i className="is-blue" /> Consumo diário</span>
              <span><i className="is-line" /> Média de referência</span>
              <span><i className="is-red" /> Anomalia</span>
            </div>
            <div className="sigiu-hidrico-chart__bars" aria-label="Gráfico de consumo hídrico mensal">
              {CONSUMO_BARRAS.map((valor, index) => (
                <BarraConsumo key={`${valor}-${index}`} valor={valor} index={index} />
              ))}
            </div>
            <div className="sigiu-hidrico-chart__axis">
              <span>01</span><span>08</span><span>15</span><span>23</span><span>31</span>
            </div>
          </div>
        </section>

        <section className="sigiu-card sigiu-module-card">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Alertas hídricos</h2>
              <p>Modelo de priorização para consumos irregulares.</p>
            </div>
          </header>

          <div className="sigiu-module-list">
            {ALERTAS_HIDRICOS.map((alerta) => (
              <article key={alerta.titulo} className="sigiu-module-list-row">
                <div>
                  <strong>{alerta.titulo}</strong>
                  <small>{alerta.detalhe}</small>
                </div>
                <StatusChip classe={alerta.nivel === "Crítico" ? "danger" : alerta.nivel === "Atenção" ? "warning" : "info"}>
                  {alerta.nivel}
                </StatusChip>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="sigiu-card sigiu-module-card">
        <header className="sigiu-card-header-row">
          <div>
            <h2>Unidades com acompanhamento previsto</h2>
            <p>Base visual para ranking futuro por unidade, prédio, poço ou hidrômetro.</p>
          </div>
        </header>

        <div className="sigiu-module-table sigiu-module-table--hidrico">
          {UNIDADES_CONSUMO.map((item) => (
            <article key={item.unidade}>
              <strong>{item.unidade}</strong>
              <span>{item.medicao}</span>
              <small>{item.variacao}</small>
              <StatusChip classe={item.classe}>{item.status}</StatusChip>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
