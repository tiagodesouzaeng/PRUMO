import { useMemo, useState } from "react";
import {
  BDI_COMPONENTES_PADRAO,
  calcularBdiDetalhado,
  calcularTotais,
  compararSnapshots,
  totalGrupo,
  totalItem,
  UNIDADES_ORCAMENTARIAS,
  validarOrcamento,
} from "../domain/orcamento";
import useOrcamentos from "../hooks/useOrcamentos";
import { importarPlanilhaOrcamentaria } from "../services/orcamentoImport";

const ETAPAS = [
  { id: "visao", label: "Visão geral", icon: "⌂" },
  { id: "planilha", label: "Planilha orçamentária", icon: "▤" },
  { id: "bdi", label: "BDI e encargos", icon: "%" },
  { id: "bases", label: "Bases e composições", icon: "◫" },
  { id: "cronograma", label: "Cronograma", icon: "◩" },
  { id: "histograma", label: "Histograma", icon: "♙" },
  { id: "medicoes", label: "Medições", icon: "✓" },
  { id: "revisoes", label: "Revisões", icon: "⇄" },
];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

function CabecalhoSecao({ etapa, exportar, novaRevisao }) {
  const textos = {
    visao: ["Painel do orçamento", "Custos, planejamento e execução em uma visão consolidada."],
    planilha: ["Planilha orçamentária", "EAP, serviços, quantidades, preços unitários e totais da revisão."],
    bdi: ["BDI e encargos", "Composição detalhada das despesas indiretas aplicadas ao orçamento."],
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
        <button type="button" className="orc-btn orc-btn-ghost" onClick={exportar}>⇩ Exportar</button>
        <button type="button" className="orc-btn orc-btn-primary" onClick={novaRevisao}>＋ Nova revisão</button>
      </div>
    </div>
  );
}

