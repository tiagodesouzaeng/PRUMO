/* =====================================================
   RELEASE........: v7.5 + v7.6 RC1
   ARQUIVO........: src/pages/Obras.jsx
   DESCRIÇÃO......: Estrutura visual do módulo Obras.
===================================================== */

const OBRAS = [
  { nome: "Reforma Bloco C – 3º Andar", detalhe: "Adequações e modernização", progresso: 72, status: "Em andamento", prazo: "30/06/2026", classe: "info" },
  { nome: "Cobertura Ginásio", detalhe: "Substituição de telhas", progresso: 45, status: "Em andamento", prazo: "15/07/2026", classe: "info" },
  { nome: "Auditório Central – AC", detalhe: "Adequações PPCI", progresso: 20, status: "Planejado", prazo: "10/08/2026", classe: "neutral" },
  { nome: "Marquise Prédio 16", detalhe: "Estrutura metálica e ACM", progresso: 64, status: "Atenção", prazo: "28/07/2026", classe: "warning" },
];

function StatusChip({ children, classe = "neutral" }) {
  return <span className={`sigiu-status-chip sigiu-status-chip--${classe}`}>{children}</span>;
}

export default function Obras() {
  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-obras">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div>
          <span className="sigiu-page-eyebrow">Módulo operacional</span>
          <h1>Obras</h1>
          <p>
            Acompanhamento de obras em andamento, cronogramas, medições, status, prazos e riscos executivos.
          </p>
        </div>
        <div className="sigiu-page-heading__meta">
          <strong>12</strong>
          <span>obras em andamento</span>
        </div>
      </div>

      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--primary">
          <span>🏗</span>
          <small>Em andamento</small>
          <strong>12</strong>
          <em>5 próximas da conclusão</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--warning">
          <span>⌛</span>
          <small>Com atenção</small>
          <strong>4</strong>
          <em>prazos ou pendências críticas</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--info">
          <span>▦</span>
          <small>Medições previstas</small>
          <strong>7</strong>
          <em>próximos 30 dias</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success">
          <span>✓</span>
          <small>Concluídas no mês</small>
          <strong>3</strong>
          <em>base demonstrativa</em>
        </article>
      </div>

      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-module-card">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Carteira de obras</h2>
              <p>Prévia visual para futura integração com cronograma, medição e orçamento.</p>
            </div>
            <button type="button" className="sigiu-btn sigiu-btn--outline">Ver todas</button>
          </header>

          <div className="sigiu-obras-lista">
            {OBRAS.map((obra) => (
              <article key={obra.nome} className="sigiu-obra-row">
                <div className="sigiu-obra-row__main">
                  <strong>{obra.nome}</strong>
                  <small>{obra.detalhe}</small>
                </div>
                <div className="sigiu-obra-row__progress">
                  <span><i style={{ width: `${obra.progresso}%` }} /></span>
                  <small>{obra.progresso}%</small>
                </div>
                <StatusChip classe={obra.classe}>{obra.status}</StatusChip>
                <time>{obra.prazo}</time>
              </article>
            ))}
          </div>
        </section>

        <section className="sigiu-card sigiu-module-card">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Próximos marcos</h2>
              <p>Resumo executivo de eventos relevantes.</p>
            </div>
          </header>

          <div className="sigiu-timeline">
            <article><span /> <div><strong>Medição contratual</strong><small>Reforma Bloco C · próxima semana</small></div></article>
            <article><span /> <div><strong>Entrega parcial</strong><small>Cobertura Ginásio · 15/07/2026</small></div></article>
            <article><span /> <div><strong>Revisão de escopo</strong><small>Marquise Prédio 16 · atenção operacional</small></div></article>
          </div>
        </section>
      </div>
    </section>
  );
}
