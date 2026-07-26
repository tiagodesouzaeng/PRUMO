/* =====================================================
   RELEASE........: v7.5 + v7.6 RC1
   ARQUIVO........: src/pages/Manutencao.jsx
   DESCRIÇÃO......: Estrutura visual do módulo Manutenção.
===================================================== */

const OS_PRIORITARIAS = [
  { titulo: "Vazamento em sanitário", local: "Bloco B · Térreo", status: "Crítico", classe: "danger" },
  { titulo: "Revisão de bomba", local: "Casa de máquinas · Poço 02", status: "Atenção", classe: "warning" },
  { titulo: "Troca de luminárias", local: "Corredor Bloco A", status: "Programado", classe: "info" },
  { titulo: "Inspeção preventiva", local: "Ginásio Poliesportivo", status: "Normal", classe: "success" },
];

function StatusChip({ children, classe = "neutral" }) {
  return <span className={`sigiu-status-chip sigiu-status-chip--${classe}`}>{children}</span>;
}

export default function Manutencao() {
  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-manutencao">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div>
          <span className="sigiu-page-eyebrow">Módulo operacional</span>
          <h1>Manutenção</h1>
          <p>
            Base para ordens de serviço, manutenção preventiva, corretiva, pendências prediais e indicadores de atendimento.
          </p>
        </div>
        <div className="sigiu-page-heading__meta">
          <strong>36</strong>
          <span>OS abertas</span>
        </div>
      </div>

      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--danger">
          <span>!</span>
          <small>Críticas</small>
          <strong>5</strong>
          <em>requerem prioridade</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--warning">
          <span>⌛</span>
          <small>Em atendimento</small>
          <strong>18</strong>
          <em>equipes acionadas</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success">
          <span>✓</span>
          <small>Concluídas</small>
          <strong>42</strong>
          <em>últimos 30 dias</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--primary">
          <span>▣</span>
          <small>Preventivas</small>
          <strong>14</strong>
          <em>programadas</em>
        </article>
      </div>

      <div className="sigiu-module-grid sigiu-module-grid--main-side">
        <section className="sigiu-card sigiu-module-card">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Ordens prioritárias</h2>
              <p>Modelo de fila operacional para integração futura com GLPI ou sistema interno.</p>
            </div>
          </header>

          <div className="sigiu-module-list">
            {OS_PRIORITARIAS.map((item) => (
              <article key={item.titulo} className="sigiu-module-list-row">
                <div>
                  <strong>{item.titulo}</strong>
                  <small>{item.local}</small>
                </div>
                <StatusChip classe={item.classe}>{item.status}</StatusChip>
              </article>
            ))}
          </div>
        </section>

        <section className="sigiu-card sigiu-module-card">
          <header className="sigiu-card-header-row">
            <div>
              <h2>Capacidade operacional</h2>
              <p>Visão sintética para gestão de equipe e backlog.</p>
            </div>
          </header>

          <div className="sigiu-capacidade-lista">
            <article><strong>Predial</strong><span><i style={{ width: "78%" }} /></span><small>78%</small></article>
            <article><strong>Hidráulica</strong><span><i style={{ width: "64%" }} /></span><small>64%</small></article>
            <article><strong>Elétrica</strong><span><i style={{ width: "52%" }} /></span><small>52%</small></article>
            <article><strong>Preventiva</strong><span><i style={{ width: "44%" }} /></span><small>44%</small></article>
          </div>
        </section>
      </div>
    </section>
  );
}