function Indicadores({ orcamento }) {
  const totais = calcularTotais(orcamento);
  return (
    <div className="orc-kpis">
      <article><span>CUSTO DIRETO</span><strong>{formatarMoeda(totais.custoDireto)}</strong><small className="orc-positive">Calculado a partir dos serviços</small></article>
      <article><span>BDI MÉDIO</span><strong>{totais.bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>Aplicado ao custo direto</small></article>
      <article className="orc-kpi-total"><span>PREÇO TOTAL</span><strong>{formatarMoeda(totais.precoTotal)}</strong><small>{formatarMoeda(totais.valorPorArea)} / m²</small></article>
      <article><span>PENDÊNCIAS</span><strong>{totais.pendencias} {totais.pendencias === 1 ? "item" : "itens"}</strong><small className={totais.pendencias ? "orc-warning" : "orc-positive"}>{totais.pendencias ? "Quantidade ou preço a completar" : "Planilha consistente"}</small></article>
    </div>
  );
}

function TabelaItens({
  itens,
  completa = false,
  filtro = "",
  editarItem,
  removerItem,
  duplicarItem,
  moverItem,
  itensComErro = new Set(),
}) {
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const filtrados = termo
    ? itens.filter((item) => [item.codigo, item.descricao, item.fonte].some((valor) => valor?.toLocaleLowerCase("pt-BR").includes(termo)))
    : itens;
  const linhas = completa ? filtrados : filtrados.slice(0, 6);
  return (
    <div className="orc-table-wrap">
      <table className="orc-table">
        <thead><tr><th>ITEM</th><th>DESCRIÇÃO / FONTE</th><th>QUANTIDADE</th><th>UN.</th><th>PREÇO UNIT.</th><th>PREÇO TOTAL</th><th /></tr></thead>
        <tbody>
          {linhas.map((item, index) => (
            <tr key={item.id || `${item.codigo}-${index}`} className={`${item.tipo === "grupo" ? "orc-group-row" : ""} ${itensComErro.has(item.id) ? "orc-row-error" : ""}`}>
              <td>{item.tipo === "grupo" && <i>⌄</i>}{item.codigo}</td>
              <td><strong>{item.descricao}</strong>{item.fonte && <small>{item.fonte}</small>}</td>
              <td>{item.quantidade?.toLocaleString("pt-BR") || "—"}</td>
              <td>{item.unidade || ""}</td>
              <td>{item.unitario ? formatarMoeda(item.unitario) : ""}</td>
              <td><strong>{formatarMoeda(item.tipo === "grupo" ? totalGrupo(itens, item.codigo) : totalItem(item))}</strong></td>
              <td>
                {editarItem && <div className="orc-row-actions">
                  <button type="button" onClick={() => moverItem(item, -1)} aria-label={`Mover item ${item.codigo} para cima`} title="Mover para cima">↑</button>
                  <button type="button" onClick={() => moverItem(item, 1)} aria-label={`Mover item ${item.codigo} para baixo`} title="Mover para baixo">↓</button>
                  <button type="button" onClick={() => editarItem(item)} aria-label={`Editar item ${item.codigo}`} title="Editar">✎</button>
                  <button type="button" onClick={() => duplicarItem(item)} aria-label={`Duplicar item ${item.codigo}`} title="Duplicar">⧉</button>
                  <button type="button" className="orc-remove-item" onClick={() => removerItem(item)} aria-label={`Excluir item ${item.codigo}`} title="Excluir">×</button>
                </div>}
              </td>
            </tr>
          ))}
          {!linhas.length && <tr><td colSpan="7" className="orc-empty-table">Nenhum item encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function VisaoGeralOrcamento({ orcamento, setEtapa }) {
  const totais = calcularTotais(orcamento);
  const valorMedido = totais.precoTotal * 0.318;
  const saldo = totais.precoTotal - valorMedido;
  const distribuicao = [
    ["Materiais", 0.538],
    ["Mão de obra", 0.314],
    ["Equipamentos", 0.092],
    ["Outros", 0.056],
  ];
  return (
    <>
      <Indicadores orcamento={orcamento} />
      <div className="orc-dashboard-grid">
        <article className="orc-card orc-evolution">
          <header><div><span>EVOLUÇÃO FINANCEIRA</span><h3>Curva do orçamento</h3></div><div className="orc-legend"><i />Planejado <i />Medido</div></header>
          <div className="orc-line-chart">
            <div className="orc-axis"><span>R$ 6 mi</span><span>R$ 4 mi</span><span>R$ 2 mi</span><span>R$ 0</span></div>
            <div className="orc-chart-field"><span className="orc-gridline a" /><span className="orc-gridline b" /><span className="orc-gridline c" /><span className="orc-chart-area" /><span className="orc-chart-line" /></div>
          </div>
          <div className="orc-months">{["Jul","Ago","Set","Out","Nov","Dez","Jan","Fev"].map((mes) => <span key={mes}>{mes}</span>)}</div>
          <footer><div><small>AVANÇO FÍSICO</small><strong>31,8%</strong></div><div><small>VALOR MEDIDO</small><strong>{formatarMoeda(valorMedido)}</strong></div><div><small>SALDO</small><strong>{formatarMoeda(saldo)}</strong></div></footer>
        </article>
        <article className="orc-card">
          <header><div><span>COMPOSIÇÃO DO CUSTO</span><h3>Distribuição por natureza</h3></div></header>
          <div className="orc-donut-row">
            <div className="orc-donut"><div><strong>{formatarMoeda(totais.custoDireto)}</strong><small>CUSTO DIRETO</small></div></div>
            <div className="orc-cost-list">
              {distribuicao.map(([nome, percentual], i) => <div key={nome}><i className={`c${i + 1}`} /><span><strong>{nome}</strong><small>{formatarMoeda(totais.custoDireto * percentual)}</small></span><b>{percentual.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1 })}</b></div>)}
            </div>
          </div>
        </article>
      </div>
      <article className="orc-card orc-budget-preview">
        <header><div><span>PLANILHA ORÇAMENTÁRIA</span><h3>Principais serviços</h3></div><button type="button" onClick={() => setEtapa("planilha")}>Ver planilha completa →</button></header>
        <TabelaItens itens={orcamento.itens} />
      </article>
    </>
  );
}

function Planilha({
  orcamento,
  abrirNovoItem,
  abrirNovoGrupo,
  editarItem,
  removerItem,
  duplicarItem,
  moverItem,
  importarArquivo,
}) {
  const [filtro, setFiltro] = useState("");
  const totais = calcularTotais(orcamento);
  const validacoes = validarOrcamento(orcamento);
  const itensComErro = new Set(validacoes.map((item) => item.itemId));
  return (
    <>
      <Indicadores orcamento={orcamento} />
      <article className="orc-card orc-budget-preview">
        <div className="orc-toolbar">
          <label>⌕<input value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="Filtrar item, descrição ou código..." /></label>
          <button type="button">≡ Filtros <span>{filtro ? 1 : 0}</span></button>
          <button type="button" onClick={abrirNovoGrupo}>＋ Grupo</button>
          <button type="button" onClick={abrirNovoItem}>＋ Serviço</button>
          <label className="orc-import-button">⇧ Importar CSV/XLSX<input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const [arquivo] = event.target.files; if (arquivo) importarArquivo(arquivo); event.target.value = ""; }} /></label>
        </div>
        {validacoes.length > 0 && <div className="orc-validation-panel" role="status"><strong>{validacoes.length} inconsistências encontradas</strong><div>{validacoes.slice(0, 4).map((item, index) => <span key={`${item.itemId}-${index}`} className={item.tipo}>{item.mensagem}</span>)}</div>{validacoes.length > 4 && <small>Mais {validacoes.length - 4} ocorrências destacadas na planilha.</small>}</div>}
        {!validacoes.length && <div className="orc-validation-panel is-valid"><strong>✓ Planilha validada</strong><span>Códigos, preços, quantidades e unidades consistentes.</span></div>}
        <TabelaItens
          itens={orcamento.itens}
          completa
          filtro={filtro}
          editarItem={editarItem}
          removerItem={removerItem}
          duplicarItem={duplicarItem}
          moverItem={moverItem}
          itensComErro={itensComErro}
        />
        <footer className="orc-table-footer"><span>{orcamento.itens.filter((item) => item.tipo !== "grupo").length} itens · {orcamento.itens.filter((item) => item.tipo === "grupo").length} grupos · {totais.pendencias} pendências</span><strong>Total com BDI: {formatarMoeda(totais.precoTotal)}</strong></footer>
      </article>
    </>
  );
}

