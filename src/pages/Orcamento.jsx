import { useEffect, useMemo, useState } from "react";
import {
  BDI_COMPONENTES_PADRAO,
  BDI_DIFERENCIADO_COMPONENTES_PADRAO,
  ENCARGOS_SOCIAIS_PADRAO,
  calcularBdiDetalhado,
  calcularDataFimPorPrazo,
  calcularDistribuicaoDesconto,
  calcularPrazoDias,
  calcularSaldosMedicao,
  calcularTotalPercentuais,
  calcularTotais,
  compararSnapshots,
  criarPeriodosMedicao,
  criarId,
  criarMedicoesPropostas,
  decomporParcelasUnitarias,
  obterCronogramaProposto,
  obterHistogramaInteligente,
  proximoCodigoGrupo,
  proximoCodigoServico,
  totalGrupo,
  totalItem,
  UNIDADES_ORCAMENTARIAS,
  validarBdiDiferenciadoItem,
  validarMedicaoAcumulada,
  validarOrcamento,
} from "../domain/orcamento";
import useOrcamentos from "../hooks/useOrcamentos";
import { importarPlanilhaOrcamentaria } from "../services/orcamentoImport";
import {
  baixarPacoteLicitacao,
  resumirPacoteLicitacao,
} from "../services/licitacaoExport";
import { consolidarDemandaSuprimentos } from "../services/suprimentos";
import { baixarRelatorioSuprimentos } from "../services/suprimentosExport";
import { EAP_NIVEIS, nivelEapAnterior } from "../domain/eap";
import ModalComposicaoRastreavel from "../components/Orcamento/ModalComposicaoRastreavel";

const ETAPAS = [
  { id: "visao", label: "Visão geral", icon: "⌂" },
  { id: "planilha", label: "Planilha orçamentária", icon: "▤" },
  { id: "bases", label: "Bases e composições", icon: "◫" },
  { id: "bdi", label: "BDI e encargos", icon: "%" },
  { id: "cronograma", label: "Cronograma", icon: "◩" },
  { id: "histograma", label: "Histograma", icon: "♙" },
  { id: "medicoes", label: "Medições", icon: "✓" },
  { id: "comercial", label: "Condições comerciais", icon: "$" },
  { id: "licitacoes", label: "Licitações", icon: "▦" },
  { id: "suprimentos", label: "Suprimentos", icon: "◇" },
  { id: "revisoes", label: "Revisões", icon: "⇄" },
];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatarPrecoUnitario = (valor) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(valor);

const formatarDataObra = (valor) => valor
  ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR")
  : "Não definida";

const resumirBasesDosItens = (itens) => {
  const bases = [...new Set(
    itens
      .filter((item) => item.tipo !== "grupo")
      .map((item) => item.fonte?.split("·")[0]?.trim())
      .filter(Boolean),
  )];
  return bases.join(", ") || "Preços manuais";
};

function CabecalhoSecao({ etapa, exportar, novaRevisao }) {
  const textos = {
    visao: ["Painel do orçamento", "Custos, planejamento e execução em uma visão consolidada."],
    planilha: ["Planilha orçamentária", "EAP, serviços, quantidades, preços unitários e totais da revisão."],
    bdi: ["BDI e encargos", "Composição detalhada das despesas indiretas aplicadas ao orçamento."],
    bases: ["Bases e composições", "Catálogos de preços independentes, composições próprias e vínculos por item."],
    cronograma: ["Cronograma físico-financeiro", "Distribuição planejada e realizada por período da obra."],
    histograma: ["Histograma de mão de obra", "Equipes projetadas a partir dos coeficientes das composições."],
    medicoes: ["Medições e saldos", "Avanço físico, valor medido, retenções e saldo contratual."],
    comercial: ["Condições comerciais", "Descontos, critérios de negociação e memória das condições aplicadas."],
    licitacoes: ["Licitações e concorrência", "Pacote protegido para orçamento, proposta, BDI, encargos, cronograma e histograma."],
    suprimentos: ["Planejamento de suprimentos", "Explosão recursiva das composições e demanda consolidada dos insumos."],
    testes: ["Homologação funcional", "Lista orientada de testes, resultados e observações para cada função desenvolvida."],
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
        {["planilha", "cronograma", "histograma"].includes(etapa) && (
          <button type="button" className="orc-btn orc-btn-ghost" onClick={exportar}>⇩ Exportar XLSX</button>
        )}
        {etapa === "revisoes" && (
          <button type="button" className="orc-btn orc-btn-primary" onClick={novaRevisao}>＋ Nova revisão</button>
        )}
      </div>
    </div>
  );
}

function Indicadores({ orcamento }) {
  const totais = calcularTotais(orcamento);
  return (
    <div className="orc-kpis">
      <article><span>CUSTO DIRETO LÍQUIDO</span><strong>{formatarMoeda(totais.custoDireto)}</strong><small className="orc-positive">{totais.valorDesconto ? `${formatarMoeda(totais.valorDesconto)} de desconto` : "Calculado a partir dos serviços"}</small></article>
      <article><span>BDI EFETIVO</span><strong>{totais.bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>{totais.itensBdiDiferenciado ? `${totais.itensBdiDiferenciado} itens com BDI diferenciado` : "Todos os itens com BDI padrão"}</small></article>
      <article className="orc-kpi-total"><span>PREÇO TOTAL</span><strong>{formatarMoeda(totais.precoTotal)}</strong><small>{formatarMoeda(totais.valorPorArea)} / m²</small></article>
      <article><span>PENDÊNCIAS</span><strong>{totais.pendencias} {totais.pendencias === 1 ? "item" : "itens"}</strong><small className={totais.pendencias ? "orc-warning" : "orc-positive"}>{totais.pendencias ? "Quantidade ou preço a completar" : "Planilha consistente"}</small></article>
    </div>
  );
}

function TabelaItens({
  itens,
  descontoGlobal = null,
  completa = false,
  filtro = "",
  editarItem,
  removerItem,
  duplicarItem,
  moverItem,
  abrirDetalhe,
  itensComErro = new Set(),
  limite = 0,
}) {
  const distribuicao = calcularDistribuicaoDesconto({ itens, descontoGlobal });
  const descontos = distribuicao.porItem;
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const filtrados = termo
    ? itens.filter((item) => [item.codigo, item.descricao, item.fonte].some((valor) => valor?.toLocaleLowerCase("pt-BR").includes(termo)))
    : itens;
  const linhas = completa
    ? (limite > 0 ? filtrados.slice(0, limite) : filtrados)
    : filtrados.slice(0, 6);
  return (
    <div className="orc-table-wrap">
      <table className="orc-table">
        <thead><tr><th>ITEM</th><th>DESCRIÇÃO / FONTE</th><th>QUANTIDADE</th><th>UN.</th><th>MO UNIT.</th><th>MATERIAL UNIT.</th><th>PREÇO UNIT.</th><th>BRUTO</th><th>DESCONTO</th><th>TOTAL LÍQUIDO</th><th /></tr></thead>
        <tbody>
          {linhas.map((item, index) => {
            const descontoItem = item.tipo === "grupo"
              ? itens
                .filter((servico) => servico.tipo !== "grupo" && servico.codigo.startsWith(`${item.codigo}.`))
                .reduce((total, servico) => total + (descontos.get(servico.id) || 0), 0)
              : (descontos.get(item.id) || 0);
            const valorBruto = item.tipo === "grupo"
              ? totalGrupo(itens, item.codigo)
              : totalItem(item);
            const valorLiquido = item.tipo === "grupo"
              ? totalGrupo(itens, item.codigo, descontos)
              : valorBruto - descontoItem;
            const parcelas = item.tipo === "grupo" ? null : decomporParcelasUnitarias(item);
            return (
            <tr
              key={item.id || `${item.codigo}-${index}`}
              className={`${item.tipo === "grupo" ? "orc-group-row" : ""} ${itensComErro.has(item.id) ? "orc-row-error" : ""} ${item.tipo !== "grupo" && item.referenciaTipo === "composicao" ? "orc-composition-row" : ""}`}
              onClick={() => item.tipo !== "grupo" && item.referenciaTipo === "composicao" && abrirDetalhe?.(item)}
            >
              <td>{item.tipo === "grupo" && <i>⌄</i>}{item.codigo}</td>
              <td style={{ paddingLeft: `${10 + Math.max(0, String(item.codigo).split(".").length - 1) * 12}px` }}><strong>{item.descricao}</strong>{item.fonte && <small>{item.fonte}</small>}{item.tipo !== "grupo" && item.bdiTipo === "diferenciado" && <small className={validarBdiDiferenciadoItem(item).elegivel ? "orc-bdi-item-tag" : "orc-bdi-item-tag is-pending"}>{validarBdiDiferenciadoItem(item).elegivel ? "BDI DIFERENCIADO" : "BDI DIFERENCIADO PENDENTE"}</small>}</td>
              <td>{item.quantidade?.toLocaleString("pt-BR") || "—"}</td>
              <td>{item.unidade || ""}</td>
              <td className="orc-cost-component">{parcelas ? formatarPrecoUnitario(parcelas.maoObra) : "—"}</td>
              <td className="orc-cost-component">{parcelas ? formatarPrecoUnitario(parcelas.material) : "—"}</td>
              <td>{item.unitario ? formatarPrecoUnitario(item.unitario) : ""}</td>
              <td>{formatarMoeda(valorBruto)}</td>
              <td className="orc-discount-value">{descontoItem ? `− ${formatarMoeda(descontoItem)}` : "—"}</td>
              <td><strong>{formatarMoeda(valorLiquido)}</strong></td>
              <td>
                {editarItem && <div className="orc-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => moverItem(item, -1)} aria-label={`Mover item ${item.codigo} para cima`} title="Mover para cima">↑</button>
                  <button type="button" onClick={() => moverItem(item, 1)} aria-label={`Mover item ${item.codigo} para baixo`} title="Mover para baixo">↓</button>
                  <button type="button" onClick={() => editarItem(item)} aria-label={`Editar item ${item.codigo}`} title="Editar">✎</button>
                  <button type="button" onClick={() => duplicarItem(item)} aria-label={`Duplicar item ${item.codigo}`} title="Duplicar">⧉</button>
                  <button type="button" className="orc-remove-item" onClick={() => removerItem(item)} aria-label={`Excluir item ${item.codigo}`} title="Excluir">×</button>
                </div>}
              </td>
            </tr>
            );
          })}
          {!linhas.length && <tr><td colSpan="11" className="orc-empty-table">Nenhum item encontrado.</td></tr>}
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
        <TabelaItens itens={orcamento.itens} descontoGlobal={orcamento.descontoGlobal} />
      </article>
    </>
  );
}

function DescontoOrcamento({ orcamento, salvar }) {
  const [tipo, setTipo] = useState(orcamento.descontoGlobal?.tipo || "percentual");
  const [valor, setValor] = useState(orcamento.descontoGlobal?.valor || "");
  const simulacao = calcularTotais({
    ...orcamento,
    descontoGlobal: valor ? { tipo, valor } : null,
  });

  function aplicar(event) {
    event.preventDefault();
    salvar({ tipo, valor });
  }

  return (
    <article className="orc-card orc-discount-card">
      <header>
        <div><span>CONDIÇÃO COMERCIAL</span><h3>Desconto global do orçamento</h3></div>
        {orcamento.descontoGlobal && <b>ATIVO</b>}
      </header>
      <form onSubmit={aplicar}>
        <label>
          <span>FORMA DE ENTRADA</span>
          <select value={tipo} onChange={(event) => { setTipo(event.target.value); setValor(""); }}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor global (R$)</option>
          </select>
        </label>
        <label>
          <span>{tipo === "percentual" ? "DESCONTO (%)" : "DESCONTO (R$)"}</span>
          <input
            required
            type="number"
            min="0"
            max={tipo === "percentual" ? "100" : simulacao.subtotalBruto}
            step="any"
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            placeholder={tipo === "percentual" ? "Ex.: 5" : "Ex.: 10000"}
          />
        </label>
        <div className="orc-discount-preview">
          <span><small>SUBTOTAL BRUTO</small><strong>{formatarMoeda(simulacao.subtotalBruto)}</strong></span>
          <i>−</i>
          <span><small>DESCONTO</small><strong>{formatarMoeda(simulacao.valorDesconto)}</strong></span>
          <span><small>PERCENTUAL CALCULADO</small><strong>{simulacao.descontoPercentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}%</strong></span>
          <span><small>SUBTOTAL LÍQUIDO</small><strong>{formatarMoeda(simulacao.custoDireto)}</strong></span>
        </div>
        <div className="orc-discount-actions">
          {orcamento.descontoGlobal && <button type="button" className="orc-btn orc-btn-ghost" onClick={() => { setValor(""); salvar(null); }}>Remover desconto</button>}
          <button type="submit" className="orc-btn orc-btn-primary">Aplicar desconto</button>
        </div>
      </form>
      <footer>O desconto é rateado entre os serviços. Todos os resultados monetários são truncados em duas casas, sem arredondamento.</footer>
    </article>
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
  abrirDetalhe,
  importarArquivo,
}) {
  const [filtro, setFiltro] = useState("");
  const [limiteLinhas, setLimiteLinhas] = useState(50);
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
          <label className="orc-row-limit"><span>LINHAS</span><select value={limiteLinhas} onChange={(event) => setLimiteLinhas(Number(event.target.value))}><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="0">Todas</option></select></label>
          <label className="orc-import-button">⇧ Importar CSV/XLSX<input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { const [arquivo] = event.target.files; if (arquivo) importarArquivo(arquivo); event.target.value = ""; }} /></label>
        </div>
        {validacoes.length > 0 && <div className="orc-validation-panel" role="status"><strong>{validacoes.length} inconsistências encontradas</strong><div>{validacoes.slice(0, 4).map((item, index) => <span key={`${item.itemId}-${index}`} className={item.tipo}>{item.mensagem}</span>)}</div>{validacoes.length > 4 && <small>Mais {validacoes.length - 4} ocorrências destacadas na planilha.</small>}</div>}
        {!validacoes.length && <div className="orc-validation-panel is-valid"><strong>✓ Planilha validada</strong><span>Códigos, preços, quantidades e unidades consistentes.</span></div>}
        <TabelaItens
          itens={orcamento.itens}
          descontoGlobal={orcamento.descontoGlobal}
          completa
          filtro={filtro}
          editarItem={editarItem}
          removerItem={removerItem}
          duplicarItem={duplicarItem}
          moverItem={moverItem}
          abrirDetalhe={abrirDetalhe}
          itensComErro={itensComErro}
          limite={limiteLinhas}
        />
        <footer className="orc-table-footer">
          <span>{orcamento.itens.filter((item) => item.tipo !== "grupo").length} itens · {orcamento.itens.filter((item) => item.tipo === "grupo").length} grupos · {totais.pendencias} pendências</span>
          <div><span>Bruto: {formatarMoeda(totais.subtotalBruto)}</span><span>Descontos: − {formatarMoeda(totais.valorDesconto)}</span><span>Líquido: {formatarMoeda(totais.custoDireto)}</span><span>BDI padrão: {formatarMoeda(totais.valorBdiPadrao)}</span>{totais.baseBdiDiferenciado > 0 && <span>BDI diferenciado: {formatarMoeda(totais.valorBdiDiferenciado)}</span>}<strong>Total com BDI: {formatarMoeda(totais.precoTotal)}</strong></div>
        </footer>
      </article>
    </>
  );
}

function CondicoesComerciais({ orcamento, salvarDesconto }) {
  return (
    <>
      <Indicadores orcamento={orcamento} />
      <DescontoOrcamento key={`${orcamento.id}-${orcamento.descontoGlobal?.atualizadoEm || "sem-desconto"}`} orcamento={orcamento} salvar={salvarDesconto} />
      <aside className="orc-card commercial-audit-note">
        <span>MEMÓRIA COMERCIAL</span>
        <strong>Condição vinculada à revisão {orcamento.revisao}</strong>
        <p>Alterações de desconto ficam registradas no histórico de cálculo, com percentual efetivo e regra de truncamento utilizada.</p>
      </aside>
    </>
  );
}

const clonar = (valor) => JSON.parse(JSON.stringify(valor));

