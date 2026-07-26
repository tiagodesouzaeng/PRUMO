import { useMemo, useState } from "react";

const ETAPAS = [
  { id: "visao", label: "Visão geral", icon: "⌂" },
  { id: "planilha", label: "Planilha orçamentária", icon: "▤" },
  { id: "bases", label: "Bases e composições", icon: "◫" },
  { id: "cronograma", label: "Cronograma", icon: "◩" },
  { id: "histograma", label: "Histograma", icon: "♙" },
  { id: "medicoes", label: "Medições", icon: "✓" },
  { id: "revisoes", label: "Revisões", icon: "⇄" },
];

const ITENS = [
  { codigo: "1", descricao: "SERVIÇOS PRELIMINARES", tipo: "grupo", total: 284610.42 },
  { codigo: "1.1", descricao: "Administração local da obra", fonte: "Própria · CPU-014", quantidade: 8, unidade: "MÊS", unitario: 35420.88, total: 283367.04 },
  { codigo: "1.2", descricao: "Placa de obra em chapa de aço galvanizado", fonte: "SINAPI · 103689", quantidade: 6, unidade: "M²", unitario: 207.23, total: 1243.38 },
  { codigo: "2", descricao: "FUNDAÇÕES E ESTRUTURAS", tipo: "grupo", total: 1847932.71 },
  { codigo: "2.1", descricao: "Concreto armado para fundações, fck = 30 MPa", fonte: "SINAPI · 96557", quantidade: 428.5, unidade: "M³", unitario: 1268.44, total: 543576.54 },
  { codigo: "2.2", descricao: "Forma para estruturas de concreto em chapa compensada", fonte: "SINAPI · 92431", quantidade: 3842.2, unidade: "M²", unitario: 154.17, total: 592356.97 },
  { codigo: "3", descricao: "INSTALAÇÕES ELÉTRICAS", tipo: "grupo", total: 916487.28 },
  { codigo: "3.1", descricao: "Quadro de distribuição de energia em chapa de aço", fonte: "SINAPI · 101875", quantidade: 18, unidade: "UN", unitario: 2867.41, total: 51613.38 },
];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function CabecalhoSecao({ etapa, setAviso }) {
  const textos = {
    visao: ["Painel do orçamento", "Custos, planejamento e execução em uma visão consolidada."],
    planilha: ["Planilha orçamentária", "EAP, serviços, quantidades, preços unitários e totais da revisão."],
    bases: ["Bases e composições", "Referências SINAPI versionadas, composições próprias e cotações."],
    cronograma: ["Cronograma físico-financeiro", "Distribuição planejada e realizada por período da obra."],
    histograma: ["Histograma de mão de obra", "Equipes projetadas a partir dos coeficientes das composições."],
    medicoes: ["Medições e saldos", "Avanço físico, valor medido, retenções e saldo contratual."],
    revisoes: ["Revisões e cenários", "Histórico imutável, comparativos e fluxo de aprovação."],
  };
  const [titulo, descricao] = textos[etapa];
  return (
    <div className="orc-section-heading">
      <div>
        <span>MÓDULO DE ORÇAMENTOS</span>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </div>
      <div className="orc-heading-actions">
        <button type="button" className="orc-btn orc-btn-ghost" onClick={() => setAviso("Relatório preparado para exportação.")}>⇩ Exportar</button>
        <button type="button" className="orc-btn orc-btn-primary" onClick={() => setAviso("Nova revisão criada a partir da R03.")}>＋ Nova revisão</button>
      </div>
    </div>
  );
}

function Indicadores() {
  return (
    <div className="orc-kpis">
      <article><span>CUSTO DIRETO</span><strong>R$ 4.286.740,18</strong><small className="orc-positive">↗ 3,2% em relação à R02</small></article>
      <article><span>BDI MÉDIO</span><strong>24,73%</strong><small>Obras civis padrão</small></article>
      <article className="orc-kpi-total"><span>PREÇO TOTAL</span><strong>R$ 5.346.911,37</strong><small>R$ 915,57 / m²</small></article>
      <article><span>PENDÊNCIAS</span><strong>7 itens</strong><small className="orc-warning">3 sem preço · 4 para revisar</small></article>
    </div>
  );
}