function BdiDetalhado({ orcamento, salvarBdi }) {
  const [componentes, setComponentes] = useState(
    () => ({ ...(orcamento.bdiComponentes || BDI_COMPONENTES_PADRAO) }),
  );
  const bdiCalculado = calcularBdiDetalhado(componentes);
  const campos = [
    ["administracaoCentral", "Administração central"],
    ["segurosGarantias", "Seguros e garantias"],
    ["riscos", "Riscos"],
    ["despesasFinanceiras", "Despesas financeiras"],
    ["lucro", "Lucro"],
    ["tributos", "Tributos"],
  ];

  return (
    <div className="orc-bdi-grid">
      <article className="orc-card">
        <header><div><span>COMPOSIÇÃO DO BDI</span><h3>Componentes percentuais</h3></div><strong>{bdiCalculado.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong></header>
        <div className="orc-bdi-form">
          {campos.map(([campo, rotulo]) => <label key={campo}><span>{rotulo}</span><div><input type="number" min="0" max={campo === "tributos" ? "99" : "100"} step="0.01" value={componentes[campo]} onChange={(event) => setComponentes((atuais) => ({ ...atuais, [campo]: Number(event.target.value) }))} /><b>%</b></div></label>)}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={() => setComponentes({ ...BDI_COMPONENTES_PADRAO })}>Restaurar referência</button><button type="button" className="orc-btn orc-btn-primary" onClick={() => salvarBdi(componentes)}>Aplicar BDI</button></footer>
      </article>
      <aside className="orc-card orc-bdi-summary">
        <header><div><span>MEMÓRIA DE CÁLCULO</span><h3>Resultado</h3></div></header>
        <div><span>BDI anterior</span><strong>{calcularTotais(orcamento).bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong></div>
        <div><span>BDI calculado</span><strong>{bdiCalculado.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong></div>
        <div><span>Custo direto</span><strong>{formatarMoeda(calcularTotais(orcamento).custoDireto)}</strong></div>
        <div className="total"><span>Preço com BDI</span><strong>{formatarMoeda(calcularTotais({ ...orcamento, bdiComponentes: componentes }).precoTotal)}</strong></div>
        <p>Fórmula: (((1 + AC + SG + R) × (1 + DF) × (1 + L)) ÷ (1 − I)) − 1</p>
      </aside>
    </div>
  );
}

function Bases({ orcamento, adicionarComposicao, removerComposicao, setAviso }) {
  const [novaComposicao, setNovaComposicao] = useState({ codigo: "", descricao: "", unidade: "UN", custoUnitario: "" });
  const bases = [
    { titulo: "SINAPI RS · 06/2026", detalhe: "Sem desoneração · Versão publicada", registros: "4.876 insumos · 10.454 composições", status: "Ativa" },
    { titulo: "SINAPI RS · 05/2026", detalhe: "Sem desoneração · Versão histórica", registros: "4.862 insumos · 10.419 composições", status: "Histórica" },
    { titulo: "Base corporativa PRUMO", detalhe: "Cotações e composições próprias", registros: "286 insumos · 74 composições", status: "Ativa" },
  ];
  function salvarComposicao(event) {
    event.preventDefault();
    adicionarComposicao(novaComposicao);
    setNovaComposicao({ codigo: "", descricao: "", unidade: "UN", custoUnitario: "" });
    setAviso("Composição própria cadastrada.");
  }
  return (
    <>
      <div className="orc-bases-grid">
        <section className="orc-card orc-base-list">
          <header><div><span>BASES VERSIONADAS</span><h3>Referências disponíveis</h3></div><button type="button" onClick={() => setAviso("Integração automática do SINAPI programada para a v9.3.")}>＋ Importar SINAPI</button></header>
          {bases.map((base) => <article key={base.titulo}><div className="orc-base-icon">◫</div><div><strong>{base.titulo}</strong><span>{base.detalhe}</span><small>{base.registros}</small></div><b className={base.status === "Ativa" ? "is-active" : ""}>{base.status}</b><button type="button">Abrir →</button></article>)}
        </section>
        <aside className="orc-card orc-import-status">
          <header><div><span>ÚLTIMA IMPORTAÇÃO</span><h3>Integridade da base</h3></div></header>
          <div className="orc-quality-score"><strong>99,8%</strong><span>VALIDADA</span></div>
          <ul><li><i>✓</i> Códigos e unidades consistentes</li><li><i>✓</i> Composições sem ciclos</li><li><i>✓</i> Três regimes conciliados</li><li><i>!</i> 7 preços exigem tratamento</li></ul>
          <small>Arquivo oficial preservado com hash SHA-256</small>
        </aside>
      </div>
      <section className="orc-card orc-compositions">
        <header><div><span>BASE CORPORATIVA</span><h3>Composições próprias</h3></div><strong>{orcamento.composicoes.length} cadastradas</strong></header>
        <form onSubmit={salvarComposicao}>
          <input required value={novaComposicao.codigo} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, codigo: event.target.value }))} placeholder="Código CPU" />
          <input required value={novaComposicao.descricao} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Descrição da composição" />
          <select value={novaComposicao.unidade} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, unidade: event.target.value }))}>{UNIDADES_ORCAMENTARIAS.map((unidade) => <option key={unidade}>{unidade}</option>)}</select>
          <input required type="number" min="0" step="0.01" value={novaComposicao.custoUnitario} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, custoUnitario: event.target.value }))} placeholder="Custo unitário" />
          <button type="submit">＋ Cadastrar</button>
        </form>
        <div className="orc-composition-list">
          {orcamento.composicoes.map((composicao) => <article key={composicao.id}><span><strong>{composicao.codigo}</strong><small>{composicao.unidade}</small></span><div><strong>{composicao.descricao}</strong><small>Composição própria versionada</small></div><b>{formatarMoeda(composicao.custoUnitario)}</b><button type="button" onClick={() => removerComposicao(composicao.id)} aria-label={`Excluir composição ${composicao.codigo}`}>×</button></article>)}
          {!orcamento.composicoes.length && <p>Nenhuma composição própria cadastrada neste orçamento.</p>}
        </div>
      </section>
    </>
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