function EditorPercentuais({ configuracao, alterar, prefixo }) {
  function atualizarItem(grupoId, itemId, campo, valor) {
    alterar((atual) => ({
      ...atual,
      grupos: atual.grupos.map((grupo) => grupo.id !== grupoId ? grupo : {
        ...grupo,
        itens: grupo.itens.map((item) => item.id !== itemId ? item : {
          ...item,
          [campo]: campo === "percentual" ? Number(valor) : valor,
        }),
      }),
    }));
  }

  function adicionarItem(grupoId) {
    alterar((atual) => ({
      ...atual,
      grupos: atual.grupos.map((grupo) => grupo.id !== grupoId ? grupo : {
        ...grupo,
        itens: [...grupo.itens, {
          id: `${grupo.id}${grupo.itens.length + 1}-${criarId("taxa")}`,
          descricao: "Novo item",
          percentual: 0,
        }],
      }),
    }));
  }

  function removerItem(grupoId, itemId) {
    alterar((atual) => ({
      ...atual,
      grupos: atual.grupos.map((grupo) => grupo.id !== grupoId ? grupo : {
        ...grupo,
        itens: grupo.itens.filter((item) => item.id !== itemId),
      }),
    }));
  }

  function adicionarGrupo() {
    alterar((atual) => ({
      ...atual,
      grupos: [...atual.grupos, {
        id: `G${atual.grupos.length + 1}`,
        nome: "Novo grupo",
        itens: [],
      }],
    }));
  }

  return (
    <div className="analytic-rate-editor">
      {configuracao.grupos.map((grupo) => {
        const total = grupo.itens.reduce((soma, item) => soma + Number(item.percentual || 0), 0);
        return (
          <section key={grupo.id}>
            <header><strong>GRUPO {grupo.id} — <input aria-label={`Nome do grupo ${grupo.id}`} value={grupo.nome} onChange={(event) => alterar((atual) => ({ ...atual, grupos: atual.grupos.map((item) => item.id === grupo.id ? { ...item, nome: event.target.value } : item) }))} /></strong><b>{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</b></header>
            {grupo.itens.map((item) => <div key={item.id}><span>{item.id}</span><input aria-label={`Descrição ${item.id}`} value={item.descricao} onChange={(event) => atualizarItem(grupo.id, item.id, "descricao", event.target.value)} /><label><input aria-label={`Percentual ${item.id}`} type="number" min="0" step="0.01" value={item.percentual} onChange={(event) => atualizarItem(grupo.id, item.id, "percentual", event.target.value)} /><b>%</b></label><button type="button" aria-label={`Remover ${item.id}`} onClick={() => removerItem(grupo.id, item.id)}>×</button></div>)}
            <footer><button type="button" onClick={() => adicionarItem(grupo.id)}>＋ Incluir item no grupo {grupo.id}</button><strong>Total do Grupo {grupo.id}: {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></footer>
          </section>
        );
      })}
      <button type="button" className="analytic-add-group" onClick={adicionarGrupo}>＋ Incluir novo grupo em {prefixo}</button>
    </div>
  );
}

function BdiDetalhado({ orcamento, salvarBdi, salvarBdiDiferenciado, salvarEncargos }) {
  const [guia, setGuia] = useState("bdi");
  const [componentes, setComponentes] = useState(() => clonar(orcamento.bdiComponentes || BDI_COMPONENTES_PADRAO));
  const [componentesDiferenciados, setComponentesDiferenciados] = useState(
    () => clonar(orcamento.bdiDiferenciadoComponentes || BDI_DIFERENCIADO_COMPONENTES_PADRAO),
  );
  const [encargos, setEncargos] = useState(() => clonar(orcamento.encargosSociais || ENCARGOS_SOCIAIS_PADRAO));
  const bdiCalculado = calcularBdiDetalhado(componentes);
  const bdiDiferenciadoCalculado = calcularBdiDetalhado(componentesDiferenciados);
  const totalEncargos = calcularTotalPercentuais(encargos.grupos);
  const totais = calcularTotais(orcamento);

  return (
    <>
      <nav className="bdi-subnav" aria-label="BDI e encargos">
        <button type="button" className={guia === "bdi" ? "is-active" : ""} onClick={() => setGuia("bdi")}>Composição do BDI</button>
        <button type="button" className={guia === "bdi-diferenciado" ? "is-active" : ""} onClick={() => setGuia("bdi-diferenciado")}>BDI diferenciado</button>
        <button type="button" className={guia === "encargos" ? "is-active" : ""} onClick={() => setGuia("encargos")}>Encargos sociais</button>
      </nav>
      {guia === "bdi" && <div className="orc-bdi-grid analytic-config-grid">
        <article className="orc-card">
          <header><div><span>COMPOSIÇÃO ANALÍTICA DO BDI</span><h3>Grupos e componentes percentuais</h3></div><strong>{bdiCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></header>
          <EditorPercentuais configuracao={componentes} alterar={setComponentes} prefixo="BDI" />
          <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={() => setComponentes(clonar(BDI_COMPONENTES_PADRAO))}>Restaurar planilha</button><button type="button" className="orc-btn orc-btn-primary" onClick={() => salvarBdi(componentes)}>Aplicar BDI</button></footer>
        </article>
        <aside className="orc-card orc-bdi-summary">
          <header><div><span>MEMÓRIA DE CÁLCULO</span><h3>Resultado</h3></div></header>
          {componentes.grupos.map((grupo) => <div key={grupo.id}><span>Grupo {grupo.id} · {grupo.nome}</span><strong>{grupo.itens.reduce((soma, item) => soma + Number(item.percentual || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></div>)}
          <div><span>BDI calculado</span><strong>{bdiCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></div>
          <div><span>Subtotal bruto</span><strong>{formatarMoeda(calcularTotais(orcamento).subtotalBruto)}</strong></div>
          <div><span>Desconto global</span><strong>− {formatarMoeda(calcularTotais(orcamento).valorDesconto)}</strong></div>
          <div className="total"><span>Preço com BDI</span><strong>{formatarMoeda(calcularTotais({ ...orcamento, bdiComponentes: componentes }).precoTotal)}</strong></div>
          <p>Fórmula: (((1 + A + B) × (1 + C) × (1 + D)) ÷ (1 − E)) − 1</p>
        </aside>
      </div>}
      {guia === "bdi-diferenciado" && <div className="orc-bdi-grid analytic-config-grid">
        <article className="orc-card">
          <header><div><span>MERO FORNECIMENTO DE MATERIAIS E EQUIPAMENTOS</span><h3>Composição analítica do BDI diferenciado</h3></div><strong>{bdiDiferenciadoCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></header>
          <aside className="orc-bdi-legal-note">
            <strong>Aplicação condicionada — Súmula TCU 253</strong>
            <span>A taxa reduzida somente será aplicada aos itens cuja memória demonstre simultaneamente inviabilidade de parcelamento, natureza específica, fornecedor especializado, impacto significativo, mera intermediação e separação dos serviços associados.</span>
          </aside>
          <EditorPercentuais configuracao={componentesDiferenciados} alterar={setComponentesDiferenciados} prefixo="BDI diferenciado" />
          <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={() => setComponentesDiferenciados(clonar(BDI_DIFERENCIADO_COMPONENTES_PADRAO))}>Restaurar referência TCU</button><button type="button" className="orc-btn orc-btn-primary" onClick={() => salvarBdiDiferenciado(componentesDiferenciados)}>Aplicar BDI diferenciado</button></footer>
        </article>
        <aside className="orc-card orc-bdi-summary">
          <header><div><span>REFERÊNCIA E INCIDÊNCIA</span><h3>Acórdão TCU 2.622/2013</h3></div></header>
          <div><span>1º quartil</span><strong>11,10%</strong></div>
          <div><span>Referência média</span><strong>14,02%</strong></div>
          <div><span>3º quartil</span><strong>16,80%</strong></div>
          <div><span>Taxa calculada nesta proposta</span><strong>{bdiDiferenciadoCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></div>
          <div><span>Base elegível</span><strong>{formatarMoeda(totais.baseBdiDiferenciado)}</strong></div>
          <div><span>Valor do BDI diferenciado</span><strong>{formatarMoeda(totais.valorBdiDiferenciado)}</strong></div>
          <div className="total"><span>Itens validados</span><strong>{totais.itensBdiDiferenciado}</strong></div>
          <p>Os percentuais são referências para análise, não limites automáticos. Valores fora da faixa exigem exame pormenorizado e justificativa do caso concreto.</p>
        </aside>
      </div>}
      {guia === "encargos" && <div className="social-charges-grid analytic-config-grid">
        <article className="orc-card">
          <header><div><span>COMPOSIÇÃO ANALÍTICA DAS TAXAS</span><h3>Encargos sociais por grupo</h3></div><strong>{totalEncargos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></header>
          <div className="social-charges-form compact">
            <label><span>Fonte</span><input value={encargos.fonte} onChange={(event) => setEncargos((atual) => ({ ...atual, fonte: event.target.value }))} /></label>
            <label><span>Estado</span><input maxLength="5" value={encargos.uf} onChange={(event) => setEncargos((atual) => ({ ...atual, uf: event.target.value.toUpperCase() }))} /></label>
            <label><span>Mês de referência</span><input value={encargos.referencia} onChange={(event) => setEncargos((atual) => ({ ...atual, referencia: event.target.value }))} /></label>
            <label><span>Regime</span><select value={encargos.regime} onChange={(event) => setEncargos((atual) => ({ ...atual, regime: event.target.value }))}><option>Sem desoneração</option><option>Desonerado</option><option>Personalizado</option></select></label>
          </div>
          <EditorPercentuais configuracao={encargos} alterar={setEncargos} prefixo="encargos" />
          <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={() => setEncargos(clonar(ENCARGOS_SOCIAIS_PADRAO))}>Restaurar planilha</button><button type="button" className="orc-btn orc-btn-primary" onClick={() => salvarEncargos(encargos)}>Aplicar encargos</button></footer>
        </article>
        <aside className="orc-card social-charges-summary">
          <header><div><span>RESUMO</span><h3>Encargos sociais</h3></div></header>
          {encargos.grupos.map((grupo) => <div key={grupo.id}><span>Grupo {grupo.id} · {grupo.nome}</span><strong>{grupo.itens.reduce((soma, item) => soma + Number(item.percentual || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></div>)}
          <div><span>Total geral (A + B + C + D)</span><strong>{totalEncargos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</strong></div>
          <div><span>Publicação</span><strong>{encargos.fonte} · {encargos.uf} · {encargos.referencia}</strong></div>
          <p>{encargos.observacoes}</p>
        </aside>
      </div>}
    </>
  );
}

function ModalImportarBasePrecos({ fechar, importar, carregando }) {
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState({
    fonte: "SINAPI",
    fontePersonalizada: "",
    uf: "RS",
    referencia: "06/2026",
    regime: "SEM-DESONERACAO",
  });
  const ufs = ["GERAL","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  async function enviar(event) {
    event.preventDefault();
    if (!arquivo) return;
    setErro("");
    try {
      const fonte = dados.fonte === "OUTRA" ? dados.fontePersonalizada.trim() : dados.fonte;
      if (!fonte) throw new Error("Informe o nome da base de preços.");
      await importar(arquivo, { ...dados, fonte });
      fechar();
    } catch (error) {
      setErro(error.message || "Não foi possível importar a publicação.");
    }
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-importar-base" onMouseDown={(event) => event.stopPropagation()} onSubmit={enviar}>
        <header><div><span>BASES VERSIONADAS</span><h3 id="orc-importar-base">Importar base de preços</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Base</span><select value={dados.fonte} onChange={(event) => setDados((atual) => ({ ...atual, fonte: event.target.value, regime: event.target.value === "SINAPI" ? "SEM-DESONERACAO" : "PADRAO" }))}><option value="SINAPI">SINAPI</option><option value="PLEO">PLEO</option><option value="SBC">SBC</option><option value="ORSE">ORSE</option><option value="OUTRA">Outra base</option></select></label>
          {dados.fonte === "OUTRA" && <label><span>Nome da base</span><input required value={dados.fontePersonalizada} onChange={(event) => setDados((atual) => ({ ...atual, fontePersonalizada: event.target.value }))} placeholder="Ex.: SICRO" /></label>}
          <label><span>UF</span><select value={dados.uf} onChange={(event) => setDados((atual) => ({ ...atual, uf: event.target.value }))}>{ufs.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
          <label><span>Referência</span><input required value={dados.referencia} onChange={(event) => setDados((atual) => ({ ...atual, referencia: event.target.value }))} placeholder="MM/AAAA" /></label>
          <label className="orc-field-wide"><span>Regime</span><select value={dados.regime} onChange={(event) => setDados((atual) => ({ ...atual, regime: event.target.value }))}><option value="PADRAO">Padrão da base</option><option value="SEM-DESONERACAO">Sem desoneração</option><option value="DESONERADO">Desonerado</option><option value="SEM-ENCARGOS">Sem encargos sociais</option></select></label>
          <label className="orc-field-wide orc-file-drop"><span>Arquivo da base de preços</span><input required type="file" accept=".zip,.xlsx,.xls" onChange={(event) => setArquivo(event.target.files[0] || null)} /><small>{arquivo ? arquivo.name : "Selecione um ZIP, XLSX ou XLS da base escolhida."}</small></label>
          <div className="orc-sinapi-official-note orc-field-wide"><strong>Importação preservada e independente</strong><span>O arquivo será versionado fora dos orçamentos. Para o pacote SINAPI, o PRUMO lê preços, composições analíticas, famílias, manutenções e mão de obra.</span></div>
          {erro && <div className="orc-form-error orc-field-wide">{erro}</div>}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary" disabled={carregando || !arquivo}>{carregando ? "Importando..." : "Importar e versionar"}</button></footer>
      </form>
    </div>
  );
}

function Bases({ orcamento, adicionarComposicao, removerComposicao, setAviso, basesPrecos, atualizarPrecos }) {
  const [mostrarImportacao, setMostrarImportacao] = useState(false);
  const [novaComposicao, setNovaComposicao] = useState({
    codigo: "",
    descricao: "",
    unidade: "UN",
    custoUnitario: "",
    componentes: [],
  });
  const [buscaComponente, setBuscaComponente] = useState("");
  const [coeficienteComponente, setCoeficienteComponente] = useState("1");
  const termoComponente = buscaComponente.trim().toLocaleLowerCase("pt-BR");
  const resultadosComponentes = termoComponente
    ? basesPrecos.referencias
      .filter((referencia) => ["insumo", "composicao"].includes(referencia.tipo))
      .filter((referencia) => `${referencia.codigo} ${referencia.descricao}`.toLocaleLowerCase("pt-BR").includes(termoComponente))
      .slice(0, 8)
    : [];
  const custoComponentes = novaComposicao.componentes.reduce(
    (total, componente) => total + Number(componente.coeficiente) * Number(componente.preco),
    0,
  );

  function salvarComposicao(event) {
    event.preventDefault();
    adicionarComposicao(novaComposicao);
    setNovaComposicao({ codigo: "", descricao: "", unidade: "UN", custoUnitario: "", componentes: [] });
    setBuscaComponente("");
    setAviso("Composição própria cadastrada.");
  }

  function adicionarComponente(referencia) {
    if (!basesPrecos.baseAtiva || Number(coeficienteComponente) <= 0) return;
    setNovaComposicao((atual) => ({
      ...atual,
      componentes: [
        ...atual.componentes,
        {
          basePrecoId: basesPrecos.baseAtiva.id,
          baseTitulo: basesPrecos.baseAtiva.titulo,
          referenciaTipo: referencia.tipo,
          referenciaCodigo: referencia.codigo,
          descricao: referencia.descricao,
          unidade: referencia.unidade,
          coeficiente: coeficienteComponente,
          preco: referencia.preco,
        },
      ],
    }));
    setBuscaComponente("");
    setCoeficienteComponente("1");
  }

  async function importarBase(arquivo, dados) {
    const resultado = await basesPrecos.importar(arquivo, dados);
    setAviso(`${resultado.base.total.toLocaleString("pt-BR")} preços e ${resultado.base.registros.toLocaleString("pt-BR")} registros importados.`);
  }
  const baseAtiva = basesPrecos.baseAtiva;
  const integridadePreco = baseAtiva?.total
    ? ((baseAtiva.total - baseAtiva.semPreco) / baseAtiva.total) * 100
    : 0;
  return (
    <>
      {mostrarImportacao && <ModalImportarBasePrecos fechar={() => setMostrarImportacao(false)} importar={importarBase} carregando={basesPrecos.carregando} />}
      <div className="orc-bases-grid">
        <section className="orc-card orc-base-list">
          <header><div><span>BASES VERSIONADAS</span><h3>Catálogos de preços independentes</h3></div><div className="orc-base-actions">{baseAtiva && <button type="button" onClick={atualizarPrecos}>↻ Atualizar vínculos</button>}<button type="button" onClick={() => setMostrarImportacao(true)}>＋ Importar base</button></div></header>
          {basesPrecos.bases.map((base) => <article key={base.id}><div className="orc-base-icon">◫</div><div><strong>{base.titulo}</strong><span>{base.fonte || "BASE"} · {base.regime} · {base.statusPreco}</span><small>{base.insumos.toLocaleString("pt-BR")} insumos · {base.composicoes.toLocaleString("pt-BR")} composições · {(base.registros || base.total).toLocaleString("pt-BR")} registros</small></div><b className={base.id === basesPrecos.baseAtivaId ? "is-active" : ""}>{base.id === basesPrecos.baseAtivaId ? "Selecionada" : "Disponível"}</b><button type="button" onClick={() => basesPrecos.setBaseAtivaId(base.id)}>Selecionar →</button><button type="button" className="orc-delete-base" onClick={() => { if (window.confirm(`Excluir a base ${base.titulo}?`)) basesPrecos.remover(base.id); }} aria-label={`Excluir base ${base.titulo}`}>×</button></article>)}
          {!basesPrecos.bases.length && <div className="orc-empty-base"><strong>Nenhuma base importada</strong><span>Importe SINAPI, PLEO, SBC, ORSE ou outra planilha estruturada.</span></div>}
          <article><div className="orc-base-icon">◆</div><div><strong>Base corporativa PRUMO</strong><span>Cotações e composições próprias</span><small>{orcamento.composicoes.length} composições cadastradas</small></div><b className="is-active">Local</b></article>
        </section>
        <aside className="orc-card orc-import-status">
          <header><div><span>BASE SELECIONADA</span><h3>Integridade da publicação</h3></div></header>
          {baseAtiva ? <>
            <div className="orc-quality-score"><strong>{integridadePreco.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong><span>COM PREÇO</span></div>
            <ul><li><i>✓</i> {baseAtiva.total.toLocaleString("pt-BR")} referências de preço</li><li><i>✓</i> UF {baseAtiva.uf} · {baseAtiva.referencia}</li>{!baseAtiva.propria && <li><i>✓</i> {(baseAtiva.arquivos?.filter(Boolean) || (baseAtiva.arquivo ? [baseAtiva.arquivo] : [])).length} arquivo(s) processado(s)</li>}<li><i>✓</i> {(baseAtiva.itensComposicao || 0).toLocaleString("pt-BR")} vínculos analíticos</li><li><i>!</i> {baseAtiva.semPreco.toLocaleString("pt-BR")} referências sem preço</li></ul>
            {baseAtiva.hash
              ? <small title={baseAtiva.hash}>SHA-256: {String(baseAtiva.hash).slice(0, 18)}…</small>
              : <small>Base gerenciada pelo PRUMO · sem arquivo externo</small>}
          </> : <div className="orc-no-active-base"><strong>Sem base selecionada</strong><span>A integridade será calculada após a primeira importação.</span></div>}
        </aside>
      </div>
      <section className="orc-card orc-compositions">
        <header><div><span>BASE CORPORATIVA</span><h3>Composições próprias</h3></div><strong>{orcamento.composicoes.length} cadastradas</strong></header>
        <form className="orc-composition-form" onSubmit={salvarComposicao}>
          <div className="orc-composition-main">
            <input required value={novaComposicao.codigo} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, codigo: event.target.value }))} placeholder="Código CPU" />
            <input required value={novaComposicao.descricao} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Descrição da composição" />
            <select value={novaComposicao.unidade} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, unidade: event.target.value }))}>{UNIDADES_ORCAMENTARIAS.map((unidade) => <option key={unidade}>{unidade}</option>)}</select>
            <input required={!novaComposicao.componentes.length} disabled={novaComposicao.componentes.length > 0} type="number" min="0" step="any" value={novaComposicao.componentes.length ? custoComponentes : novaComposicao.custoUnitario} onChange={(event) => setNovaComposicao((atual) => ({ ...atual, custoUnitario: event.target.value }))} placeholder="Custo unitário" />
            <button type="submit">＋ Cadastrar</button>
          </div>
          <div className="orc-composition-source">
            <label><span>Adicionar composição ou insumo da base selecionada</span><input disabled={!baseAtiva} value={buscaComponente} onChange={(event) => setBuscaComponente(event.target.value)} placeholder={baseAtiva ? `Buscar em ${baseAtiva.titulo}` : "Selecione uma base de preços"} /></label>
            <label><span>Coeficiente</span><input type="number" min="0.00000001" step="any" value={coeficienteComponente} onChange={(event) => setCoeficienteComponente(event.target.value)} /></label>
            {resultadosComponentes.length > 0 && <div className="orc-composition-results">{resultadosComponentes.map((referencia) => <button type="button" key={`${referencia.tipo}-${referencia.codigo}`} onClick={() => adicionarComponente(referencia)}><span><strong>{referencia.codigo}</strong>{referencia.descricao}</span><b>{referencia.tipo} · {formatarPrecoUnitario(referencia.preco)}</b></button>)}</div>}
          </div>
          {novaComposicao.componentes.length > 0 && <div className="orc-component-draft">{novaComposicao.componentes.map((componente, index) => <div key={`${componente.basePrecoId}-${componente.referenciaTipo}-${componente.referenciaCodigo}-${index}`}><span><strong>{componente.referenciaCodigo}</strong>{componente.descricao}<small>{componente.baseTitulo} · coef. {componente.coeficiente}</small></span><b>{formatarPrecoUnitario(Number(componente.coeficiente) * Number(componente.preco))}</b><button type="button" onClick={() => setNovaComposicao((atual) => ({ ...atual, componentes: atual.componentes.filter((_, itemIndex) => itemIndex !== index) }))}>×</button></div>)}</div>}
        </form>
        <div className="orc-composition-list">
          {orcamento.composicoes.map((composicao) => <article key={composicao.id}><span><strong>{composicao.codigo}</strong><small>{composicao.unidade}</small></span><div><strong>{composicao.descricao}</strong><small>{composicao.componentes?.length ? `${composicao.componentes.length} referências externas vinculadas` : "Composição própria manual"}</small></div><b>{formatarPrecoUnitario(composicao.custoUnitario)}</b><button type="button" onClick={() => removerComposicao(composicao.id)} aria-label={`Excluir composição ${composicao.codigo}`}>×</button></article>)}
          {!orcamento.composicoes.length && <p>Nenhuma composição própria cadastrada neste orçamento.</p>}
        </div>
      </section>
    </>
  );
}

function CabecalhoPeriodo({ periodo, totalEquipe = null }) {
  return <span className="orc-period-heading"><strong>{periodo.label}</strong><small>{periodo.subLabel}</small>{totalEquipe != null && <b>Total: {Math.max(0, Math.trunc(Number(totalEquipe) || 0)).toLocaleString("pt-BR")} pessoas</b>}</span>;
}

function CampoPercentual({ valor, onChange, ariaLabel }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor === "" ? "" : Number(valor || 0).toFixed(2));
  useEffect(() => {
    if (!editando) setTexto(valor === "" ? "" : Number(valor || 0).toFixed(2));
  }, [valor, editando]);
  return <input type="number" min="0" max="100" step="any" aria-label={ariaLabel} value={texto} onFocus={() => {
    setEditando(true);
    setTexto(valor === "" ? "" : String(Number(valor || 0)));
  }} onChange={(event) => {
    setTexto(event.target.value);
    onChange(event.target.value);
  }} onBlur={() => {
    setEditando(false);
    setTexto(texto === "" ? "" : Number(texto || 0).toFixed(2));
  }} />;
}

function Cronograma({
  orcamento,
  atualizarQuantidade,
  atualizarGrupo,
  limparValores,
  distribuirSaldos,
}) {
  const cronograma = obterCronogramaProposto(orcamento);
  const { periodos, servicos } = cronograma;
  const [modo, setModo] = useState("percentual");
  const [gruposRecolhidos, setGruposRecolhidos] = useState(() => new Set());
  const servicosPorId = new Map(servicos.map((item) => [item.item.id, item]));
  const itensPorId = new Map(orcamento.itens.map((item) => [item.id, item]));
  const totais = calcularTotais(orcamento);
  const valores = periodos.map((periodo) => servicos.reduce((total, { item, quantidades }) => {
    const quantidadeTotal = Number(item.quantidade) || 0;
    return total + (quantidadeTotal
      ? totalItem(item) * (Number(quantidades[periodo.inicio]) || 0) / quantidadeTotal
      : 0);
  }, 0));
  function percentualServico(servico, periodoInicio) {
    const total = Number(servico.item.quantidade) || 0;
    return total ? (Number(servico.quantidades[periodoInicio]) || 0) / total * 100 : 0;
  }
  function servicosDoGrupo(grupo) {
    return servicos.filter(({ item }) => item.codigo.startsWith(`${grupo.codigo}.`));
  }
  function percentualGrupo(grupo, periodoInicio) {
    const descendentes = servicosDoGrupo(grupo);
    const valorTotal = descendentes.reduce((total, servico) => total + totalItem(servico.item), 0);
    const valorPeriodo = descendentes.reduce((total, servico) => (
      total + totalItem(servico.item) * percentualServico(servico, periodoInicio) / 100
    ), 0);
    return valorTotal ? valorPeriodo / valorTotal * 100 : 0;
  }
  function periodoGrupoVazio(grupo, periodoInicio) {
    const descendentes = servicosDoGrupo(grupo);
    return descendentes.length > 0 && descendentes.every(
      (servico) => servico.quantidades[periodoInicio] === ""
        || servico.quantidades[periodoInicio] == null,
    );
  }
  function alternarGrupo(grupoId) {
    setGruposRecolhidos((atuais) => {
      const proximos = new Set(atuais);
      if (proximos.has(grupoId)) proximos.delete(grupoId);
      else proximos.add(grupoId);
      return proximos;
    });
  }
  function itemOculto(item) {
    let parentId = item.parentId;
    while (parentId) {
      if (gruposRecolhidos.has(parentId)) return true;
      parentId = itensPorId.get(parentId)?.parentId;
    }
    return false;
  }
  return (
    <>
      <div className="orc-schedule-kpis"><div><span>VALOR PLANEJADO</span><strong>{formatarMoeda(totais.precoTotal)}</strong></div><div><span>PRAZO CORRIDO</span><strong>{orcamento.prazoDias} dias</strong></div><div><span>FIM DA OBRA</span><strong>{formatarDataObra(orcamento.fimObra)}</strong></div><div><span>MEDIÇÕES</span><strong>{periodos.length} períodos</strong></div></div>
      <article className="orc-card orc-schedule">
        <header><div><span>CRONOGRAMA PROPOSTO</span><h3>EAP e execução por período</h3></div><div className="orc-planning-tools"><button type="button" onClick={() => limparValores()}>Limpar tudo</button><button type="button" onClick={() => distribuirSaldos()}>Distribuir todos</button><div className="orc-schedule-mode"><button type="button" className={modo === "percentual" ? "is-active" : ""} onClick={() => setModo("percentual")}>%</button><button type="button" className={modo === "quantidade" ? "is-active" : ""} onClick={() => setModo("quantidade")}>Quantidade</button></div></div></header>
        <div className="orc-schedule-editor">
          <table>
            <thead><tr><th>ITEM / EAP / SERVIÇO</th><th>TOTAL</th>{periodos.map((periodo) => <th key={periodo.inicio}><CabecalhoPeriodo periodo={periodo} /></th>)}<th>PROGRAMADO</th><th>STATUS</th><th>AÇÕES DA LINHA</th></tr></thead>
            <tbody>
              {orcamento.itens.filter((item) => !itemOculto(item)).map((item) => {
                const grupo = item.tipo === "grupo";
                const servico = servicosPorId.get(item.id);
                const percentuais = periodos.map((periodo) => (
                  grupo ? percentualGrupo(item, periodo.inicio) : percentualServico(servico, periodo.inicio)
                ));
                const programadoPercentual = percentuais.reduce((soma, valor) => soma + valor, 0);
                const programadoQuantidade = grupo ? 0 : Object.values(servico.quantidades).reduce((soma, valor) => soma + Number(valor || 0), 0);
                const consistente = Math.abs(programadoPercentual - 100) < 0.001;
                return <tr key={item.id} className={grupo ? "is-eap" : ""}><td style={{ paddingLeft: `${8 + Math.max(0, String(item.codigo).split(".").length - 1) * 12}px` }}>{grupo && <button type="button" className="orc-eap-toggle" aria-label={`${gruposRecolhidos.has(item.id) ? "Expandir" : "Recolher"} ${item.codigo} ${item.descricao}`} onClick={() => alternarGrupo(item.id)}>{gruposRecolhidos.has(item.id) ? "▸" : "▾"}</button>}<div><strong>{item.codigo}</strong><span>{item.descricao}</span></div></td><td>{grupo ? formatarMoeda(totalGrupo(orcamento.itens, item.codigo)) : `${Number(item.quantidade || 0).toLocaleString("pt-BR")} ${item.unidade}`}</td>{periodos.map((periodo, indice) => {
                  const quantidadeInformada = grupo ? null : servico.quantidades[periodo.inicio];
                  const valor = grupo
                    ? (periodoGrupoVazio(item, periodo.inicio) ? "" : percentuais[indice])
                    : modo === "percentual"
                      ? (quantidadeInformada === "" || quantidadeInformada == null ? "" : percentuais[indice])
                      : quantidadeInformada;
                  return <td key={periodo.inicio}>{grupo || modo === "percentual" ? <CampoPercentual valor={valor} ariaLabel={`${item.codigo} ${periodo.label} percentual`} onChange={(novoValor) => {
                    if (grupo) atualizarGrupo(item.id, periodo.inicio, novoValor);
                    else atualizarQuantidade(item.id, periodo.inicio, novoValor === "" ? "" : Number(item.quantidade || 0) * Number(novoValor || 0) / 100);
                  }} /> : <input type="number" min="0" step="any" aria-label={`${item.codigo} ${periodo.label} quantidade`} value={valor} onChange={(event) => atualizarQuantidade(item.id, periodo.inicio, event.target.value)} />}<small>{grupo || modo === "percentual" ? "%" : item.unidade}</small></td>;
                })}<td>{grupo || modo === "percentual" ? `${programadoPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : programadoQuantidade.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</td><td><em className={consistente ? "is-ok" : "is-warning"}>{consistente ? "OK" : "REVISAR"}</em></td><td><span className="orc-row-planning-actions"><button type="button" onClick={() => limparValores(item.id)}>Limpar</button><button type="button" onClick={() => distribuirSaldos(item.id)}>Distribuir</button></span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <footer className="orc-schedule-summary">{periodos.map((periodo, indice) => <div key={periodo.inicio}><CabecalhoPeriodo periodo={periodo} /><strong>{formatarMoeda(valores[indice])}</strong></div>)}</footer>
      </article>
    </>
  );
}

function Histograma({
  orcamento,
  atualizarEquipe,
  limparValores,
  distribuirSaldos,
  basesPrecos,
}) {
  const histogramaLocal = obterHistogramaInteligente(orcamento);
  const [memoriaAnalitica, setMemoriaAnalitica] = useState(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    consolidarDemandaSuprimentos(
      orcamento,
      basesPrecos?.carregarItensComposicao,
      basesPrecos?.bases,
    ).then((resultado) => {
      if (ativo) setMemoriaAnalitica(resultado);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [orcamento.itens, orcamento.composicoes, basesPrecos?.carregarItensComposicao, basesPrecos?.bases]);
  const { periodos } = histogramaLocal;
  const cronograma = obterCronogramaProposto(orcamento);
  const servicosPorId = new Map(cronograma.servicos.map((item) => [item.item.id, item]));
  const funcoesAnaliticas = (memoriaAnalitica?.maoObra || []).map((recurso) => {
    const sugerido = Object.fromEntries(periodos.map((periodo) => {
      const dias = Math.max(1, calcularPrazoDias(periodo.inicio, periodo.fim) + 1);
      const horas = recurso.origensDetalhadas.reduce((total, origem) => {
        const servico = servicosPorId.get(origem.servicoId);
        const quantidadeTotal = Number(servico?.item.quantidade) || 0;
        const proporcao = quantidadeTotal
          ? Number(servico.quantidades[periodo.inicio] || 0) / quantidadeTotal
          : 0;
        return total + Number(origem.quantidade || 0) * proporcao;
      }, 0);
      return [periodo.inicio, Math.ceil(horas / (dias * 8))];
    }));
    return {
      funcao: recurso.descricao,
      totalHoras: Number(recurso.quantidade || 0),
      sugerido,
      quantidades: Object.fromEntries(periodos.map((periodo) => [
        periodo.inicio,
        orcamento.histogramaEquipes?.[recurso.descricao]?.[periodo.inicio]
          ?? sugerido[periodo.inicio],
      ])),
    };
  });
  const funcoes = funcoesAnaliticas.length ? funcoesAnaliticas : histogramaLocal.funcoes;
  const picos = periodos.map((periodo) => funcoes.reduce(
    (total, item) => total + Number(item.quantidades[periodo.inicio] || 0),
    0,
  ));
  const maiorPico = Math.max(...picos, 0);
  const indicePico = picos.indexOf(maiorPico);
  return (
    <article className="orc-card orc-histogram">
      <header><div><span>EQUIPE PROPOSTA · {periodos.length} PERÍODOS</span><h3>Dimensionamento inteligente da mão de obra</h3></div><div className="orc-histogram-actions"><strong>{carregando ? "Lendo composições analíticas…" : maiorPico ? `Pico: ${maiorPico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} profissionais · ${periodos[indicePico]?.label}` : "Sem mão de obra analítica vinculada"}</strong><span><button type="button" disabled={!funcoes.length} onClick={() => limparValores(funcoes, periodos)}>Limpar tudo</button><button type="button" disabled={!funcoes.length} onClick={() => distribuirSaldos(funcoes, periodos)}>Distribuir todos</button></span></div></header>
      <div className="orc-hist-grid is-editable">
        <div className="orc-hist-head" style={{ gridTemplateColumns: `280px repeat(${periodos.length}, 100px)` }}><span>FUNÇÃO / HORAS</span>{periodos.map((periodo, indice) => <CabecalhoPeriodo key={periodo.inicio} periodo={periodo} totalEquipe={picos[indice]} />)}</div>
        {funcoes.map(({ funcao, totalHoras, sugerido, quantidades }) => <div className="orc-hist-row" style={{ gridTemplateColumns: `280px repeat(${periodos.length}, 100px)` }} key={funcao}><div className="orc-hist-resource"><strong>{funcao}</strong><small>Total recomendado: {Number(totalHoras || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h</small><small>Sugestão automática · edição livre em pessoas inteiras</small><span className="orc-row-planning-actions"><button type="button" onClick={() => limparValores(funcoes, periodos, funcao)}>Limpar</button><button type="button" onClick={() => distribuirSaldos(funcoes, periodos, funcao)}>Distribuir</button></span></div>{periodos.map((periodo) => <label key={periodo.inicio}><input type="number" min="0" step="1" inputMode="numeric" aria-label={`${funcao} ${periodo.label}`} value={quantidades[periodo.inicio]} onChange={(event) => atualizarEquipe(funcao, periodo.inicio, event.target.value)} /><small>Sugerido: {Math.max(0, Math.trunc(Number(sugerido[periodo.inicio]) || 0)).toLocaleString("pt-BR")}</small></label>)}</div>)}
        {!funcoes.length && <div className="orc-hist-empty"><strong>Não há funções rastreáveis nas composições.</strong><span>Vincule componentes de mão de obra com unidade H/HH ou serviços mensais identificados por função para gerar a equipe automaticamente.</span></div>}
      </div>
    </article>
  );
}

function Medicoes({ orcamento, abrirMedicao }) {
  const propostas = criarMedicoesPropostas(orcamento);
  const salvas = orcamento.medicoes || [];
  const porInicio = new Map(salvas.map((medicao) => [medicao.inicio, medicao]));
  const medicoes = propostas.map((proposta) => porInicio.get(proposta.inicio) || proposta);
  salvas.filter((medicao) => !medicao.inicio || !propostas.some((item) => item.inicio === medicao.inicio))
    .forEach((medicao) => medicoes.unshift(medicao));
  const totalMedido = medicoes.reduce((total, medicao) => total + Number(medicao.valorMedido || 0), 0);
  const retencoes = medicoes.reduce((total, medicao) => total + (medicao.retencoes || []).reduce((soma, item) => soma + Number(item.valor || 0), 0), 0);
  const multas = medicoes.reduce((total, medicao) => total + (medicao.multas || []).reduce((soma, item) => soma + Number(item.valor || 0), 0), 0);
  const totais = calcularTotais(orcamento);
  const totalContratual = Number(orcamento.baseContratada?.valorContratado ?? totais.precoTotal);
  return (
    <>
      <div className="orc-schedule-kpis"><div><span>TOTAL MEDIDO</span><strong>{formatarMoeda(totalMedido)}</strong></div><div><span>RETENÇÕES E MULTAS</span><strong>{formatarMoeda(retencoes + multas)}</strong></div><div><span>SALDO CONTRATUAL</span><strong>{formatarMoeda(Math.max(0, totalContratual - totalMedido))}</strong><small>{orcamento.baseContratada ? "Base homologada da licitação" : "Sem base contratada homologada"}</small></div><div><span>AVANÇO ACUMULADO</span><strong>{totalContratual ? (totalMedido / totalContratual).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 }) : "0%"}</strong></div></div>
      <article className="orc-card orc-measurements">
        <header><div><span>BOLETINS · PRÉ-PREENCHIDOS PELO CRONOGRAMA</span><h3>Medições propostas e realizadas</h3></div><button type="button" onClick={() => abrirMedicao(null)}>＋ Nova medição</button></header>
        {medicoes.map((medicao) => {
          const descontos = (medicao.retencoes || []).reduce((soma, item) => soma + Number(item.valor || 0), 0)
            + (medicao.multas || []).reduce((soma, item) => soma + Number(item.valor || 0), 0);
          return <div key={medicao.id}><span className="orc-measure-id">{medicao.id}</span><span><strong>{medicao.periodo}</strong><small>{formatarDataObra(medicao.inicio)} → {formatarDataObra(medicao.fim)}</small></span><b className={medicao.status === "Aprovada" ? "approved" : ""}>{medicao.status}</b><span><strong>{formatarMoeda(medicao.valorMedido || medicao.valorPrevisto)}</strong><small>{medicao.proposta ? "Valor previsto" : "Valor informado"}</small></span><span><strong>{descontos ? `− ${formatarMoeda(descontos)}` : "Sem descontos"}</strong><small>{(medicao.documentos || []).length} documento(s) indicado(s)</small></span><button type="button" onClick={() => abrirMedicao(medicao)}>Abrir →</button></div>;
        })}
      </article>
    </>
  );
}

function Licitacoes({ orcamento, gerar, gerando, registrarBase, avisar }) {
  const [selecionadas, setSelecionadas] = useState([
    "Instruções", "Orçamento Completo", "Proposta de Preços",
    "BDI e Encargos", "Cronograma", "Histograma",
  ]);
  const resumo = resumirPacoteLicitacao(orcamento, selecionadas);
  const [resultadoLicitacao, setResultadoLicitacao] = useState({ fornecedor: "", processoId: "", contratoId: "", descontoPercentual: "", justificativa: "Resultado homologado conforme processo de contratação." });
  const aprovado = String(orcamento.status || "").toLocaleLowerCase("pt-BR").includes("aprov");
  const estimativaContratada = resumo.precoTotal * (1 - Math.max(0, Math.min(99.9999, Number(resultadoLicitacao.descontoPercentual || 0))) / 100);
  async function homologar(event) {
    event.preventDefault();
    try {
      await registrarBase({ ...resultadoLicitacao, descontoPercentual: Number(resultadoLicitacao.descontoPercentual || 0) });
      avisar("Resultado homologado. A base contratada foi congelada para as medições.");
    } catch (error) {
      avisar(error.message);
    }
  }
  const abas = [
    ["01", "Instruções", "Instruções", "Regras de preenchimento e identificação da revisão.", "Bloqueada"],
    ["02", "Orçamento Completo", "Orçamento completo", "Memória com custos, bases, desconto, BDI e preço total.", "Bloqueada"],
    ["03", "Proposta de Preços", "Proposta de preços", "Somente valores unitários de mão de obra e material.", "Preenchível"],
    ["04", "BDI e Encargos", "BDI e encargos", "Percentuais analíticos e resultados calculados.", "Preenchível"],
    ["05", "Cronograma", "Cronograma", "Distribuição percentual ou quantitativa da EAP nos períodos configurados.", "Preenchível"],
    ["06", "Histograma", "Histograma", "Horas e equipes de mão de obra derivadas do cronograma.", "Calculada"],
  ];
  const dependencias = {
    "Orçamento Completo": ["BDI e Encargos"],
    "Proposta de Preços": ["Orçamento Completo", "BDI e Encargos"],
    Cronograma: ["Orçamento Completo", "BDI e Encargos"],
    Histograma: ["Cronograma", "Orçamento Completo", "BDI e Encargos"],
  };
  function alternarAba(nome) {
    setSelecionadas((atuais) => {
      if (atuais.includes(nome)) {
        return atuais.filter((item) => (
          item !== nome
          && !(dependencias[item] || []).includes(nome)
        ));
      }
      return [...new Set([...atuais, nome, ...(dependencias[nome] || [])])];
    });
  }
  return (
    <>
      <div className="orc-bid-kpis">
        <article><span>ARQUIVO</span><strong>1 XLSX</strong><small>{resumo.abas} abas integradas</small></article>
        <article><span>SERVIÇOS</span><strong>{resumo.servicos}</strong><small>Itens disponíveis na proposta</small></article>
        <article><span>PERÍODOS DE MEDIÇÃO</span><strong>{resumo.periodos}</strong><small>Intervalos de {orcamento.intervaloMedicaoDias} dias</small></article>
        <article><span>REVISÃO DISTRIBUÍDA</span><strong>{orcamento.revisao}</strong><small>{orcamento.id}</small></article>
      </div>
      <article className="orc-card orc-bid-package">
        <header>
          <div><span>PACOTE DA CONCORRÊNCIA</span><h3>Planilhas integradas e protegidas</h3></div>
          <button type="button" disabled={gerando || !selecionadas.length} onClick={() => gerar(selecionadas)}>{gerando ? "Gerando arquivo…" : `⇩ Exportar ${selecionadas.length} planilha(s)`}</button>
        </header>
        <div className="orc-bid-summary">
          <div><span>ORÇAMENTO</span><strong>{orcamento.nome}</strong><small>{orcamento.id}</small></div>
          <div><span>PREÇO DE REFERÊNCIA</span><strong>{formatarMoeda(resumo.precoTotal)}</strong><small>BDI de {resumo.bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</small></div>
          <div><span>PRAZO CONTRATUAL</span><strong>{formatarDataObra(orcamento.inicioObra)} → {formatarDataObra(orcamento.fimObra)}</strong><small>Fórmulas bloqueadas e entradas em amarelo</small></div>
        </div>
        <section className="orc-bid-sheet-list">
          {abas.map(([numero, chave, nome, descricao, modo]) => (
            <div key={numero}>
              <label className="orc-bid-check"><input type="checkbox" checked={selecionadas.includes(chave)} onChange={() => alternarAba(chave)} /><span /></label>
              <b>{numero}</b>
              <span><strong>{nome}</strong><small>{descricao}</small></span>
              <em className={modo === "Preenchível" ? "is-editable" : ""}>{modo}</em>
            </div>
          ))}
        </section>
      </article>
      <article className="orc-card orc-contract-baseline">
        <header><div><span>RESULTADO DA LICITAÇÃO</span><h3>Base contratada para execução e medições</h3></div><b className={orcamento.baseContratada ? "approved" : ""}>{orcamento.baseContratada ? "Homologada" : "Pendente"}</b></header>
        {orcamento.baseContratada ? <>
          <div className="orc-bid-summary"><div><span>VENCEDOR</span><strong>{orcamento.baseContratada.fornecedor}</strong><small>{orcamento.baseContratada.processoId || "Processo não informado"}</small></div><div><span>PUBLICADO</span><strong>{formatarMoeda(orcamento.baseContratada.valorPublicado)}</strong><small>Orçamento original preservado</small></div><div><span>CONTRATADO</span><strong>{formatarMoeda(orcamento.baseContratada.valorContratado)}</strong><small>Desconto linear de {Number(orcamento.baseContratada.descontoPercentual).toLocaleString("pt-BR")}%</small></div></div>
          <p className="orc-contract-note">Os preços unitários homologados estão congelados. Alterações solicitadas pela obra deverão tramitar como aditivo pela engenharia de custos.</p>
        </> : <form className="orc-contract-form" onSubmit={homologar}>
          <label><span>Empresa vencedora</span><input required value={resultadoLicitacao.fornecedor} onChange={(event) => setResultadoLicitacao((atual) => ({ ...atual, fornecedor: event.target.value }))} /></label>
          <label><span>Processo/licitação</span><input value={resultadoLicitacao.processoId} onChange={(event) => setResultadoLicitacao((atual) => ({ ...atual, processoId: event.target.value }))} /></label>
          <label><span>Contrato</span><input value={resultadoLicitacao.contratoId} onChange={(event) => setResultadoLicitacao((atual) => ({ ...atual, contratoId: event.target.value }))} /></label>
          <label><span>Desconto vencedor (%)</span><input required type="number" min="0" max="99.9999" step="0.0001" value={resultadoLicitacao.descontoPercentual} onChange={(event) => setResultadoLicitacao((atual) => ({ ...atual, descontoPercentual: event.target.value }))} /></label>
          <label className="orc-field-wide"><span>Justificativa da homologação</span><textarea required minLength="3" value={resultadoLicitacao.justificativa} onChange={(event) => setResultadoLicitacao((atual) => ({ ...atual, justificativa: event.target.value }))} /></label>
          <div className="orc-contract-preview"><span>Referência publicada <strong>{formatarMoeda(resumo.precoTotal)}</strong></span><span>Proposta vencedora <strong>{formatarMoeda(estimativaContratada)}</strong></span></div>
          {!aprovado && <p className="orc-measure-error">Aprove o orçamento antes de homologar o resultado da licitação.</p>}
          <button className="orc-btn orc-btn-primary" type="submit" disabled={!aprovado}>Homologar e congelar base contratada</button>
        </form>}
      </article>
      <article className="orc-card orc-bid-checklist">
        <header><div><span>CONTROLE DE EMISSÃO</span><h3>Verificações antes da distribuição</h3></div></header>
        <div><i>✓</i><span><strong>Revisão identificada</strong><small>O código {orcamento.revisao} será registrado em todas as abas.</small></span></div>
        <div><i>✓</i><span><strong>Cálculos auditáveis</strong><small>Totais, BDI, encargos, cronograma e histograma permanecem baseados em fórmulas.</small></span></div>
        <div><i>✓</i><span><strong>Campos de entrada controlados</strong><small>Somente preços, observações e percentuais destinados ao concorrente ficam desbloqueados.</small></span></div>
      </article>
    </>
  );
}

function Suprimentos({ orcamento, basesPrecos, salvarConfiguracao }) {
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  const [busca, setBusca] = useState("");
  const [origemDetalhe, setOrigemDetalhe] = useState(null);
  const [periodoCompra, setPeriodoCompra] = useState("todos");
  const [limiteCompras, setLimiteCompras] = useState("50");
  const [pedidoItem, setPedidoItem] = useState(null);
  const [regraItem, setRegraItem] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [pedidoDados, setPedidoDados] = useState({
    quantidade: "",
    entregaEm: "",
    fornecedor: "",
  });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    consolidarDemandaSuprimentos(
      orcamento,
      basesPrecos?.carregarItensComposicao,
      basesPrecos?.bases,
    ).then((dados) => {
      if (ativo) setResultado(dados);
    }).catch((error) => {
      console.error(error);
      if (ativo) setErro("Não foi possível consolidar os insumos deste orçamento.");
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [orcamento, basesPrecos?.carregarItensComposicao, basesPrecos?.bases, atualizacao]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const insumos = (resultado?.insumos || []).filter((item) => (
    !termo
    || item.codigo.toLocaleLowerCase("pt-BR").includes(termo)
    || item.descricao.toLocaleLowerCase("pt-BR").includes(termo)
    || item.base.toLocaleLowerCase("pt-BR").includes(termo)
  ));
  const planoComprasFiltrado = (resultado?.planoCompras || []).filter((item) => (
    periodoCompra === "todos" || item.periodoInicio === periodoCompra
  ));
  const planoCompras = limiteCompras === "todos"
    ? planoComprasFiltrado
    : planoComprasFiltrado.slice(0, Number(limiteCompras));
  const proximaCompra = resultado?.planoCompras?.[0];

  function atualizarAntecedenciaPadrao(valor) {
    salvarConfiguracao({
      antecedenciaPadraoDias: valor,
    });
  }

  function atualizarAntecedenciaItem(insumoChave, valor) {
    salvarConfiguracao({
      antecedenciasPorItem: {
        [insumoChave]: Math.max(0, Math.round(Number(valor) || 0)),
      },
    });
  }

  function atualizarEstoque(insumoChave, valor) {
    salvarConfiguracao({
      estoquesPorItem: {
        [insumoChave]: Math.max(0, Number(valor) || 0),
      },
    });
  }

  function adicionarPedido(event) {
    event.preventDefault();
    if (!pedidoItem || Number(pedidoDados.quantidade) <= 0 || !pedidoDados.entregaEm) return;
    salvarConfiguracao({
      pedidos: [
        ...(orcamento.suprimentosConfig?.pedidos || []),
        {
          id: criarId("pedido"),
          insumoChave: pedidoItem.insumo.chave,
          quantidade: Number(pedidoDados.quantidade),
          entregaEm: pedidoDados.entregaEm,
          fornecedor: pedidoDados.fornecedor.trim(),
          status: "Emitido",
        },
      ],
    });
    setPedidoItem(null);
    setPedidoDados({ quantidade: "", entregaEm: "", fornecedor: "" });
  }

  function abrirRegra(item) {
    const chave = item.chaveOriginal || item.chavesOrigem?.[0] || item.chave;
    const regra = orcamento.suprimentosConfig?.regrasPorItem?.[chave] || {};
    setRegraItem({
      chave,
      item,
      perdaPercentual: String(regra.perdaPercentual ?? 0),
      fatorConversao: String(regra.fatorConversao ?? 1),
      unidadeDestino: regra.unidadeDestino || item.unidade,
      codigoSubstituto: regra.codigoSubstituto || "",
      descricaoSubstituto: regra.descricaoSubstituto || "",
      baseSubstituta: regra.baseSubstituta || "",
      precoSubstituto: regra.precoSubstituto ?? "",
      justificativa: regra.justificativa || "",
    });
  }

  function salvarRegra(event) {
    event.preventDefault();
    salvarConfiguracao({
      regrasPorItem: {
        [regraItem.chave]: {
          perdaPercentual: Math.max(0, Number(regraItem.perdaPercentual) || 0),
          fatorConversao: Math.max(0.00000001, Number(regraItem.fatorConversao) || 1),
          unidadeDestino: regraItem.unidadeDestino.trim(),
          codigoSubstituto: regraItem.codigoSubstituto.trim(),
          descricaoSubstituto: regraItem.descricaoSubstituto.trim(),
          baseSubstituta: regraItem.baseSubstituta.trim(),
          precoSubstituto: regraItem.precoSubstituto === ""
            ? ""
            : Math.max(0, Number(regraItem.precoSubstituto) || 0),
          justificativa: regraItem.justificativa.trim(),
        },
      },
    });
    setRegraItem(null);
  }

  function removerRegra() {
    salvarConfiguracao({ regrasPorItem: { [regraItem.chave]: null } });
    setRegraItem(null);
  }

  async function exportarSuprimentos() {
    if (!resultado || exportando) return;
    setExportando(true);
    setErro("");
    try {
      await baixarRelatorioSuprimentos(orcamento, resultado);
    } catch (error) {
      console.error(error);
      setErro("Não foi possível gerar o relatório XLSX de suprimentos.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      {origemDetalhe && <div className="orc-modal-backdrop" role="presentation" onMouseDown={() => setOrigemDetalhe(null)}><article className="orc-modal orc-origin-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><header><div><span>RASTREABILIDADE</span><h3>Origens de {origemDetalhe.codigo}</h3></div><button type="button" onClick={() => setOrigemDetalhe(null)}>×</button></header><div>{origemDetalhe.origensDetalhadas?.length ? origemDetalhe.origensDetalhadas.map((origem, indice) => <section key={`${origem.servicoId}-${indice}`}><strong>{origem.servicoCodigo} · {origem.servicoDescricao}</strong><span>Quantidade gerada: {Number(origem.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 8 })} {origemDetalhe.unidade}</span><small>{origemDetalhe.base} · {origemDetalhe.uf}</small></section>) : origemDetalhe.origens.map((origem) => <section key={origem}><strong>{origem}</strong><span>{origemDetalhe.descricao}</span><small>{origemDetalhe.base} · {origemDetalhe.uf}</small></section>)}</div><footer><button type="button" className="orc-btn orc-btn-primary" onClick={() => setOrigemDetalhe(null)}>Fechar</button></footer></article></div>}
      {regraItem && <div className="orc-modal-backdrop" role="presentation" onMouseDown={() => setRegraItem(null)}><form className="orc-modal orc-supply-rule-modal" role="dialog" aria-modal="true" onSubmit={salvarRegra} onMouseDown={(event) => event.stopPropagation()}><header><div><span>PLANEJAMENTO DO INSUMO</span><h3>Conversão, perda e equivalência</h3><small>{regraItem.item.codigo} · {regraItem.item.descricao}</small></div><button type="button" onClick={() => setRegraItem(null)}>×</button></header><div className="orc-supply-rule-fields"><label><span>Perda técnica (%)</span><input type="number" min="0" max="1000" step="any" value={regraItem.perdaPercentual} onChange={(event) => setRegraItem((atual) => ({ ...atual, perdaPercentual: event.target.value }))} /></label><label><span>Fator de conversão</span><input required type="number" min="0.00000001" step="any" value={regraItem.fatorConversao} onChange={(event) => setRegraItem((atual) => ({ ...atual, fatorConversao: event.target.value }))} /><small>Quantidade de destino para cada unidade original.</small></label><label><span>Unidade de destino</span><input required value={regraItem.unidadeDestino} onChange={(event) => setRegraItem((atual) => ({ ...atual, unidadeDestino: event.target.value }))} /></label><label><span>Código equivalente</span><input value={regraItem.codigoSubstituto} onChange={(event) => setRegraItem((atual) => ({ ...atual, codigoSubstituto: event.target.value }))} placeholder="Manter o código atual" /></label><label className="orc-field-wide"><span>Descrição equivalente</span><input value={regraItem.descricaoSubstituto} onChange={(event) => setRegraItem((atual) => ({ ...atual, descricaoSubstituto: event.target.value }))} placeholder="Manter a descrição atual" /></label><label><span>Base equivalente</span><input value={regraItem.baseSubstituta} onChange={(event) => setRegraItem((atual) => ({ ...atual, baseSubstituta: event.target.value }))} placeholder="Manter a base atual" /></label><label><span>Preço do substituto</span><input type="number" min="0" step="any" value={regraItem.precoSubstituto} onChange={(event) => setRegraItem((atual) => ({ ...atual, precoSubstituto: event.target.value }))} placeholder="Manter preço atual" /></label><label className="orc-field-wide"><span>Justificativa técnica</span><textarea required={Boolean(regraItem.codigoSubstituto || regraItem.baseSubstituta)} value={regraItem.justificativa} onChange={(event) => setRegraItem((atual) => ({ ...atual, justificativa: event.target.value }))} placeholder="Informe o critério de conversão, perda ou equivalência adotado." /></label></div><footer><button type="button" className="orc-btn orc-btn-danger" onClick={removerRegra}>Limpar regra</button><span /><button type="button" className="orc-btn orc-btn-ghost" onClick={() => setRegraItem(null)}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Aplicar regra</button></footer></form></div>}
      <div className="orc-supply-kpis">
        <article><span>INSUMOS CONSOLIDADOS</span><strong>{resultado?.insumos.length || 0}</strong><small>Agrupados por base, código e unidade</small></article>
        <article><span>FUNÇÕES DE MÃO DE OBRA</span><strong>{resultado?.maoObra?.length || 0}</strong><small>Separadas da relação de insumos</small></article>
        <article><span>SERVIÇOS PROCESSADOS</span><strong>{resultado?.servicosProcessados || 0}</strong><small>Itens ativos na revisão {orcamento.revisao}</small></article>
        <article><span>COMPOSIÇÕES EXPANDIDAS</span><strong>{resultado?.composicoesExpandidas || 0}</strong><small>Incluindo níveis internos</small></article>
        <article className={resultado?.pendencias.length ? "has-warning" : ""}><span>PENDÊNCIAS ANALÍTICAS</span><strong>{resultado?.pendencias.length || 0}</strong><small>{resultado?.pendencias.length ? "Exigem memória ou preço" : "Memórias rastreáveis"}</small></article>
        <article><span>PRÓXIMA COMPRA</span><strong>{proximaCompra ? formatarDataObra(proximaCompra.comprarAte) : "—"}</strong><small>{proximaCompra?.descricao || "Sem demanda programada"}</small></article>
      </div>
      <article className="orc-card orc-supply-demand">
        <header>
          <div><span>DEMANDA CONSOLIDADA</span><h3>Lista de insumos do orçamento</h3></div>
          <div className="orc-supply-actions">
            <label><span>BUSCAR</span><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código, descrição ou base" /></label>
            <button type="button" disabled={carregando} onClick={() => setAtualizacao((valor) => valor + 1)}>{carregando ? "Consolidando…" : "↻ Atualizar"}</button>
            <button type="button" disabled={carregando || exportando || !resultado} onClick={exportarSuprimentos}>{exportando ? "Gerando XLSX…" : "⇩ Exportar XLSX"}</button>
          </div>
        </header>
        {erro && <div className="orc-supply-empty is-error">{erro}</div>}
        {!erro && !carregando && !resultado?.insumos.length && <div className="orc-supply-empty"><strong>Nenhum insumo consolidado</strong><span>Confira as pendências abaixo: composições sem memória analítica não são ignoradas.</span></div>}
        {!erro && resultado?.insumos.length > 0 && (
          <div className="orc-supply-table">
            <div className="orc-supply-table-head"><span>CÓDIGO / INSUMO</span><span>BASE / UF</span><span>UN.</span><span>QUANTIDADE</span><span>PREÇO BÁSICO</span><span>VALOR ESTIMADO</span><span>AJUSTES</span><span>ORIGENS</span></div>
            {insumos.map((item) => (
              <div key={item.chave}>
                <span><strong>{item.codigo}</strong><small>{item.descricao}</small></span>
                <span><strong>{item.base}</strong><small>{item.uf}{item.referencia ? ` · ${item.referencia}` : ""}</small></span>
                <b>{item.unidade}</b>
                <span><strong>{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.quantidade !== item.quantidadeOriginal ? `Original: ${item.quantidadeOriginal.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}` : "Sem ajuste quantitativo"}</small></span>
                <strong>{formatarPrecoUnitario(item.preco)}</strong>
                <strong>{formatarMoeda(item.valorEstimado)}</strong>
                <button type="button" className="orc-supply-adjust-button" onClick={() => abrirRegra(item)}><strong>{item.regrasAplicadas?.length ? `${item.regrasAplicadas.length} regra(s)` : "Configurar"}</strong><small>{item.perdaPercentual ? `${item.perdaPercentual.toLocaleString("pt-BR")} % de perda` : "Conversão, perda ou equivalente"}</small></button>
                <button type="button" className="orc-origin-button" onClick={() => setOrigemDetalhe(item)}><strong>{item.origens.length}</strong><small>{item.origens.slice(0, 2).join(" · ")}</small><em>Ver origens</em></button>
              </div>
            ))}
            {!insumos.length && <div className="orc-supply-empty">Nenhum insumo corresponde à pesquisa.</div>}
          </div>
        )}
        <footer><span>VALOR BÁSICO ESTIMADO DOS INSUMOS</span><strong>{formatarMoeda(resultado?.valorEstimado || 0)}</strong></footer>
      </article>
      <article className="orc-card orc-purchase-calendar">
        <header>
          <div><span>CRONOGRAMA DE AQUISIÇÕES</span><h3>Calendário recomendado de compras</h3></div>
          <div className="orc-purchase-controls">
            <label><span>ANTECEDÊNCIA PADRÃO</span><span><input type="number" min="0" max="365" value={orcamento.suprimentosConfig?.antecedenciaPadraoDias ?? 15} onChange={(event) => atualizarAntecedenciaPadrao(event.target.value)} /><b>dias</b></span></label>
            <label><span>PERÍODO DE CONSUMO</span><select value={periodoCompra} onChange={(event) => setPeriodoCompra(event.target.value)}><option value="todos">Todos os períodos</option>{(resultado?.periodos || []).map((periodo) => <option key={periodo.inicio} value={periodo.inicio}>{periodo.label}</option>)}</select></label>
            <label><span>LINHAS</span><select value={limiteCompras} onChange={(event) => setLimiteCompras(event.target.value)}><option>25</option><option>50</option><option>100</option><option value="todos">Todas</option></select></label>
          </div>
        </header>
        {!carregando && !resultado?.planoCompras.length && <div className="orc-supply-empty"><strong>Sem compras programadas</strong><span>O calendário será gerado quando as composições possuírem memória analítica e os serviços estiverem distribuídos no cronograma.</span></div>}
        {resultado?.planoCompras.length > 0 && <div className="orc-purchase-table">
          <div className="orc-purchase-head"><span>COMPRAR ATÉ</span><span>CONSUMO PREVISTO</span><span>CÓDIGO / INSUMO</span><span>QUANTIDADE</span><span>VALOR ESTIMADO</span><span>ANTECEDÊNCIA</span><span>ORIGEM</span></div>
          {planoCompras.map((item) => <div key={item.chave}>
            <strong>{formatarDataObra(item.comprarAte)}</strong>
            <span><strong>{item.periodo}</strong><small>{formatarDataObra(item.consumoEm)}</small></span>
            <span><strong>{item.codigo}</strong><small>{item.descricao}</small></span>
            <span><strong>{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.unidade}</small></span>
            <strong>{formatarMoeda(item.valorEstimado)}</strong>
            <label><input type="number" min="0" max="365" value={orcamento.suprimentosConfig?.antecedenciasPorItem?.[item.insumoChave] ?? item.antecedenciaDias} onChange={(event) => atualizarAntecedenciaItem(item.insumoChave, event.target.value)} /><small>dias</small></label>
            <button type="button" className="orc-origin-button" onClick={() => setOrigemDetalhe({ ...item, origensDetalhadas: resultado.insumos.find((insumo) => insumo.chave === item.insumoChave)?.origensDetalhadas || [] })}><strong>{item.origens.length}</strong><small>{item.base} · {item.uf}</small><em>Ver origens</em></button>
          </div>)}
          {planoComprasFiltrado.length > planoCompras.length && <footer>Exibindo {planoCompras.length} de {planoComprasFiltrado.length} compras programadas.</footer>}
        </div>}
      </article>
      <article className="orc-card orc-supply-coverage">
        <header>
          <div><span>COBERTURA DA DEMANDA</span><h3>Estoque, pedidos e risco de ruptura</h3></div>
          <strong className={resultado?.rupturas.length ? "has-risk" : ""}>{resultado?.rupturas.length || 0} período(s) com risco</strong>
        </header>
        {pedidoItem && <form className="orc-order-form" onSubmit={adicionarPedido}>
          <div><span>NOVO PEDIDO</span><strong>{pedidoItem.insumo.codigo} · {pedidoItem.insumo.descricao}</strong></div>
          <label><span>Quantidade</span><input required type="number" min="0.00000001" step="any" value={pedidoDados.quantidade} onChange={(event) => setPedidoDados((atual) => ({ ...atual, quantidade: event.target.value }))} /></label>
          <label><span>Entrega prevista</span><input required type="date" value={pedidoDados.entregaEm} onChange={(event) => setPedidoDados((atual) => ({ ...atual, entregaEm: event.target.value }))} /></label>
          <label><span>Fornecedor</span><input value={pedidoDados.fornecedor} onChange={(event) => setPedidoDados((atual) => ({ ...atual, fornecedor: event.target.value }))} placeholder="Opcional" /></label>
          <button type="button" onClick={() => setPedidoItem(null)}>Cancelar</button>
          <button type="submit">Salvar pedido</button>
        </form>}
        {!resultado?.coberturaPorItem.length && <div className="orc-supply-empty"><strong>Sem insumos para controle</strong><span>As posições de estoque e pedidos serão liberadas após a leitura das memórias analíticas.</span></div>}
        {resultado?.coberturaPorItem.length > 0 && <div className="orc-coverage-table">
          <div className="orc-coverage-head"><span>CÓDIGO / INSUMO</span><span>DEMANDA TOTAL</span><span>ESTOQUE ATUAL</span><span>PEDIDOS</span><span>SALDO FINAL</span><span>FALTA PROJETADA</span><span>STATUS / AÇÃO</span></div>
          {resultado.coberturaPorItem.map((item) => <div key={item.insumo.chave}>
            <span><strong>{item.insumo.codigo}</strong><small>{item.insumo.descricao}</small></span>
            <span><strong>{item.demandaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.insumo.unidade}</small></span>
            <label><input type="number" min="0" step="any" value={orcamento.suprimentosConfig?.estoquesPorItem?.[item.insumo.chave] ?? 0} onChange={(event) => atualizarEstoque(item.insumo.chave, event.target.value)} /><small>{item.insumo.unidade}</small></label>
            <span><strong>{item.quantidadePedidos.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.pedidos.length} pedido(s)</small></span>
            <span><strong>{item.saldoProjetado.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.insumo.unidade}</small></span>
            <span><strong>{item.faltaProjetada.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><small>{item.insumo.unidade}</small></span>
            <span><em className={item.statusCobertura === "Ruptura" ? "has-risk" : "is-covered"}>{item.statusCobertura}</em><button type="button" onClick={() => setPedidoItem(item)}>＋ Pedido</button></span>
          </div>)}
        </div>}
      </article>
      {resultado?.maoObra?.length > 0 && <article className="orc-card orc-workforce-report"><header><div><span>RECURSOS HUMANOS</span><h3>Mão de obra necessária para execução</h3></div><strong>{resultado.maoObra.length} funções/referências</strong></header><div className="orc-workforce-head"><span>CÓDIGO / FUNÇÃO</span><span>BASE / UF</span><span>UN.</span><span>QUANTIDADE</span><span>ORIGENS</span></div>{resultado.maoObra.map((item) => <div key={item.chave}><span><strong>{item.codigo || "—"}</strong><small>{item.descricao}</small></span><span><strong>{item.base}</strong><small>{item.uf}</small></span><b>{item.unidade}</b><strong>{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong><button type="button" className="orc-origin-button" onClick={() => setOrigemDetalhe(item)}><strong>{item.origens.length}</strong><small>{item.origens.slice(0, 2).join(" · ")}</small><em>Ver origens</em></button></div>)}</article>}
      {resultado?.pendencias.length > 0 && (
        <article className="orc-card orc-supply-pending">
          <header><div><span>RASTREABILIDADE</span><h3>Pendências da memória analítica</h3></div><strong>{resultado.pendencias.length} encontradas</strong></header>
          {resultado.pendencias.map((item) => (
            <div key={item.chave}>
              <b>!</b>
              <span><strong>{item.codigo || "Sem código"} · {item.descricao}</strong><small>{item.origem} · {item.base}</small></span>
              <em>{item.tipo.replaceAll("_", " ")}</em>
            </div>
          ))}
        </article>
      )}
      <article className="orc-card procurement-roadmap-note is-complete">
        <span>ETAPA 9.11 CONCLUÍDA PARA HOMOLOGAÇÃO</span>
        <strong>Planejamento, equivalências e relatórios de suprimentos</strong>
        <p>O arquivo XLSX reúne resumo, demanda, calendário, cobertura, cotação, pedidos e pendências. As regras de conversão, perdas e substituições permanecem rastreáveis por insumo.</p>
      </article>
    </>
  );
}

function Revisoes({
  orcamento,
  ativarRevisao,
  alternarRevisaoInativa,
  excluirRevisao,
  avisar,
}) {
  const totais = calcularTotais(orcamento);
  const estadoAtual = {
    id: "estado-atual",
    codigo: `${orcamento.revisao} atual`,
    status: orcamento.status,
    bases: resumirBasesDosItens(orcamento.itens),
    total: totais.precoTotal,
    variacao: 0,
    autor: "Usuário atual",
    publicada: false,
    natureza: orcamento.revisaoContratual?.natureza || "Revisão ordinária",
    motivo: orcamento.revisaoContratual?.motivo || "",
    variacaoPrazoDias: orcamento.revisaoContratual?.variacaoPrazoDias || 0,
    snapshot: orcamento.itens,
    calculo: {
      descontoGlobal: orcamento.descontoGlobal,
      totais,
    },
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
      {orcamento.revisaoContratual?.origemAprovada && <article className="orc-contract-impact"><span>REVISÃO PÓS-APROVAÇÃO</span><strong>{orcamento.revisaoContratual.natureza}</strong><p>{orcamento.revisaoContratual.motivo}</p><b className={Number(orcamento.revisaoContratual.variacaoPrazoDias) < 0 ? "is-negative" : ""}>{Number(orcamento.revisaoContratual.variacaoPrazoDias) > 0 ? "+" : ""}{orcamento.revisaoContratual.variacaoPrazoDias} dias no prazo</b></article>}
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
        {(orcamento.revisoes.length ? orcamento.revisoes : [estadoAtual]).map((revisao) => {
          const atual = revisao.codigo === orcamento.revisao;
          const numeroRevisao = Number(revisao.codigo?.replace(/\D/g, "")) || 0;
          const numeroAtual = Number(orcamento.revisao?.replace(/\D/g, "")) || 0;
          const direcao = numeroRevisao < numeroAtual ? "Retroceder" : "Avançar";
          return <div key={revisao.id} className={`${atual ? "current" : ""} ${revisao.inativa ? "is-inactive" : ""}`}><span className="orc-rev">{revisao.codigo}</span><span><strong>{revisao.inativa ? "Inativa" : revisao.status}</strong><small>{revisao.natureza || "Revisão ordinária"} · {atual ? "ativa" : "snapshot"}</small>{revisao.motivo && <small title={revisao.motivo}>{revisao.motivo}</small>}</span><span><small>BASES DOS ITENS</small><strong>{revisao.bases}</strong></span><span><small>PREÇO TOTAL</small><strong>{formatarMoeda(atual ? totais.precoTotal : revisao.total)}</strong><small className={Number(revisao.variacaoPrazoDias) < 0 ? "is-negative" : ""}>{Number(revisao.variacaoPrazoDias) > 0 ? "+" : ""}{revisao.variacaoPrazoDias || 0} dias de prazo</small></span><b>{revisao.variacao ? `${revisao.variacao > 0 ? "+" : ""}${revisao.variacao.toLocaleString("pt-BR")}%` : "—"}</b><span><small>RESPONSÁVEL</small><strong>{revisao.autor}</strong></span><div className="orc-revision-actions">{!atual && !revisao.inativa && <button type="button" onClick={() => { ativarRevisao(revisao.id); avisar(`${direcao} para ${revisao.codigo} concluído.`); }}>{direcao}</button>} {!atual && <button type="button" onClick={() => { alternarRevisaoInativa(revisao.id); avisar(revisao.inativa ? "Revisão reativada." : "Revisão marcada como inativa."); }}>{revisao.inativa ? "Reativar" : "Inativar"}</button>} {!atual && <button type="button" className="is-danger" onClick={() => { if (window.confirm(`Excluir a revisão ${revisao.codigo}? Esta ação não poderá ser desfeita.`)) { excluirRevisao(revisao.id); avisar("Revisão excluída."); } }}>Excluir</button>}</div></div>;
        })}
      </article>
    </>
  );
}

function DashboardOrcamentos({ orcamentos, selecionar, novo }) {
  const indicadores = orcamentos.map((orcamento) => ({
    orcamento,
    totais: calcularTotais(orcamento),
  }));
  const valorCarteira = indicadores.reduce((total, item) => total + item.totais.precoTotal, 0);
  const pendencias = indicadores.reduce((total, item) => total + item.totais.pendencias, 0);
  const aprovados = orcamentos.filter((item) => item.status.toLocaleLowerCase("pt-BR").includes("aprov")).length;
  const maiorValor = Math.max(...indicadores.map((item) => item.totais.precoTotal), 1);
  const aguardando = indicadores.filter((item) => (
    item.totais.pendencias > 0
    || item.orcamento.status.toLocaleLowerCase("pt-BR").includes("elaboração")
  ));

  return (
    <div className="orc-portfolio-dashboard">
      <header className="orc-portfolio-heading"><div><span>CARTEIRA DE ORÇAMENTOS</span><h2>Visão geral dos orçamentos</h2><p>Indicadores, validações e evolução financeira antes da abertura de uma obra.</p></div><button type="button" className="orc-btn orc-btn-primary" onClick={novo}>＋ Novo orçamento</button></header>
      <div className="orc-portfolio-kpis">
        <article><span>ORÇAMENTOS</span><strong>{orcamentos.length}</strong><small>{aprovados} {aprovados === 1 ? "aprovado" : "aprovados"}</small></article>
        <article><span>VALOR DA CARTEIRA</span><strong>{formatarMoeda(valorCarteira)}</strong><small>Soma das versões ativas</small></article>
        <article><span>PENDÊNCIAS</span><strong>{pendencias}</strong><small>Itens com preço ou quantidade incompleta</small></article>
        <article><span>AGUARDANDO ANÁLISE</span><strong>{aguardando.length}</strong><small>Validação ou aprovação</small></article>
      </div>
      <div className="orc-portfolio-grid">
        <article className="orc-card orc-portfolio-chart">
          <header><div><span>VALOR POR ORÇAMENTO</span><h3>Distribuição da carteira</h3></div></header>
          <div>{indicadores.map(({ orcamento, totais }) => <button type="button" key={orcamento.id} onClick={() => selecionar(orcamento.id)}><span><strong>{orcamento.id}</strong><small>{orcamento.nome}</small></span><i><b style={{ width: `${Math.max(4, (totais.precoTotal / maiorValor) * 100)}%` }} /></i><em>{formatarMoeda(totais.precoTotal)}</em></button>)}</div>
        </article>
        <article className="orc-card orc-portfolio-pending">
          <header><div><span>FLUXO DE APROVAÇÃO</span><h3>Validações pendentes</h3></div></header>
          <div>{aguardando.map(({ orcamento, totais }) => <button type="button" key={orcamento.id} onClick={() => selecionar(orcamento.id)}><span><strong>{orcamento.nome}</strong><small>{orcamento.id} · {orcamento.revisao}</small></span><b>{totais.pendencias ? `${totais.pendencias} itens` : orcamento.status}</b><em>Abrir →</em></button>)}{!aguardando.length && <p>Não há orçamentos aguardando validação.</p>}</div>
        </article>
      </div>
      <article className="orc-card orc-portfolio-list">
        <header><div><span>PORTFÓLIO</span><h3>Todos os orçamentos</h3></div></header>
        <div>{indicadores.map(({ orcamento, totais }) => <button type="button" key={orcamento.id} onClick={() => selecionar(orcamento.id)}><span><strong>{orcamento.id}</strong><small>{orcamento.nome}</small></span><span><small>REVISÃO</small><strong>{orcamento.revisao}</strong></span><span><small>STATUS</small><strong>{orcamento.status}</strong></span><span><small>PENDÊNCIAS</small><strong>{totais.pendencias}</strong></span><span><small>PREÇO TOTAL</small><strong>{formatarMoeda(totais.precoTotal)}</strong></span><em>Selecionar →</em></button>)}</div>
      </article>
    </div>
  );
}

function ModalItem({
  fechar,
  salvar,
  item,
  tipoInicial = "servico",
  itens,
  criarGrupo,
  basesPrecos,
}) {
  const grupos = itens.filter((candidato) => candidato.tipo === "grupo");
  const disciplinas = grupos.filter((grupo) => grupo.nivelEap === "disciplina");
  const salas = grupos.filter((grupo) => grupo.nivelEap === "sala");
  const gruposServico = disciplinas.length ? disciplinas : grupos;
  const grupoInicial = item?.tipo !== "grupo"
    ? item?.parentId || grupos.find((grupo) => item?.codigo.startsWith(`${grupo.codigo}.`))?.id || grupos[0]?.id || ""
    : "";
  const grupoInicialEncontrado = grupos.find((grupo) => grupo.id === grupoInicial);
  const baseItemInicial = item?.basePrecoId
    || basesPrecos.bases.find((base) => item?.fonte?.toUpperCase().startsWith(base.fonte))?.id
    || basesPrecos.baseAtivaId
    || "";
  const [dados, setDados] = useState(() => item ? {
    tipo: item.tipo || "servico",
    parentId: item.parentId || grupoInicial,
    nivelEap: item.nivelEap || "disciplina",
    codigo: item.codigo,
    descricao: item.descricao,
    fonte: item.fonte || "",
    quantidade: item.quantidade || "",
    unidade: item.unidade || "UN",
    unitario: item.unitario || "",
    basePrecoId: baseItemInicial,
    referenciaCodigo: item.referenciaCodigo || "",
    referenciaTipo: item.referenciaTipo || "composicao",
    percentualMaoObra: item.percentualMaoObra || 0,
    custoMaoObra: item.custoMaoObra || 0,
    custoMaterial: item.custoMaterial ?? item.unitario ?? 0,
    bdiTipo: item.bdiTipo || "padrao",
    bdiDiferenciado: item.bdiDiferenciado || {
      inviabilidadeParcelamento: false,
      naturezaEspecifica: false,
      fornecedorEspecializado: false,
      impactoSignificativo: false,
      meraIntermediacao: false,
      servicosAssociadosSeparados: false,
      justificativa: "",
      responsavel: "",
    },
  } : {
    tipo: tipoInicial,
    parentId: tipoInicial === "grupo" ? "" : grupoInicial,
    nivelEap: "site",
    codigo: tipoInicial === "grupo"
      ? proximoCodigoGrupo(itens)
      : (grupoInicialEncontrado ? proximoCodigoServico(itens, grupoInicialEncontrado.codigo) : ""),
    descricao: "",
    fonte: "",
    quantidade: "",
    unidade: "UN",
    unitario: "",
    basePrecoId: baseItemInicial,
    referenciaCodigo: "",
    referenciaTipo: "composicao",
    percentualMaoObra: 0,
    custoMaoObra: 0,
    custoMaterial: 0,
    bdiTipo: "padrao",
    bdiDiferenciado: {
      inviabilidadeParcelamento: false,
      naturezaEspecifica: false,
      fornecedorEspecializado: false,
      impactoSignificativo: false,
      meraIntermediacao: false,
      servicosAssociadosSeparados: false,
      justificativa: "",
      responsavel: "",
    },
  });
  const [novoGrupo, setNovoGrupo] = useState({
    aberto: false,
    descricao: "",
    parentId: salas[0]?.id || "",
  });
  const salaNovoGrupo = salas.find((grupo) => grupo.id === novoGrupo.parentId);
  const codigoNovoGrupo = salaNovoGrupo
    ? proximoCodigoServico(itens, salaNovoGrupo.codigo)
    : "";
  const [buscaReferencia, setBuscaReferencia] = useState("");
  const baseSelecionada = basesPrecos.bases.find((base) => base.id === dados.basePrecoId);
  const fontesDisponiveis = [...new Set(basesPrecos.bases.map((base) => base.fonte))];
  const referenciasDisponiveis = [...new Set(
    basesPrecos.bases
      .filter((base) => base.fonte === baseSelecionada?.fonte)
      .map((base) => base.referencia),
  )];
  const estadosDisponiveis = [...new Set(
    basesPrecos.bases
      .filter((base) => (
        base.fonte === baseSelecionada?.fonte
        && base.referencia === baseSelecionada?.referencia
      ))
      .map((base) => base.uf),
  )];
  const paisNivelSelecionado = grupos.filter(
    (grupo) => grupo.id !== item?.id && grupo.nivelEap === nivelEapAnterior(dados.nivelEap),
  );
  const resultadosBase = useMemo(() => {
    const termo = buscaReferencia.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return [];
    return basesPrecos.referencias
      .filter((referencia) => ["composicao", "insumo"].includes(referencia.tipo))
      .filter((referencia) => `${referencia.codigo} ${referencia.descricao}`.toLocaleLowerCase("pt-BR").includes(termo))
      .slice(0, 8);
  }, [buscaReferencia, basesPrecos.referencias]);

  useEffect(() => {
    if (dados.basePrecoId && dados.basePrecoId !== basesPrecos.baseAtivaId) {
      basesPrecos.setBaseAtivaId(dados.basePrecoId);
    }
  }, []);

  function atualizar(campo, valor) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  function atualizarCriterioBdi(campo, valor) {
    setDados((atuais) => ({
      ...atuais,
      bdiDiferenciado: {
        ...(atuais.bdiDiferenciado || {}),
        [campo]: valor,
      },
    }));
  }

  function selecionarGrupo(codigoGrupo) {
    const grupo = grupos.find((candidato) => candidato.id === codigoGrupo);
    setDados((atuais) => ({
      ...atuais,
      parentId: codigoGrupo,
      codigo: grupo ? proximoCodigoServico(itens, grupo.codigo, item?.id) : "",
    }));
  }

  function alterarTipo(tipo) {
    setDados((atuais) => ({
      ...atuais,
      tipo,
      nivelEap: tipo === "grupo" ? (atuais.nivelEap || "site") : "",
      parentId: tipo === "grupo" ? "" : atuais.parentId,
      codigo: tipo === "grupo"
        ? proximoCodigoGrupo(itens)
        : (grupos.find((grupo) => grupo.id === atuais.parentId)
          ? proximoCodigoServico(itens, grupos.find((grupo) => grupo.id === atuais.parentId).codigo, item?.id)
          : ""),
    }));
  }

  function alterarNivelEap(nivelEap) {
    const nivelPai = nivelEapAnterior(nivelEap);
    const pai = nivelPai ? grupos.find((grupo) => grupo.nivelEap === nivelPai) : null;
    setDados((atuais) => ({
      ...atuais,
      nivelEap,
      parentId: pai?.id || "",
      codigo: pai ? `${pai.codigo}.${grupos.filter((grupo) => grupo.parentId === pai.id).length + 1}` : proximoCodigoGrupo(itens),
    }));
  }

  function incluirGrupoRapido() {
    if (!novoGrupo.descricao.trim() || !salaNovoGrupo) return;
    const novoGrupoId = `grp-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    criarGrupo({
      id: novoGrupoId,
      tipo: "grupo",
      codigo: codigoNovoGrupo,
      descricao: novoGrupo.descricao,
      parentId: salaNovoGrupo.id,
      nivelEap: "disciplina",
      fonte: "",
      quantidade: 0,
      unidade: "",
      unitario: 0,
    });
    setDados((atuais) => ({
      ...atuais,
      parentId: novoGrupoId,
      codigo: `${codigoNovoGrupo}.1`,
    }));
    setNovoGrupo((atual) => ({ ...atual, aberto: false }));
  }

  function selecionarBaseItem(baseId) {
    basesPrecos.setBaseAtivaId(baseId);
    setBuscaReferencia("");
    setDados((atuais) => ({
      ...atuais,
      basePrecoId: baseId,
      referenciaCodigo: "",
      referenciaTipo: "composicao",
      fonte: "",
    }));
  }

  function selecionarPublicacao(criterios) {
    const fonte = criterios.fonte ?? baseSelecionada?.fonte;
    const referencia = criterios.referencia ?? baseSelecionada?.referencia;
    const uf = criterios.uf ?? baseSelecionada?.uf;
    const candidata = basesPrecos.bases.find((base) => (
      base.fonte === fonte
      && (!referencia || base.referencia === referencia)
      && (!uf || base.uf === uf)
    )) || basesPrecos.bases.find((base) => base.fonte === fonte);
    selecionarBaseItem(candidata?.id || "");
  }

  function selecionarReferenciaBase(referencia) {
    const base = basesPrecos.baseAtiva;
    if (!base) return;
    setDados((atuais) => ({
      ...atuais,
      descricao: referencia.descricao,
      fonte: `${base.titulo} · ${referencia.codigo}`,
      unidade: referencia.unidade || "UN",
      unitario: referencia.preco || 0,
      basePrecoId: base.id,
      referenciaCodigo: referencia.codigo,
      referenciaTipo: referencia.tipo,
      percentualMaoObra: referencia.percentualMaoObra || 0,
      custoMaoObra: referencia.custoMaoObra || 0,
      custoMaterial: referencia.custoMaterial ?? referencia.preco ?? 0,
    }));
    setBuscaReferencia(`${referencia.codigo} · ${referencia.descricao}`);
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-novo-item" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados, item?.id); }}>
        <header><div><span>PLANILHA ORÇAMENTÁRIA</span><h3 id="orc-novo-item">{item ? "Editar" : "Adicionar"} {dados.tipo === "grupo" ? "grupo" : "serviço"}</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Tipo</span><select value={dados.tipo} onChange={(event) => alterarTipo(event.target.value)}><option value="servico">Serviço</option><option value="grupo">Grupo EAP</option></select></label>
          {dados.tipo === "grupo" && <label><span>Classificação da EAP</span><select value={dados.nivelEap} onChange={(event) => alterarNivelEap(event.target.value)}>{EAP_NIVEIS.map((nivel) => <option key={nivel.id} value={nivel.id}>Nível {nivel.nivel} — {nivel.label} ({nivel.exemplo})</option>)}</select></label>}
          {dados.tipo === "grupo" && nivelEapAnterior(dados.nivelEap) && <label className="orc-field-wide"><span>{EAP_NIVEIS.find((nivel) => nivel.id === nivelEapAnterior(dados.nivelEap))?.label} superior</span><select required value={dados.parentId} onChange={(event) => selecionarGrupo(event.target.value)}><option value="">{paisNivelSelecionado.length ? "Selecione a classificação superior" : `Cadastre primeiro o nível ${EAP_NIVEIS.find((nivel) => nivel.id === nivelEapAnterior(dados.nivelEap))?.nivel}`}</option>{paisNivelSelecionado.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.codigo} · {grupo.descricao}</option>)}</select></label>}
          {dados.tipo !== "grupo" && <label className="orc-field-wide"><span>Disciplina da EAP (nível 5)</span><div className="orc-group-select"><select required value={dados.parentId} onChange={(event) => selecionarGrupo(event.target.value)}><option value="">Selecione a disciplina</option>{gruposServico.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.codigo} · {EAP_NIVEIS.find((nivel) => nivel.id === grupo.nivelEap)?.label || "Grupo"} · {grupo.descricao}</option>)}</select><button type="button" disabled={!salas.length} title={salas.length ? "Criar uma disciplina dentro de uma sala" : "Cadastre primeiro uma Sala no nível 4"} onClick={() => setNovoGrupo((atual) => ({ ...atual, aberto: !atual.aberto }))}>＋ Nova disciplina</button></div></label>}
          {novoGrupo.aberto && dados.tipo !== "grupo" && <div className="orc-inline-group orc-field-wide"><label><span>Sala superior (nível 4)</span><select value={novoGrupo.parentId} onChange={(event) => setNovoGrupo((atual) => ({ ...atual, parentId: event.target.value }))}>{salas.map((sala) => <option key={sala.id} value={sala.id}>{sala.codigo} · {sala.descricao}</option>)}</select></label><label><span>Código da disciplina</span><input readOnly value={codigoNovoGrupo} /></label><label><span>Nome da disciplina</span><input autoFocus value={novoGrupo.descricao} onChange={(event) => setNovoGrupo((atual) => ({ ...atual, descricao: event.target.value }))} placeholder="Ex.: ARQUITETURA" /></label><button type="button" disabled={!novoGrupo.descricao.trim() || !salaNovoGrupo} onClick={incluirGrupoRapido}>Criar e selecionar</button></div>}
          <label><span>Código EAP (automático)</span><input required readOnly value={dados.codigo} placeholder="Gerado pela posição hierárquica" /></label>
          <label className="orc-field-wide"><span>Descrição</span><input required value={dados.descricao} onChange={(event) => atualizar("descricao", event.target.value)} placeholder="Descrição do serviço" /></label>
          {dados.tipo !== "grupo" && <>
            <div className="orc-field-wide base-item-publication">
              <label><span>Base de preços</span><select value={baseSelecionada?.fonte || ""} onChange={(event) => selecionarPublicacao({ fonte: event.target.value, referencia: "", uf: "" })}><option value="">Preço manual</option>{fontesDisponiveis.map((fonte) => <option key={fonte}>{fonte}</option>)}</select></label>
              <label><span>Mês</span><select disabled={!baseSelecionada} value={baseSelecionada?.referencia || ""} onChange={(event) => selecionarPublicacao({ referencia: event.target.value, uf: "" })}>{referenciasDisponiveis.map((referencia) => <option key={referencia}>{referencia}</option>)}</select></label>
              <label><span>Estado</span><select disabled={!baseSelecionada} value={baseSelecionada?.uf || ""} onChange={(event) => selecionarPublicacao({ uf: event.target.value })}>{estadosDisponiveis.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
            </div>
            <div className="orc-sinapi-picker orc-field-wide">
              <label><span>Buscar composição ou insumo {basesPrecos.baseAtiva ? `— ${basesPrecos.baseAtiva.titulo}` : ""}</span><input disabled={!dados.basePrecoId || basesPrecos.carregando} value={buscaReferencia} onChange={(event) => setBuscaReferencia(event.target.value)} placeholder={dados.basePrecoId ? "Digite código ou descrição" : "Selecione uma base ou informe um preço manual"} /></label>
              {resultadosBase.length > 0 && <div>{resultadosBase.map((referencia) => <button type="button" key={referencia.uid || `${referencia.tipo}-${referencia.codigo}`} onClick={() => selecionarReferenciaBase(referencia)}><span><strong>{referencia.codigo}</strong>{referencia.descricao}</span><b className={referencia.semPreco ? "sem-preco" : ""}>{referencia.tipo} · {referencia.semPreco ? "Sem preço" : formatarPrecoUnitario(referencia.preco)}</b></button>)}</div>}
            </div>
            <label className="orc-field-wide"><span>Fonte e código</span><input value={dados.fonte} onChange={(event) => atualizar("fonte", event.target.value)} placeholder="Base · código ou referência manual" /></label>
            <label><span>Quantidade</span><input required min="0" step="any" type="number" value={dados.quantidade} onChange={(event) => atualizar("quantidade", event.target.value)} /></label>
            <label><span>Unidade</span><select required value={dados.unidade} onChange={(event) => atualizar("unidade", event.target.value)}>{UNIDADES_ORCAMENTARIAS.map((unidade) => <option key={unidade}>{unidade}</option>)}</select></label>
            <label><span>Preço unitário (precisão livre)</span><input required min="0" step="any" type="number" value={dados.unitario} onChange={(event) => atualizar("unitario", event.target.value)} /></label>
            <label className="orc-field-wide"><span>Regra de BDI do item</span><select value={dados.bdiTipo} onChange={(event) => atualizar("bdiTipo", event.target.value)}><option value="padrao">BDI padrão da obra</option><option value="diferenciado">BDI diferenciado — mero fornecimento relevante</option></select></label>
            {dados.bdiTipo === "diferenciado" && <fieldset className="orc-bdi-eligibility orc-field-wide">
              <legend>Memória obrigatória para aplicação do BDI diferenciado</legend>
              <p>Confirme todas as condições. Enquanto houver pendência, o sistema continuará aplicando o BDI padrão.</p>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.inviabilidadeParcelamento === true} onChange={(event) => atualizarCriterioBdi("inviabilidadeParcelamento", event.target.checked)} /><span>Há inviabilidade técnico-econômica justificada para parcelar o fornecimento.</span></label>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.naturezaEspecifica === true} onChange={(event) => atualizarCriterioBdi("naturezaEspecifica", event.target.checked)} /><span>O material ou equipamento possui natureza específica.</span></label>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.fornecedorEspecializado === true} onChange={(event) => atualizarCriterioBdi("fornecedorEspecializado", event.target.checked)} /><span>Pode ser fornecido por empresa de especialidade própria e diversa.</span></label>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.impactoSignificativo === true} onChange={(event) => atualizarCriterioBdi("impactoSignificativo", event.target.checked)} /><span>Representa percentual significativo do preço global, avaliado no caso concreto.</span></label>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.meraIntermediacao === true} onChange={(event) => atualizarCriterioBdi("meraIntermediacao", event.target.checked)} /><span>A aquisição constitui mera intermediação e atividade residual da construtora.</span></label>
              <label><input required type="checkbox" checked={dados.bdiDiferenciado?.servicosAssociadosSeparados === true} onChange={(event) => atualizarCriterioBdi("servicosAssociadosSeparados", event.target.checked)} /><span>Montagem, instalação ou aplicação estão discriminadas separadamente, quando existentes.</span></label>
              <label><span>Responsável técnico</span><input required value={dados.bdiDiferenciado?.responsavel || ""} onChange={(event) => atualizarCriterioBdi("responsavel", event.target.value)} placeholder="Nome do profissional responsável pela análise" /></label>
              <label className="orc-field-wide"><span>Justificativa técnica</span><textarea required minLength="20" value={dados.bdiDiferenciado?.justificativa || ""} onChange={(event) => atualizarCriterioBdi("justificativa", event.target.value)} placeholder="Descreva a inviabilidade de parcelamento, a relevância financeira e a caracterização do mero fornecimento." /></label>
            </fieldset>}
          </>}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">{item ? "Salvar alterações" : "Adicionar"}</button></footer>
      </form>
    </div>
  );
}

function ModalNovoOrcamento({ fechar, salvar, proximoCodigo }) {
  const hoje = new Date();
  const fimPadrao = new Date(hoje);
  fimPadrao.setFullYear(fimPadrao.getFullYear() + 1);
  const [dados, setDados] = useState({
    id: proximoCodigo,
    nome: "",
    bdi: "24.73",
    area: "",
    inicioObra: hoje.toISOString().slice(0, 10),
    fimObra: fimPadrao.toISOString().slice(0, 10),
    prazoDias: String(calcularPrazoDias(hoje.toISOString().slice(0, 10), fimPadrao.toISOString().slice(0, 10))),
    intervaloMedicaoDias: "30",
  });

  function atualizar(campo, valor) {
    setDados((atuais) => {
      const proximos = { ...atuais, [campo]: valor };
      if (campo === "prazoDias" && Number(valor) > 0) {
        proximos.fimObra = calcularDataFimPorPrazo(proximos.inicioObra, valor);
      } else if (campo === "fimObra") {
        proximos.prazoDias = String(calcularPrazoDias(proximos.inicioObra, valor));
      } else if (campo === "inicioObra") {
        proximos.fimObra = calcularDataFimPorPrazo(valor, proximos.prazoDias);
      }
      return proximos;
    });
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-novo-orcamento" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados); }}>
        <header><div><span>PORTFÓLIO</span><h3 id="orc-novo-orcamento">Novo orçamento</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Identificador</span><input required value={dados.id} onChange={(event) => atualizar("id", event.target.value.toUpperCase())} /></label>
          <label className="orc-field-wide"><span>Nome do empreendimento</span><input required value={dados.nome} onChange={(event) => atualizar("nome", event.target.value)} placeholder="Nome da obra ou projeto" /></label>
          <label><span>BDI (%)</span><input required min="0" step="0.01" type="number" value={dados.bdi} onChange={(event) => atualizar("bdi", event.target.value)} /></label>
          <label><span>Área (m²)</span><input min="0" step="0.01" type="number" value={dados.area} onChange={(event) => atualizar("area", event.target.value)} /></label>
          <label><span>Início previsto da obra</span><input required type="date" value={dados.inicioObra} onChange={(event) => atualizar("inicioObra", event.target.value)} /></label>
          <label><span>Prazo de execução (dias corridos)</span><input required min="1" step="1" type="number" value={dados.prazoDias} onChange={(event) => atualizar("prazoDias", event.target.value)} /></label>
          <label><span>Conclusão prevista</span><input required min={dados.inicioObra} type="date" value={dados.fimObra} onChange={(event) => atualizar("fimObra", event.target.value)} /></label>
          <label><span>Intervalo entre medições (dias)</span><input required min="1" max="365" step="1" type="number" value={dados.intervaloMedicaoDias} onChange={(event) => atualizar("intervaloMedicaoDias", event.target.value)} /><small>Recomendado: 30 dias.</small></label>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Criar orçamento</button></footer>
      </form>
    </div>
  );
}

function ModalPrazoObra({ orcamento, fechar, salvar }) {
  const [dados, setDados] = useState({
    inicioObra: orcamento.inicioObra,
    fimObra: orcamento.fimObra,
    prazoDias: String(orcamento.prazoDias || calcularPrazoDias(orcamento.inicioObra, orcamento.fimObra)),
    intervaloMedicaoDias: String(orcamento.intervaloMedicaoDias || 30),
  });
  function atualizar(campo, valor) {
    setDados((atuais) => {
      const proximos = { ...atuais, [campo]: valor };
      if (campo === "prazoDias" && Number(valor) > 0) {
        proximos.fimObra = calcularDataFimPorPrazo(proximos.inicioObra, valor);
      } else if (campo === "fimObra") {
        proximos.prazoDias = String(calcularPrazoDias(proximos.inicioObra, valor));
      } else if (campo === "inicioObra") {
        proximos.fimObra = calcularDataFimPorPrazo(valor, proximos.prazoDias);
      }
      return proximos;
    });
  }
  const periodos = criarPeriodosMedicao(dados);
  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal orc-deadline-modal" role="dialog" aria-modal="true" aria-labelledby="orc-prazo-obra" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados); }}>
        <header><div><span>PLANEJAMENTO CONTRATUAL</span><h3 id="orc-prazo-obra">Prazo da obra e medições</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Início previsto da obra</span><input required type="date" value={dados.inicioObra} onChange={(event) => atualizar("inicioObra", event.target.value)} /></label>
          <label><span>Prazo de execução (dias corridos)</span><input required min="1" step="1" type="number" value={dados.prazoDias} onChange={(event) => atualizar("prazoDias", event.target.value)} /><small>Alterar o prazo recalcula a conclusão.</small></label>
          <label><span>Conclusão prevista</span><input required min={dados.inicioObra} type="date" value={dados.fimObra} onChange={(event) => atualizar("fimObra", event.target.value)} /><small>Alterar a conclusão recalcula o prazo.</small></label>
          <label><span>Intervalo entre medições (dias)</span><input required min="1" max="365" step="1" type="number" value={dados.intervaloMedicaoDias} onChange={(event) => atualizar("intervaloMedicaoDias", event.target.value)} /><small>O padrão recomendado é uma medição a cada 30 dias.</small></label>
          <aside className="orc-deadline-preview">
            <span>PERÍODOS GERADOS</span>
            <strong>{periodos.length}</strong>
            <small>{periodos[0]?.label} até {periodos.at(-1)?.label}</small>
          </aside>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Aplicar ao orçamento</button></footer>
      </form>
    </div>
  );
}

function ModalNovaRevisao({ orcamento, fechar, salvar }) {
  const posAprovacao = String(orcamento.status || "").toLocaleLowerCase("pt-BR").includes("aprov");
  const [dados, setDados] = useState({
    natureza: posAprovacao ? "Aditivo" : "Revisão ordinária",
    motivo: "",
    variacaoPrazoDias: "0",
  });
  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-nova-revisao" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); salvar(dados); }}>
        <header><div><span>CONTROLE CONTRATUAL</span><h3 id="orc-nova-revisao">Criar nova revisão</h3></div><button type="button" onClick={fechar}>×</button></header>
        <div className="orc-form-grid">
          {posAprovacao && <aside className="orc-contract-alert orc-field-wide"><strong>Orçamento aprovado</strong><span>A nova revisão deve registrar objetivamente o impacto contratual como aditivo, supressão ou combinação de ambos.</span></aside>}
          <label><span>Natureza da revisão</span><select value={dados.natureza} onChange={(event) => setDados((atual) => ({ ...atual, natureza: event.target.value }))}>{!posAprovacao && <option>Revisão ordinária</option>}<option>Aditivo</option><option>Supressão</option><option>Aditivo e supressão</option></select></label>
          <label><span>Variação do prazo (dias)</span><input type="number" step="1" value={dados.variacaoPrazoDias} onChange={(event) => setDados((atual) => ({ ...atual, variacaoPrazoDias: event.target.value }))} /><small>Use valor negativo para redução do prazo.</small></label>
          <label className="orc-field-wide"><span>Justificativa</span><textarea required value={dados.motivo} onChange={(event) => setDados((atual) => ({ ...atual, motivo: event.target.value }))} placeholder="Descreva o fato gerador, escopo afetado e referência da autorização." /></label>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Criar revisão contratual</button></footer>
      </form>
    </div>
  );
}

const DOCUMENTOS_MEDICAO = [
  "Comprovantes de pagamento dos funcionários",
  "Guias de recolhimento de impostos",
  "FGTS",
  "INSS",
  "Comprovantes de destinação dos resíduos",
  "Relatório fotográfico",
  "Memória de cálculo e controle da medição",
];

function ModalStatusOrcamento({ orcamento, fechar, salvar }) {
  const [status, setStatus] = useState(orcamento.status || "Em elaboração");
  const problemas = validarOrcamento(orcamento);
  const aprovacaoBloqueada = status === "Aprovado" && problemas.length > 0;
  function enviar(event) {
    event.preventDefault();
    if (aprovacaoBloqueada) return;
    salvar(status);
  }
  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="orc-status-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={enviar}>
        <header><div><span>FLUXO DE APROVAÇÃO</span><h3 id="orc-status-title">Alterar status do orçamento</h3></div><button type="button" onClick={fechar}>×</button></header>
        <div className="orc-form-grid">
          <label className="orc-field-wide"><span>Novo status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Em elaboração</option><option>Em validação</option><option>Aprovado</option><option>Reprovado</option><option>Arquivado</option></select></label>
          {status === "Aprovado" && !problemas.length && <aside className="orc-contract-alert orc-field-wide"><strong>Orçamento pronto para aprovação</strong><span>Após a aprovação, novas revisões serão identificadas como aditivos ou supressões, incluindo os impactos de valor e prazo.</span></aside>}
          {aprovacaoBloqueada && <aside className="orc-measure-error orc-field-wide" role="alert"><strong>A aprovação está bloqueada.</strong><span>Corrija {problemas.length} pendência(s) da planilha antes de aprovar. A guia Visão geral apresenta o total e a planilha identifica os itens.</span></aside>}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary" disabled={aprovacaoBloqueada}>{status === "Aprovado" ? "Aprovar orçamento" : "Salvar status"}</button></footer>
      </form>
    </div>
  );
}

