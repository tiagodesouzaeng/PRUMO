/* =====================================================
   RELEASE........: v7.5 + v7.6 RC1
   ARQUIVO........: src/pages/Relatorios.jsx
   DESCRIÇÃO......: Central visual de relatórios do SIGIU.
===================================================== */

const RELATORIOS = [
  {
    grupo: "PPCI",
    itens: [
      { titulo: "Listagem atual", detalhe: "Exportação operacional por filtros aplicados", status: "Disponível" },
      { titulo: "Alertas operacionais", detalhe: "Prazos, vencidos, críticos e sem responsável", status: "Disponível" },
      { titulo: "Ranking de risco", detalhe: "Score operacional dos PPCIs", status: "Disponível" },
    ],
  },
  {
    grupo: "Consumo Hídrico",
    itens: [
      { titulo: "Leituras mensais", detalhe: "Consumo por poço, hidrômetro e unidade", status: "Previsto" },
      { titulo: "Anomalias de consumo", detalhe: "Variações acima da média e alertas", status: "Previsto" },
    ],
  },
  {
    grupo: "Obras e Manutenção",
    itens: [
      { titulo: "Obras em andamento", detalhe: "Cronograma, progresso, status e marcos", status: "Previsto" },
      { titulo: "Ordens de serviço", detalhe: "Backlog, prioridade e atendimento", status: "Previsto" },
    ],
  },
];

function RelatorioItem({ item }) {
  const disponivel = item.status === "Disponível";
  return (
    <article className={`sigiu-relatorios-item ${disponivel ? "is-disponivel" : "is-previsto"}`}>
      <div>
        <strong>{item.titulo}</strong>
        <small>{item.detalhe}</small>
      </div>
      <span>{item.status}</span>
    </article>
  );
}

export default function Relatorios({ dadosPPCI }) {
  const totalPPCI = dadosPPCI?.ppcis?.length || 0;

  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-relatorios">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div>
          <span className="sigiu-page-eyebrow">Central SIGIU</span>
          <h1>Relatórios</h1>
          <p>
            Área preparada para consolidar exportações e indicadores executivos por módulo.
          </p>
        </div>
        <div className="sigiu-page-heading__meta">
          <strong>{totalPPCI}</strong>
          <span>PPCIs na base atual</span>
        </div>
      </div>

      <div className="sigiu-module-kpis">
        <article className="sigiu-module-kpi sigiu-module-kpi--primary">
          <span>CSV</span>
          <small>Relatórios PPCI</small>
          <strong>3</strong>
          <em>disponíveis no módulo PPCI</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--info">
          <span>▦</span>
          <small>Módulos previstos</small>
          <strong>4</strong>
          <em>hídrico, obras, manutenção e alertas</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--warning">
          <span>⌛</span>
          <small>Integrações futuras</small>
          <strong>Push</strong>
          <em>redução da dependência de planilhas</em>
        </article>
        <article className="sigiu-module-kpi sigiu-module-kpi--success">
          <span>✓</span>
          <small>Estrutura</small>
          <strong>OK</strong>
          <em>central pronta para expansão</em>
        </article>
      </div>

      <div className="sigiu-relatorios-modulos">
        {RELATORIOS.map((grupo) => (
          <section key={grupo.grupo} className="sigiu-card sigiu-relatorios-grupo">
            <header className="sigiu-card-header-row">
              <div>
                <h2>{grupo.grupo}</h2>
                <p>Relatórios e exportações do módulo.</p>
              </div>
            </header>
            <div className="sigiu-relatorios-lista">
              {grupo.itens.map((item) => <RelatorioItem key={item.titulo} item={item} />)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