function Revisoes({ orcamento }) {
  const totais = calcularTotais(orcamento);
  const estadoAtual = {
    id: "estado-atual",
    codigo: `${orcamento.revisao} atual`,
    status: orcamento.status,
    base: orcamento.base,
    total: totais.precoTotal,
    variacao: 0,
    autor: "Usuário atual",
    publicada: false,
    snapshot: orcamento.itens,
  };
  const opcoes = [estadoAtual, ...orcamento.revisoes];
  const [revisaoBaseId, setRevisaoBaseId] = useState(opcoes[1]?.id || estadoAtual.id);
  const [revisaoComparadaId, setRevisaoComparadaId] = useState(estadoAtual.id);
  const revisaoBase = opcoes.find((item) => item.id === revisaoBaseId) || opcoes[0];
  const revisaoComparada = opcoes.find((item) => item.id === revisaoComparadaId) || opcoes[0];
  const comparacao = useMemo(
    () => compararSnapshots(revisaoBase, revisaoComparada),
    [revisaoBase, revisaoComparada],
  );
  const variacaoTotal = revisaoBase.total
    ? ((revisaoComparada.total - revisaoBase.total) / revisaoBase.total) * 100
    : 0;

  return (
    <>
      <article className="orc-card orc-revision-compare">
        <header><div><span>COMPARAÇÃO</span><h3>Alterações entre revisões</h3></div></header>
        <div className="orc-compare-selects">
          <label><span>REVISÃO BASE</span><select value={revisaoBaseId} onChange={(event) => setRevisaoBaseId(event.target.value)}>{opcoes.map((revisao) => <option key={revisao.id} value={revisao.id}>{revisao.codigo}</option>)}</select></label>
          <strong>→</strong>
          <label><span>COMPARAR COM</span><select value={revisaoComparadaId} onChange={(event) => setRevisaoComparadaId(event.target.value)}>{opcoes.map((revisao) => <option key={revisao.id} value={revisao.id}>{revisao.codigo}</option>)}</select></label>
        </div>
        {!comparacao.disponivel && <div className="orc-compare-unavailable"><strong>Snapshot histórico indisponível</strong><span>Essa revisão foi criada antes da rastreabilidade detalhada da v9.2. Crie uma nova revisão para iniciar comparações por item.</span></div>}
        {comparacao.disponivel && <div className="orc-compare-kpis">
          <div><span>ADICIONADOS</span><strong className="added">{comparacao.adicionados.length}</strong><small>{comparacao.adicionados.join(", ") || "Nenhum"}</small></div>
          <div><span>ALTERADOS</span><strong className="changed">{comparacao.alterados.length}</strong><small>{comparacao.alterados.join(", ") || "Nenhum"}</small></div>
          <div><span>REMOVIDOS</span><strong className="removed">{comparacao.removidos.length}</strong><small>{comparacao.removidos.join(", ") || "Nenhum"}</small></div>
          <div><span>VARIAÇÃO TOTAL</span><strong>{variacaoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>{formatarMoeda(revisaoComparada.total - revisaoBase.total)}</small></div>
        </div>}
      </article>
      <article className="orc-card orc-revisions">
        <header><div><span>HISTÓRICO VERSIONADO</span><h3>Revisões do orçamento {orcamento.id}</h3></div></header>
        {opcoes.map((revisao, index) => <div key={revisao.id} className={index === 0 ? "current" : ""}><span className="orc-rev">{revisao.codigo}</span><span><strong>{revisao.status}</strong><small>{index === 0 ? "Estado editável atual" : "Snapshot preservado"}</small></span><span><small>BASE</small><strong>{revisao.base}</strong></span><span><small>PREÇO TOTAL</small><strong>{formatarMoeda(revisao.total)}</strong></span><b>{revisao.variacao ? `${revisao.variacao > 0 ? "+" : ""}${revisao.variacao.toLocaleString("pt-BR")}%` : "—"}</b><span><small>RESPONSÁVEL</small><strong>{revisao.autor}</strong></span><button type="button">•••</button></div>)}
      </article>
    </>
  );
}

function ModalItem({ fechar, salvar, item, tipoInicial = "servico" }) {
  const [dados, setDados] = useState(() => item ? {
    tipo: item.tipo || "servico",
    codigo: item.codigo,
    descricao: item.descricao,
    fonte: item.fonte || "",
    quantidade: item.quantidade || "",
    unidade: item.unidade || "UN",
    unitario: item.unitario || "",
  } : {
    tipo: tipoInicial,
    codigo: "",
    descricao: "",
    fonte: tipoInicial === "grupo" ? "" : "SINAPI · ",
    quantidade: "",
    unidade: "UN",
    unitario: "",
  });

  function atualizar(campo, valor) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-novo-item" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados, item?.id); }}>
        <header><div><span>PLANILHA ORÇAMENTÁRIA</span><h3 id="orc-novo-item">{item ? "Editar" : "Adicionar"} {dados.tipo === "grupo" ? "grupo" : "serviço"}</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Tipo</span><select value={dados.tipo} onChange={(event) => atualizar("tipo", event.target.value)}><option value="servico">Serviço</option><option value="grupo">Grupo EAP</option></select></label>
          <label><span>Código EAP</span><input required value={dados.codigo} onChange={(event) => atualizar("codigo", event.target.value)} placeholder="Ex.: 4.1" /></label>
          <label className="orc-field-wide"><span>Descrição</span><input required value={dados.descricao} onChange={(event) => atualizar("descricao", event.target.value)} placeholder="Descrição do serviço" /></label>
          {dados.tipo !== "grupo" && <>
            <label className="orc-field-wide"><span>Fonte e código</span><input value={dados.fonte} onChange={(event) => atualizar("fonte", event.target.value)} placeholder="SINAPI · 000000" /></label>
            <label><span>Quantidade</span><input required min="0" step="any" type="number" value={dados.quantidade} onChange={(event) => atualizar("quantidade", event.target.value)} /></label>
            <label><span>Unidade</span><select required value={dados.unidade} onChange={(event) => atualizar("unidade", event.target.value)}>{UNIDADES_ORCAMENTARIAS.map((unidade) => <option key={unidade}>{unidade}</option>)}</select></label>
            <label><span>Preço unitário</span><input required min="0" step="0.01" type="number" value={dados.unitario} onChange={(event) => atualizar("unitario", event.target.value)} /></label>
          </>}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">{item ? "Salvar alterações" : "Adicionar"}</button></footer>
      </form>
    </div>
  );
}