function ModalMedicao({ medicao, orcamento, fechar, salvar }) {
  const [dados, setDados] = useState({
    ...medicao,
    status: medicao.status || "Proposta",
    valorPrevisto: String(medicao.valorPrevisto || 0),
    valorMedido: String(medicao.valorMedido || 0),
    retencaoValor: String(medicao.retencoes?.[0]?.valor || ""),
    retencaoMotivo: medicao.retencoes?.[0]?.motivo || "",
    multaValor: String(medicao.multas?.[0]?.valor || ""),
    multaMotivo: medicao.multas?.[0]?.motivo || "",
    documentos: medicao.documentos || [],
    itens: medicao.itens || [],
    observacoes: medicao.observacoes || "",
  });
  const [erroValidacao, setErroValidacao] = useState("");
  const saldos = useMemo(
    () => calcularSaldosMedicao(orcamento, dados.id),
    [orcamento, dados.id],
  );
  const valorMedidoCalculado = dados.itens.length
    ? dados.itens.reduce((total, item) => total + Number(item.quantidadePeriodo || 0) * Number(item.precoUnitario || 0), 0)
    : Number(dados.valorMedido || 0);
  function alternarDocumento(documento) {
    setDados((atual) => ({
      ...atual,
      documentos: atual.documentos.includes(documento)
        ? atual.documentos.filter((item) => item !== documento)
        : [...atual.documentos, documento],
    }));
  }
  function enviar(event) {
    event.preventDefault();
    const medicaoAtualizada = {
      ...dados,
      valorMedido: valorMedidoCalculado,
      retencoes: Number(dados.retencaoValor) > 0
        ? [{ valor: Number(dados.retencaoValor), motivo: dados.retencaoMotivo }]
        : [],
      multas: Number(dados.multaValor) > 0
        ? [{ valor: Number(dados.multaValor), motivo: dados.multaMotivo }]
        : [],
    };
    const validacao = validarMedicaoAcumulada(orcamento, medicaoAtualizada);
    if (!validacao.valida) {
      setErroValidacao(validacao.erros[0]);
      return;
    }
    const resultado = salvar(medicaoAtualizada);
    if (resultado?.ok === false) {
      setErroValidacao(resultado.erros?.[0] || "A medição ultrapassa o saldo contratual.");
    }
  }
  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal orc-modal-wide" role="dialog" aria-modal="true" aria-labelledby="orc-medicao" onMouseDown={(event) => event.stopPropagation()} onSubmit={enviar}>
        <header><div><span>MEDIÇÃO DA OBRA</span><h3 id="orc-medicao">{dados.id}</h3></div><button type="button" onClick={fechar}>×</button></header>
        <div className="orc-form-grid">
          <label><span>Início do período</span><input required type="date" value={dados.inicio || ""} onChange={(event) => setDados((atual) => ({ ...atual, inicio: event.target.value }))} /></label>
          <label><span>Fim do período</span><input required type="date" min={dados.inicio} value={dados.fim || ""} onChange={(event) => setDados((atual) => ({ ...atual, fim: event.target.value }))} /></label>
          <label><span>Status</span><select value={dados.status} onChange={(event) => setDados((atual) => ({ ...atual, status: event.target.value }))}><option>Proposta</option><option>Em elaboração</option><option>Em conferência</option><option>Aprovada</option><option>Rejeitada</option></select></label>
          <label><span>Valor previsto</span><input type="number" min="0" step="0.01" value={dados.valorPrevisto} onChange={(event) => setDados((atual) => ({ ...atual, valorPrevisto: event.target.value }))} /></label>
          <label><span>Valor medido bruto</span><input readOnly value={valorMedidoCalculado.toFixed(2)} /><small>Calculado pelas quantidades medidas.</small></label>
          <section className="orc-measure-items orc-field-wide"><header><strong>Quantidades e saldos da medição</strong><span>{dados.itens.length} itens previstos no cronograma</span></header>{erroValidacao && <aside className="orc-measure-error" role="alert">{erroValidacao}</aside>}<div><table><thead><tr><th>ITEM</th><th>DESCRIÇÃO</th><th>CONTRATADA</th><th>JÁ MEDIDA</th><th>NESTA MEDIÇÃO</th><th>SALDO APÓS</th><th>UN.</th><th>VALOR DESTA</th><th>SALDO EM VALOR</th></tr></thead><tbody>{dados.itens.map((item, indice) => {
            const saldo = saldos.get(item.itemId) || {
              quantidadeMedidaAnterior: 0,
              saldoQuantidade: Number(item.quantidadeContratada || 0),
              saldoValor: Number(item.quantidadeContratada || 0) * Number(item.precoUnitario || 0),
            };
            const quantidadeAtual = Math.max(0, Number(item.quantidadePeriodo || 0));
            const valorAtual = quantidadeAtual * Number(item.precoUnitario || 0);
            const excedida = quantidadeAtual > saldo.saldoQuantidade + 0.000001
              || valorAtual > saldo.saldoValor + 0.000001;
            return <tr key={item.itemId} className={excedida ? "is-over-limit" : ""}><td>{item.codigo}</td><td>{item.descricao}</td><td>{Number(item.quantidadeContratada).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</td><td>{Number(saldo.quantidadeMedidaAnterior).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</td><td><input type="number" min="0" max={saldo.saldoQuantidade} step="any" aria-invalid={excedida} value={item.quantidadePeriodo} onChange={(event) => {
              setErroValidacao("");
              setDados((atual) => ({ ...atual, itens: atual.itens.map((linha, linhaIndice) => linhaIndice === indice ? { ...linha, quantidadePeriodo: event.target.value } : linha) }));
            }} /></td><td><strong>{Math.max(0, saldo.saldoQuantidade - quantidadeAtual).toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</strong></td><td>{item.unidade}</td><td>{formatarMoeda(valorAtual)}</td><td><strong>{formatarMoeda(Math.max(0, saldo.saldoValor - valorAtual))}</strong>{excedida && <small>Limite excedido</small>}</td></tr>;
          })}</tbody></table></div></section>
          <label><span>Retenção</span><input type="number" min="0" step="0.01" value={dados.retencaoValor} onChange={(event) => setDados((atual) => ({ ...atual, retencaoValor: event.target.value }))} /></label>
          <label className="orc-field-wide"><span>Motivo da retenção</span><input required={Number(dados.retencaoValor) > 0} value={dados.retencaoMotivo} onChange={(event) => setDados((atual) => ({ ...atual, retencaoMotivo: event.target.value }))} placeholder="Informe objetivamente o motivo e a referência contratual." /></label>
          <label><span>Multa</span><input type="number" min="0" step="0.01" value={dados.multaValor} onChange={(event) => setDados((atual) => ({ ...atual, multaValor: event.target.value }))} /></label>
          <label className="orc-field-wide"><span>Motivo da multa</span><input required={Number(dados.multaValor) > 0} value={dados.multaMotivo} onChange={(event) => setDados((atual) => ({ ...atual, multaMotivo: event.target.value }))} placeholder="Informe o fato gerador e o documento de suporte." /></label>
          <fieldset className="orc-document-checklist orc-field-wide"><legend>Documentos solicitados pelo fiscal</legend>{DOCUMENTOS_MEDICAO.map((documento) => <label key={documento}><input type="checkbox" checked={dados.documentos.includes(documento)} onChange={() => alternarDocumento(documento)} /><span>{documento}</span></label>)}</fieldset>
          <aside className="orc-ged-note orc-field-wide"><strong>Anexação eletrônica — GED futuro</strong><span>Nesta etapa fica registrada a relação de documentos exigidos. O envio, versionamento, assinatura e guarda dos arquivos serão integrados ao futuro GED.</span></aside>
          <label className="orc-field-wide"><span>Observações da fiscalização</span><textarea value={dados.observacoes} onChange={(event) => setDados((atual) => ({ ...atual, observacoes: event.target.value }))} /></label>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Salvar medição</button></footer>
      </form>
    </div>
  );
}

export default function Orcamento({ basesPrecos }) {
  const [modoCarteira, setModoCarteira] = useState(true);
  const [etapa, setEtapa] = useState("visao");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState("");
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const [itemDetalhe, setItemDetalhe] = useState(null);
  const [medicaoEmEdicao, setMedicaoEmEdicao] = useState(null);
  const [gerandoLicitacao, setGerandoLicitacao] = useState(false);
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
    atualizarBdiDiferenciado,
    atualizarEncargosSociais,
    atualizarDescontoGlobal,
    atualizarPlanejamento,
    atualizarCronogramaQuantidade,
    atualizarCronogramaGrupo,
    atualizarHistogramaEquipe,
    limparCronograma,
    distribuirSaldosCronograma,
    limparHistograma,
    distribuirSaldosHistograma,
    atualizarConfiguracaoSuprimentos,
    salvarMedicao,
    atualizarPrecosBase,
    adicionarComposicao,
    removerComposicao,
    adicionarOrcamento,
    criarRevisao,
    ativarRevisao,
    alternarRevisaoInativa,
    excluirRevisao,
    atualizarStatusOrcamento,
    registrarBaseContratada,
  } = useOrcamentos();
  const etapaAtual = useMemo(() => ETAPAS.find((item) => item.id === etapa), [etapa]);
  const proximoCodigo = useMemo(() => {
    const maior = orcamentos.reduce((atual, item) => Math.max(atual, Number(item.id.split("-").at(-1)) || 0), 0);
    return `ORC-${new Date().getFullYear()}-${String(maior + 1).padStart(4, "0")}`;
  }, [orcamentos]);

  useEffect(() => {
    const codigosExistentes = new Set(
      basesPrecos.composicoesProprias.map((composicao) => composicao.codigo),
    );
    orcamentos
      .flatMap((orcamento) => orcamento.composicoes || [])
      .filter((composicao) => !codigosExistentes.has(composicao.codigo))
      .forEach((composicao) => basesPrecos.salvarComposicaoPropria(composicao));
  }, [orcamentos.length]);

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
    setModoCarteira(false);
    notificar("Novo orçamento criado e salvo.");
  }

  function salvarPlanejamento(dados) {
    atualizarPlanejamento(dados);
    setModal("");
    notificar("Prazo da obra e intervalo de medição atualizados.");
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

  function salvarBdiDiferenciado(componentes) {
    atualizarBdiDiferenciado(componentes);
    notificar("Composição do BDI diferenciado aplicada com referência do TCU.");
  }

  function salvarEncargos(encargos) {
    atualizarEncargosSociais(encargos);
    notificar("Encargos sociais aplicados ao orçamento.");
  }

  function salvarDesconto(dados) {
    atualizarDescontoGlobal(dados);
    notificar(dados ? "Desconto global aplicado e distribuído entre os serviços." : "Desconto global removido.");
  }

  function aplicarPrecosBase() {
    if (!basesPrecos.baseAtiva) return;
    const total = atualizarPrecosBase(basesPrecos.referencias, basesPrecos.baseAtiva);
    notificar(total ? `${total} itens vinculados à base foram atualizados.` : "Nenhum item vinculado possui preço disponível nesta versão.");
  }

  function adicionarRevisao() {
    setModal("revisao");
  }

  function confirmarNovaRevisao(dados) {
    criarRevisao(dados);
    setModal("");
    setEtapa("revisoes");
    notificar(`${dados.natureza} criada a partir da versão atual.`);
  }

  function confirmarStatus(status) {
    atualizarStatusOrcamento(status);
    setModal("");
    notificar(status === "Aprovado"
      ? "Orçamento aprovado. As próximas revisões serão contratuais."
      : `Status alterado para ${status}.`);
  }

  function abrirMedicao(medicao) {
    if (medicao) {
      setMedicaoEmEdicao(medicao);
    } else {
      const propostas = criarMedicoesPropostas(orcamentoAtivo);
      const ocupados = new Set((orcamentoAtivo.medicoes || []).map((item) => item.inicio));
      const proposta = propostas.find((item) => !ocupados.has(item.inicio)) || propostas.at(-1);
      setMedicaoEmEdicao({
        ...(proposta || {}),
        id: `MED-${String((orcamentoAtivo.medicoes || []).length + 1).padStart(3, "0")}`,
        status: "Em elaboração",
        proposta: false,
      });
    }
    setModal("medicao");
  }

  function confirmarMedicao(dados) {
    const resultado = salvarMedicao(dados);
    if (resultado?.ok === false) {
      return resultado;
    }
    setModal("");
    setMedicaoEmEdicao(null);
    notificar("Medição salva com retenções, multas e exigências documentais.");
    return { ok: true };
  }

  async function gerarPacoteLicitacao(abasSelecionadas = null) {
    setGerandoLicitacao(true);
    try {
      await baixarPacoteLicitacao(orcamentoAtivo, abasSelecionadas);
      notificar(`Pacote XLSX gerado com ${abasSelecionadas?.length || 6} planilha(s).`);
    } catch (error) {
      console.error(error);
      notificar("Não foi possível gerar o pacote XLSX.");
    } finally {
      setGerandoLicitacao(false);
    }
  }

  function exportar() {
    gerarPacoteLicitacao();
  }

  if (modoCarteira) {
    return (
      <section className="sigiu-page orc-page">
        {aviso && <div className="orc-toast" role="status">{aviso}</div>}
        {modal === "orcamento" && <ModalNovoOrcamento fechar={() => setModal("")} salvar={salvarNovoOrcamento} proximoCodigo={proximoCodigo} />}
        <DashboardOrcamentos orcamentos={orcamentos} novo={() => setModal("orcamento")} selecionar={(orcamentoId) => { setOrcamentoAtivoId(orcamentoId); setEtapa("visao"); setModoCarteira(false); }} />
      </section>
    );
  }

  if (!orcamentoAtivo) return null;
  const baseDetalhe = itemDetalhe && (
    basesPrecos.bases.find((base) => base.id === itemDetalhe.basePrecoId)
    || basesPrecos.bases.find((base) => itemDetalhe.fonte?.toUpperCase().startsWith(base.fonte))
  );
  const referenciaDetalhe = itemDetalhe ? {
    basePrecoId: baseDetalhe?.id || itemDetalhe.basePrecoId,
    codigo: itemDetalhe.referenciaCodigo || itemDetalhe.fonte?.split("·").at(-1)?.trim() || "",
    descricao: itemDetalhe.descricao,
    unidade: itemDetalhe.unidade,
    preco: itemDetalhe.unitario,
    baseTitulo: baseDetalhe?.titulo || itemDetalhe.fonte?.split("·")[0],
  } : null;

  return (
    <section className="sigiu-page orc-page">
      {aviso && <div className="orc-toast" role="status">{aviso}</div>}
      {referenciaDetalhe && <ModalComposicaoRastreavel referencia={referenciaDetalhe} basesPrecos={basesPrecos} fechar={() => setItemDetalhe(null)} />}
      {(modal === "item" || modal === "grupo") && <ModalItem fechar={() => { setModal(""); setItemEmEdicao(null); }} salvar={salvarDadosItem} item={itemEmEdicao} tipoInicial={modal === "grupo" ? "grupo" : "servico"} itens={orcamentoAtivo.itens} criarGrupo={(dados) => { salvarItem(dados); notificar("Novo grupo criado e selecionado."); }} basesPrecos={basesPrecos} />}
      {modal === "orcamento" && <ModalNovoOrcamento fechar={() => setModal("")} salvar={salvarNovoOrcamento} proximoCodigo={proximoCodigo} />}
      {modal === "prazo" && <ModalPrazoObra orcamento={orcamentoAtivo} fechar={() => setModal("")} salvar={salvarPlanejamento} />}
      {modal === "revisao" && <ModalNovaRevisao orcamento={orcamentoAtivo} fechar={() => setModal("")} salvar={confirmarNovaRevisao} />}
      {modal === "status" && <ModalStatusOrcamento orcamento={orcamentoAtivo} fechar={() => setModal("")} salvar={confirmarStatus} />}
      {modal === "medicao" && medicaoEmEdicao && <ModalMedicao medicao={medicaoEmEdicao} orcamento={orcamentoAtivo} fechar={() => { setModal(""); setMedicaoEmEdicao(null); }} salvar={confirmarMedicao} />}
      <div className="orc-project-bar">
        <button type="button" className="orc-back-portfolio" onClick={() => setModoCarteira(true)}>← Dashboard</button>
        <div className="orc-active-budget-select"><span>ORÇAMENTO ATIVO</span><select value={orcamentoAtivoId} onChange={(event) => setOrcamentoAtivoId(event.target.value)}>{orcamentos.map((orcamento) => <option key={orcamento.id} value={orcamento.id}>{orcamento.id} · {orcamento.nome}</option>)}</select></div>
        <button type="button" className="orc-new-budget" onClick={() => setModal("orcamento")}>＋ Novo orçamento</button>
        <div><small>REVISÃO</small><strong>{orcamentoAtivo.revisao}</strong></div><button type="button" className="orc-project-status" onClick={() => setModal("status")}><small>STATUS · ALTERAR</small><strong className="orc-status">{orcamentoAtivo.status}</strong></button><button type="button" className="orc-project-deadline" onClick={() => setModal("prazo")}><small>PRAZO E MEDIÇÕES</small><strong>{orcamentoAtivo.prazoDias} dias · {formatarDataObra(orcamentoAtivo.inicioObra)} → {formatarDataObra(orcamentoAtivo.fimObra)}</strong><span>A cada {orcamentoAtivo.intervaloMedicaoDias} dias · editar</span></button><div><small>BASES NOS ITENS</small><strong>{resumirBasesDosItens(orcamentoAtivo.itens)}</strong></div>
      </div>
      <nav className="orc-module-nav" aria-label="Etapas do orçamento">
        {ETAPAS.map((item) => <button type="button" key={item.id} className={etapa === item.id ? "is-active" : ""} onClick={() => setEtapa(item.id)}><span>{item.icon}</span>{item.label}</button>)}
      </nav>
      <CabecalhoSecao etapa={etapaAtual.id} exportar={exportar} novaRevisao={adicionarRevisao} />
      {etapa === "visao" && <VisaoGeralOrcamento orcamento={orcamentoAtivo} setEtapa={setEtapa} />}
      {etapa === "planilha" && <Planilha orcamento={orcamentoAtivo} abrirNovoItem={() => { setItemEmEdicao(null); setModal("item"); }} abrirNovoGrupo={() => { setItemEmEdicao(null); setModal("grupo"); }} editarItem={abrirEdicao} abrirDetalhe={setItemDetalhe} removerItem={confirmarRemocao} duplicarItem={(item) => { duplicarItem(item.id); notificar("Item duplicado."); }} moverItem={(item, direcao) => moverItem(item.id, direcao)} importarArquivo={importarArquivo} />}
      {etapa === "bases" && <Bases orcamento={orcamentoAtivo} adicionarComposicao={adicionarComposicao} removerComposicao={removerComposicao} setAviso={notificar} basesPrecos={basesPrecos} atualizarPrecos={aplicarPrecosBase} />}
      {etapa === "bdi" && <BdiDetalhado key={orcamentoAtivo.id} orcamento={orcamentoAtivo} salvarBdi={salvarBdi} salvarBdiDiferenciado={salvarBdiDiferenciado} salvarEncargos={salvarEncargos} />}
      {etapa === "cronograma" && <Cronograma orcamento={orcamentoAtivo} atualizarQuantidade={atualizarCronogramaQuantidade} atualizarGrupo={atualizarCronogramaGrupo} limparValores={limparCronograma} distribuirSaldos={distribuirSaldosCronograma} />}
      {etapa === "histograma" && <Histograma orcamento={orcamentoAtivo} atualizarEquipe={atualizarHistogramaEquipe} limparValores={limparHistograma} distribuirSaldos={distribuirSaldosHistograma} basesPrecos={basesPrecos} />}
      {etapa === "medicoes" && <Medicoes orcamento={orcamentoAtivo} abrirMedicao={abrirMedicao} />}
      {etapa === "comercial" && <CondicoesComerciais orcamento={orcamentoAtivo} salvarDesconto={salvarDesconto} />}
      {etapa === "licitacoes" && <Licitacoes orcamento={orcamentoAtivo} gerar={gerarPacoteLicitacao} gerando={gerandoLicitacao} registrarBase={registrarBaseContratada} avisar={notificar} />}
      {etapa === "suprimentos" && <Suprimentos orcamento={orcamentoAtivo} basesPrecos={basesPrecos} salvarConfiguracao={atualizarConfiguracaoSuprimentos} />}
      {etapa === "revisoes" && <Revisoes orcamento={orcamentoAtivo} ativarRevisao={ativarRevisao} alternarRevisaoInativa={alternarRevisaoInativa} excluirRevisao={excluirRevisao} avisar={notificar} />}
    </section>
  );
}