function TabelaItens({ completa = false }) {
  const linhas = completa ? [...ITENS, ...ITENS.slice(4).map((item, index) => ({ ...item, codigo: `4.${index + 1}` }))] : ITENS.slice(0, 6);
  return (
    <div className="orc-table-wrap">
      <table className="orc-table">
        <thead><tr><th>ITEM</th><th>DESCRIÇÃO / FONTE</th><th>QUANTIDADE</th><th>UN.</th><th>PREÇO UNIT.</th><th>PREÇO TOTAL</th><th /></tr></thead>
        <tbody>
          {linhas.map((item, index) => (
            <tr key={`${item.codigo}-${index}`} className={item.tipo === "grupo" ? "orc-group-row" : ""}>
              <td>{item.tipo === "grupo" && <i>⌄</i>}{item.codigo}</td>
              <td><strong>{item.descricao}</strong>{item.fonte && <small>{item.fonte}</small>}</td>
              <td>{item.quantidade?.toLocaleString("pt-BR") || "—"}</td>
              <td>{item.unidade || ""}</td>
              <td>{item.unitario ? formatarMoeda(item.unitario) : ""}</td>
              <td><strong>{formatarMoeda(item.total)}</strong></td>
              <td><button type="button" aria-label={`Opções do item ${item.codigo}`}>⋮</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisaoGeralOrcamento({ setEtapa }) {
  return (
    <>
      <Indicadores />
      <div className="orc-dashboard-grid">
        <article className="orc-card orc-evolution">
          <header><div><span>EVOLUÇÃO FINANCEIRA</span><h3>Curva do orçamento</h3></div><div className="orc-legend"><i />Planejado <i />Medido</div></header>
          <div className="orc-line-chart">
            <div className="orc-axis"><span>R$ 6 mi</span><span>R$ 4 mi</span><span>R$ 2 mi</span><span>R$ 0</span></div>
            <div className="orc-chart-field"><span className="orc-gridline a" /><span className="orc-gridline b" /><span className="orc-gridline c" /><span className="orc-chart-area" /><span className="orc-chart-line" /></div>
          </div>
          <div className="orc-months">{["Jul","Ago","Set","Out","Nov","Dez","Jan","Fev"].map((mes) => <span key={mes}>{mes}</span>)}</div>
          <footer><div><small>AVANÇO FÍSICO</small><strong>31,8%</strong></div><div><small>VALOR MEDIDO</small><strong>R$ 1.704.684,05</strong></div><div><small>SALDO</small><strong>R$ 3.642.227,32</strong></div></footer>
        </article>
        <article className="orc-card">
          <header><div><span>COMPOSIÇÃO DO CUSTO</span><h3>Distribuição por natureza</h3></div></header>
          <div className="orc-donut-row">
            <div className="orc-donut"><div><strong>R$ 4,28 mi</strong><small>CUSTO DIRETO</small></div></div>
            <div className="orc-cost-list">
              {[["Materiais","53,8%","R$ 2.306.266"],["Mão de obra","31,4%","R$ 1.346.036"],["Equipamentos","9,2%","R$ 394.380"],["Outros","5,6%","R$ 240.058"]].map(([nome,pct,valor], i) => <div key={nome}><i className={`c${i + 1}`} /><span><strong>{nome}</strong><small>{valor}</small></span><b>{pct}</b></div>)}
            </div>
          </div>
        </article>
      </div>
      <article className="orc-card orc-budget-preview">
        <header><div><span>PLANILHA ORÇAMENTÁRIA</span><h3>Principais serviços</h3></div><button type="button" onClick={() => setEtapa("planilha")}>Ver planilha completa →</button></header>
        <TabelaItens />
      </article>
    </>
  );
}

function Planilha({ setAviso }) {
  const [filtro, setFiltro] = useState("");
  return (
    <>
      <Indicadores />
      <article className="orc-card orc-budget-preview">
        <div className="orc-toolbar">
          <label>⌕<input value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="Filtrar item, descrição ou código..." /></label>
          <button type="button">≡ Filtros <span>2</span></button>
          <button type="button" onClick={() => setAviso("Formulário de novo item aberto.")}>＋ Adicionar item</button>
        </div>
        <TabelaItens completa={Boolean(filtro) || true} />
        <footer className="orc-table-footer"><span>142 itens · 8 grupos · 3 pendências de preço</span><strong>Total com BDI: R$ 5.346.911,37</strong></footer>
      </article>
    </>
  );
}

function Bases() {
  const bases = [
    { titulo: "SINAPI RS · 06/2026", detalhe: "Sem desoneração · Versão publicada", registros: "4.876 insumos · 10.454 composições", status: "Ativa" },
    { titulo: "SINAPI RS · 05/2026", detalhe: "Sem desoneração · Versão histórica", registros: "4.862 insumos · 10.419 composições", status: "Histórica" },
    { titulo: "Base corporativa ULBRA", detalhe: "Cotações e composições próprias", registros: "286 insumos · 74 composições", status: "Ativa" },
  ];
  return (
    <div className="orc-bases-grid">
      <section className="orc-card orc-base-list">
        <header><div><span>BASES VERSIONADAS</span><h3>Referências disponíveis</h3></div><button type="button">＋ Importar SINAPI</button></header>
        {bases.map((base) => <article key={base.titulo}><div className="orc-base-icon">◫</div><div><strong>{base.titulo}</strong><span>{base.detalhe}</span><small>{base.registros}</small></div><b className={base.status === "Ativa" ? "is-active" : ""}>{base.status}</b><button type="button">Abrir →</button></article>)}
      </section>
      <aside className="orc-card orc-import-status">
        <header><div><span>ÚLTIMA IMPORTAÇÃO</span><h3>Integridade da base</h3></div></header>
        <div className="orc-quality-score"><strong>99,8%</strong><span>VALIDADA</span></div>
        <ul><li><i>✓</i> Códigos e unidades consistentes</li><li><i>✓</i> Composições sem ciclos</li><li><i>✓</i> Três regimes conciliados</li><li><i>!</i> 7 preços exigem tratamento</li></ul>
        <small>Arquivo oficial preservado com hash SHA-256</small>
      </aside>
    </div>
  );
}

function Cronograma() {
  const meses = ["Jul/26","Ago/26","Set/26","Out/26","Nov/26","Dez/26","Jan/27","Fev/27"];
  const valores = [340,590,790,960,835,650,510,305];
  return (
    <>
      <div className="orc-schedule-kpis"><div><span>VALOR PLANEJADO</span><strong>R$ 5.346.911</strong></div><div><span>AVANÇO PLANEJADO</span><strong>38,4%</strong></div><div><span>AVANÇO REAL</span><strong>31,8%</strong></div><div><span>DESVIO</span><strong className="orc-warning">-6,6 p.p.</strong></div></div>
      <article className="orc-card orc-schedule">
        <header><div><span>DISTRIBUIÇÃO MENSAL</span><h3>Planejado × realizado</h3></div></header>
        <div className="orc-bars">{valores.map((valor, index) => <div key={meses[index]}><span style={{ height: `${valor / 10}px` }}><i style={{ height: `${Math.max(8, valor / 14)}px` }} /></span><small>{meses[index]}</small><b>{formatarMoeda(valor * 1000).replace(",00","")}</b></div>)}</div>
      </article>
    </>
  );
}

function Histograma() {
  const equipes = [
    ["Pedreiro", 18, 24, 28, 25, 14, 8],
    ["Servente", 24, 32, 38, 34, 20, 12],
    ["Eletricista", 2, 4, 8, 14, 18, 10],
    ["Encanador", 1, 3, 7, 12, 16, 9],
  ];
  return (
    <article className="orc-card orc-histogram">
      <header><div><span>MÃO DE OBRA</span><h3>Dimensionamento das equipes</h3></div><strong>Pico: 84 profissionais · Outubro/2026</strong></header>
      <div className="orc-hist-grid">
        <div className="orc-hist-head"><span>FUNÇÃO</span>{["Jul","Ago","Set","Out","Nov","Dez"].map(m => <span key={m}>{m}</span>)}</div>
        {equipes.map(([nome, ...valores]) => <div className="orc-hist-row" key={nome}><strong>{nome}</strong>{valores.map((valor, i) => <span key={i}><i style={{ width: `${Number(valor) * 2.2}%` }} />{valor}</span>)}</div>)}
      </div>
    </article>
  );
}

function Medicoes() {
  const medicoes = [
    ["MED-003","Junho/2026","Em conferência","R$ 612.438,16","11,5%"],
    ["MED-002","Maio/2026","Aprovada","R$ 548.207,30","10,3%"],
    ["MED-001","Abril/2026","Aprovada","R$ 544.038,59","10,2%"],
  ];
  return (
    <>
      <div className="orc-schedule-kpis"><div><span>TOTAL MEDIDO</span><strong>R$ 1.704.684</strong></div><div><span>RETENÇÕES</span><strong>R$ 85.234</strong></div><div><span>SALDO CONTRATUAL</span><strong>R$ 3.642.227</strong></div><div><span>AVANÇO ACUMULADO</span><strong>31,8%</strong></div></div>
      <article className="orc-card orc-measurements">
        <header><div><span>BOLETINS</span><h3>Histórico de medições</h3></div><button type="button">＋ Nova medição</button></header>
        {medicoes.map(([id, periodo,status,valor,avanco]) => <div key={id}><span className="orc-measure-id">{id}</span><span><strong>{periodo}</strong><small>Centro Administrativo Canoas</small></span><b className={status === "Aprovada" ? "approved" : ""}>{status}</b><strong>{valor}</strong><span><strong>{avanco}</strong><small>do contrato</small></span><button type="button">Abrir →</button></div>)}
      </article>
    </>
  );
}

function Revisoes() {
  const revisoes = [
    ["R03","Em elaboração","SINAPI RS 06/2026","R$ 5.346.911,37","+3,2%","Tiago Souza"],
    ["R02","Aprovada","SINAPI RS 05/2026","R$ 5.181.105,04","+1,7%","Marina Alves"],
    ["R01","Substituída","SINAPI RS 04/2026","R$ 5.094.482,66","—","Tiago Souza"],
  ];
  return (
    <article className="orc-card orc-revisions">
      <header><div><span>HISTÓRICO IMUTÁVEL</span><h3>Revisões do orçamento ORC-2026-0042</h3></div><button type="button">Comparar revisões</button></header>
      {revisoes.map(([rev,status,base,total,variacao,autor], index) => <div key={rev} className={index === 0 ? "current" : ""}><span className="orc-rev">{rev}</span><span><strong>{status}</strong><small>{index === 0 ? "Atualizada hoje, 10:42" : "Publicada e preservada"}</small></span><span><small>BASE</small><strong>{base}</strong></span><span><small>PREÇO TOTAL</small><strong>{total}</strong></span><b>{variacao}</b><span><small>RESPONSÁVEL</small><strong>{autor}</strong></span><button type="button">•••</button></div>)}
    </article>
  );
}

export default function Orcamento() {
  const [etapa, setEtapa] = useState("visao");
  const [aviso, setAviso] = useState("");
  const [orcamento, setOrcamento] = useState("ORC-2026-0042");
  const etapaAtual = useMemo(() => ETAPAS.find((item) => item.id === etapa), [etapa]);

  function notificar(mensagem) {
    setAviso(mensagem);
    window.setTimeout(() => setAviso(""), 2400);
  }

  return (
    <section className="sigiu-page orc-page">
      {aviso && <div className="orc-toast" role="status">{aviso}</div>}
      <div className="orc-project-bar">
        <div><span>ORÇAMENTO ATIVO</span><select value={orcamento} onChange={(event) => setOrcamento(event.target.value)}><option value="ORC-2026-0042">ORC-2026-0042 · Centro Administrativo Canoas</option><option value="ORC-2026-0038">ORC-2026-0038 · Reforma Bloco C</option><option value="ORC-2026-0029">ORC-2026-0029 · Cobertura do Ginásio</option></select></div>
        <div><small>REVISÃO</small><strong>R03</strong></div><div><small>STATUS</small><strong className="orc-status">Em elaboração</strong></div><div><small>BASE</small><strong>SINAPI RS · 06/2026</strong></div>
      </div>
      <nav className="orc-module-nav" aria-label="Etapas do orçamento">
        {ETAPAS.map((item) => <button type="button" key={item.id} className={etapa === item.id ? "is-active" : ""} onClick={() => setEtapa(item.id)}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
      <CabecalhoSecao etapa={etapaAtual.id} setAviso={notificar} />
      {etapa === "visao" && <VisaoGeralOrcamento setEtapa={setEtapa} />}
      {etapa === "planilha" && <Planilha setAviso={notificar} />}
      {etapa === "bases" && <Bases />}
      {etapa === "cronograma" && <Cronograma />}
      {etapa === "histograma" && <Histograma />}
      {etapa === "medicoes" && <Medicoes />}
      {etapa === "revisoes" && <Revisoes />}
    </section>
  );
}