function ModalNovoOrcamento({ fechar, salvar, proximoCodigo }) {
  const [dados, setDados] = useState({
    id: proximoCodigo,
    nome: "",
    base: "SINAPI RS · 06/2026",
    bdi: "24.73",
    area: "",
  });

  function atualizar(campo, valor) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-novo-orcamento" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados); }}>
        <header><div><span>PORTFÓLIO</span><h3 id="orc-novo-orcamento">Novo orçamento</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Identificador</span><input required value={dados.id} onChange={(event) => atualizar("id", event.target.value.toUpperCase())} /></label>
          <label className="orc-field-wide"><span>Nome do empreendimento</span><input required value={dados.nome} onChange={(event) => atualizar("nome", event.target.value)} placeholder="Nome da obra ou projeto" /></label>
          <label className="orc-field-wide"><span>Base de referência</span><input required value={dados.base} onChange={(event) => atualizar("base", event.target.value)} /></label>
          <label><span>BDI (%)</span><input required min="0" step="0.01" type="number" value={dados.bdi} onChange={(event) => atualizar("bdi", event.target.value)} /></label>
          <label><span>Área (m²)</span><input min="0" step="0.01" type="number" value={dados.area} onChange={(event) => atualizar("area", event.target.value)} /></label>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Criar orçamento</button></footer>
      </form>
    </div>
  );
}

export default function Orcamento() {
  const [etapa, setEtapa] = useState("visao");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState("");
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const {
    orcamentos,
    orcamentoAtivo,
    orcamentoAtivoId,
    setOrcamentoAtivoId,
    salvarItem,
    removerItem,
    duplicarItem,
    moverItem,
    importarItens,
    atualizarBdi,
    adicionarComposicao,
    removerComposicao,
    adicionarOrcamento,
    criarRevisao,
  } = useOrcamentos();
  const etapaAtual = useMemo(() => ETAPAS.find((item) => item.id === etapa), [etapa]);
  const proximoCodigo = useMemo(() => {
    const maior = orcamentos.reduce((atual, item) => Math.max(atual, Number(item.id.split("-").at(-1)) || 0), 0);
    return `ORC-${new Date().getFullYear()}-${String(maior + 1).padStart(4, "0")}`;
  }, [orcamentos]);

  function notificar(mensagem) {
    setAviso(mensagem);
    window.setTimeout(() => setAviso(""), 2400);
  }

  function salvarDadosItem(dados, itemId) {
    salvarItem(dados, itemId);
    setModal("");
    setItemEmEdicao(null);
    notificar(itemId ? "Item atualizado e salvo." : `${dados.tipo === "grupo" ? "Grupo" : "Serviço"} adicionado à EAP.`);
  }

  function salvarNovoOrcamento(dados) {
    if (orcamentos.some((item) => item.id === dados.id)) {
      notificar("Já existe um orçamento com esse identificador.");
      return;
    }
    adicionarOrcamento(dados);
    setModal("");
    setEtapa("planilha");
    notificar("Novo orçamento criado e salvo.");
  }

  function confirmarRemocao(item) {
    const complemento = item.tipo === "grupo" ? " e todos os serviços vinculados" : "";
    if (window.confirm(`Excluir o item ${item.codigo} — ${item.descricao}${complemento}?`)) {
      removerItem(item.id);
      notificar("Item removido da planilha.");
    }
  }

  function abrirEdicao(item) {
    setItemEmEdicao(item);
    setModal("item");
  }

  async function importarArquivo(arquivo) {
    try {
      const resultado = await importarPlanilhaOrcamentaria(arquivo);
      if (resultado.itens.length) importarItens(resultado.itens);
      notificar(`${resultado.itens.length} itens importados${resultado.erros.length ? ` · ${resultado.erros.length} linhas ignoradas` : ""}.`);
    } catch (error) {
      console.error(error);
      notificar("Não foi possível ler o arquivo selecionado.");
    }
  }

  function salvarBdi(componentes) {
    atualizarBdi(componentes);
    notificar("Composição do BDI aplicada ao orçamento.");
  }

  function adicionarRevisao() {
    criarRevisao();
    setEtapa("revisoes");
    notificar("Nova revisão criada a partir da versão atual.");
  }

  function exportar() {
    const arquivo = new Blob([JSON.stringify(orcamentoAtivo, null, 2)], { type: "application/json" });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = endereco;
    link.download = `${orcamentoAtivo.id}-${orcamentoAtivo.revisao}.json`;
    link.click();
    URL.revokeObjectURL(endereco);
    notificar("Dados do orçamento exportados.");
  }

  if (!orcamentoAtivo) return null;

  return (
    <section className="sigiu-page orc-page">
      {aviso && <div className="orc-toast" role="status">{aviso}</div>}
      {(modal === "item" || modal === "grupo") && <ModalItem fechar={() => { setModal(""); setItemEmEdicao(null); }} salvar={salvarDadosItem} item={itemEmEdicao} tipoInicial={modal === "grupo" ? "grupo" : "servico"} />}
      {modal === "orcamento" && <ModalNovoOrcamento fechar={() => setModal("")} salvar={salvarNovoOrcamento} proximoCodigo={proximoCodigo} />}
      <div className="orc-project-bar">
        <div><span>ORÇAMENTO ATIVO</span><select value={orcamentoAtivoId} onChange={(event) => setOrcamentoAtivoId(event.target.value)}>{orcamentos.map((orcamento) => <option key={orcamento.id} value={orcamento.id}>{orcamento.id} · {orcamento.nome}</option>)}</select></div>
        <button type="button" className="orc-new-budget" onClick={() => setModal("orcamento")}>＋ Novo orçamento</button>
        <div><small>REVISÃO</small><strong>{orcamentoAtivo.revisao}</strong></div><div><small>STATUS</small><strong className="orc-status">{orcamentoAtivo.status}</strong></div><div><small>BASE</small><strong>{orcamentoAtivo.base}</strong></div>
      </div>
      <nav className="orc-module-nav" aria-label="Etapas do orçamento">
        {ETAPAS.map((item) => <button type="button" key={item.id} className={etapa === item.id ? "is-active" : ""} onClick={() => setEtapa(item.id)}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
      <CabecalhoSecao etapa={etapaAtual.id} exportar={exportar} novaRevisao={adicionarRevisao} />
      {etapa === "visao" && <VisaoGeralOrcamento orcamento={orcamentoAtivo} setEtapa={setEtapa} />}
      {etapa === "planilha" && <Planilha orcamento={orcamentoAtivo} abrirNovoItem={() => { setItemEmEdicao(null); setModal("item"); }} abrirNovoGrupo={() => { setItemEmEdicao(null); setModal("grupo"); }} editarItem={abrirEdicao} removerItem={confirmarRemocao} duplicarItem={(item) => { duplicarItem(item.id); notificar("Item duplicado."); }} moverItem={(item, direcao) => moverItem(item.id, direcao)} importarArquivo={importarArquivo} />}
      {etapa === "bdi" && <BdiDetalhado key={orcamentoAtivo.id} orcamento={orcamentoAtivo} salvarBdi={salvarBdi} />}
      {etapa === "bases" && <Bases orcamento={orcamentoAtivo} adicionarComposicao={adicionarComposicao} removerComposicao={removerComposicao} setAviso={notificar} />}
      {etapa === "cronograma" && <Cronograma />}
      {etapa === "histograma" && <Histograma />}
      {etapa === "medicoes" && <Medicoes />}
      {etapa === "revisoes" && <Revisoes orcamento={orcamentoAtivo} />}
    </section>
  );
}
