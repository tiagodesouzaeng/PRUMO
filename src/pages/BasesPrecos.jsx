import { useEffect, useMemo, useState } from "react";
import { BASE_PROPRIA_ID, BASES_TODAS_ID } from "../hooks/useBasesPrecos";
import { UNIDADES_ORCAMENTARIAS } from "../domain/orcamento";
import { aplicarPrecoPorUf } from "../domain/basesPrecos";
import ModalComposicaoRastreavel from "../components/Orcamento/ModalComposicaoRastreavel";
import { UFS_SINAPI } from "../services/sinapiImport";
import "../styles/orcamento.css";

const ufs = ["GERAL","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const moeda = (valor) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
}).format(Number(valor) || 0);

function ModalImportar({ fechar, basesPrecos, avisar }) {
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState({
    fonte: "SINAPI",
    fontePersonalizada: "",
    uf: "RS",
    referencia: "06/2026",
    regime: "SEM-DESONERACAO",
  });

  async function enviar(event) {
    event.preventDefault();
    setErro("");
    try {
      const fonte = dados.fonte === "OUTRA" ? dados.fontePersonalizada.trim() : dados.fonte;
      if (!arquivo || !fonte) throw new Error("Informe a base e selecione o arquivo.");
      const resultado = await basesPrecos.importar(arquivo, { ...dados, fonte });
      avisar(`${resultado.base.composicoes.toLocaleString("pt-BR")} composições e ${resultado.base.insumos.toLocaleString("pt-BR")} insumos importados.`);
      fechar();
    } catch (error) {
      setErro(error.message || "Não foi possível importar a publicação.");
    }
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal" role="dialog" aria-modal="true" aria-labelledby="base-import-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={enviar}>
        <header><div><span>CATÁLOGOS INDEPENDENTES</span><h3 id="base-import-title">Importar base de preços</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Base</span><select value={dados.fonte} onChange={(event) => setDados((atual) => ({ ...atual, fonte: event.target.value, regime: event.target.value === "SINAPI" ? "SEM-DESONERACAO" : "PADRAO" }))}><option>SINAPI</option><option>PLEO</option><option>SBC</option><option>ORSE</option><option value="OUTRA">Outra base</option></select></label>
          {dados.fonte === "OUTRA" && <label><span>Nome da base</span><input required value={dados.fontePersonalizada} onChange={(event) => setDados((atual) => ({ ...atual, fontePersonalizada: event.target.value }))} /></label>}
          <label><span>{dados.fonte === "SINAPI" ? "Estado inicial de exibição" : "Estado"}</span><select value={dados.uf} onChange={(event) => setDados((atual) => ({ ...atual, uf: event.target.value }))}>{ufs.filter((uf) => uf !== "GERAL").map((uf) => <option key={uf}>{uf}</option>)}</select></label>
          <label><span>Mês de referência</span><input required value={dados.referencia} onChange={(event) => setDados((atual) => ({ ...atual, referencia: event.target.value }))} placeholder="MM/AAAA" /></label>
          <label className="orc-field-wide"><span>Regime</span><select value={dados.regime} onChange={(event) => setDados((atual) => ({ ...atual, regime: event.target.value }))}><option value="PADRAO">Padrão</option><option value="SEM-DESONERACAO">Sem desoneração</option><option value="DESONERADO">Desonerado</option><option value="SEM-ENCARGOS">Sem encargos</option></select></label>
          <label className="orc-field-wide orc-file-drop"><span>ZIP, XLSX ou XLS</span><input required type="file" accept=".zip,.xlsx,.xls" onChange={(event) => setArquivo(event.target.files[0] || null)} /><small>{arquivo?.name || "Selecione a publicação da base."}</small></label>
          <div className="orc-sinapi-official-note orc-field-wide"><strong>Importação independente e auditável</strong><span>{dados.fonte === "SINAPI" ? "Todos os 27 estados serão importados em uma única publicação nacional. O arquivo original ficará preservado no armazenamento interno." : "O pacote será versionado no submódulo Bases de Preços e o arquivo original ficará preservado."}</span></div>
          {erro && <div className="orc-form-error orc-field-wide">{erro}</div>}
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary" disabled={basesPrecos.carregando}>{basesPrecos.carregando ? "Importando..." : "Importar base"}</button></footer>
      </form>
    </div>
  );
}

function SeletorPublicacao({ basesPrecos, incluirPropria = true }) {
  const bases = basesPrecos.bases.filter((base) => incluirPropria || !base.propria);
  const ativa = basesPrecos.baseAtiva;
  const fontes = [...new Set(bases.map((base) => base.fonte))];
  const referencias = [...new Set(bases.filter((base) => base.fonte === ativa?.fonte).map((base) => base.referencia))];
  const estados = [...new Set(bases.filter((base) => base.fonte === ativa?.fonte && base.referencia === ativa?.referencia).map((base) => base.uf))];

  function selecionar(criterios) {
    const fonte = criterios.fonte ?? ativa?.fonte;
    const referencia = criterios.referencia ?? ativa?.referencia;
    const uf = criterios.uf ?? ativa?.uf;
    const encontrada = bases.find((base) => (
      fonte === base.fonte
      && (!referencia || referencia === base.referencia)
      && (!uf || uf === base.uf)
    )) || bases.find((base) => base.fonte === fonte);
    if (encontrada) basesPrecos.setBaseAtivaId(encontrada.id);
  }

  return (
    <div className="base-publication-picker">
      <label><span>Base</span><select value={ativa?.fonte || ""} onChange={(event) => selecionar({ fonte: event.target.value, referencia: "", uf: "" })}>{fontes.map((fonte) => <option key={fonte}>{fonte}</option>)}</select></label>
      <label><span>Mês</span><select value={ativa?.referencia || ""} onChange={(event) => selecionar({ referencia: event.target.value, uf: "" })}>{referencias.map((referencia) => <option key={referencia}>{referencia}</option>)}</select></label>
      <label><span>Estado</span><select value={ativa?.uf || ""} onChange={(event) => selecionar({ uf: event.target.value })}>{estados.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
    </div>
  );
}

function ModalComposicaoPropria({ fechar, basesPrecos, avisar }) {
  const [dados, setDados] = useState({ codigo: "", descricao: "", unidade: "UN", custoUnitario: "", componentes: [] });
  const [busca, setBusca] = useState("");
  const [coeficiente, setCoeficiente] = useState("1");
  const resultados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return [];
    return basesPrecos.referencias
      .filter((item) => ["composicao", "insumo"].includes(item.tipo))
      .filter((item) => `${item.codigo} ${item.descricao}`.toLocaleLowerCase("pt-BR").includes(termo))
      .slice(0, 10);
  }, [busca, basesPrecos.referencias]);
  const custo = dados.componentes.reduce(
    (total, item) => total + Number(item.coeficiente) * Number(item.preco),
    0,
  );

  function adicionar(referencia) {
    const base = basesPrecos.baseAtiva;
    if (!base || Number(coeficiente) <= 0) return;
    setDados((atual) => ({
      ...atual,
      componentes: [...atual.componentes, {
        basePrecoId: base.id,
        baseTitulo: base.titulo,
        baseUf: base.uf,
        baseReferencia: base.referencia,
        referenciaTipo: referencia.tipo,
        referenciaCodigo: referencia.codigo,
        descricao: referencia.descricao,
        unidade: referencia.unidade,
        coeficiente: Number(coeficiente),
        preco: referencia.preco,
      }],
    }));
    setBusca("");
  }

  function salvar(event) {
    event.preventDefault();
    basesPrecos.salvarComposicaoPropria({
      ...dados,
      custoUnitario: dados.componentes.length ? custo : dados.custoUnitario,
    });
    avisar("Composição própria salva na Base própria PRUMO.");
    fechar();
  }

  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <form className="orc-modal orc-modal-wide" role="dialog" aria-modal="true" aria-labelledby="cpu-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={salvar}>
        <header><div><span>BASE PRÓPRIA</span><h3 id="cpu-title">Nova composição própria</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="orc-form-grid">
          <label><span>Código</span><input required value={dados.codigo} onChange={(event) => setDados((atual) => ({ ...atual, codigo: event.target.value.toUpperCase() }))} placeholder="CPU-001" /></label>
          <label><span>Unidade</span><select value={dados.unidade} onChange={(event) => setDados((atual) => ({ ...atual, unidade: event.target.value }))}>{UNIDADES_ORCAMENTARIAS.map((unidade) => <option key={unidade}>{unidade}</option>)}</select></label>
          <label className="orc-field-wide"><span>Descrição</span><input required value={dados.descricao} onChange={(event) => setDados((atual) => ({ ...atual, descricao: event.target.value }))} /></label>
          <div className="orc-field-wide"><SeletorPublicacao basesPrecos={basesPrecos} /></div>
          <label className="orc-field-wide"><span>Buscar composição ou insumo</span><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Código ou descrição" /></label>
          <label><span>Coeficiente</span><input type="number" min="0.00000001" step="any" value={coeficiente} onChange={(event) => setCoeficiente(event.target.value)} /></label>
          {resultados.length > 0 && <div className="orc-sinapi-picker orc-field-wide"><div>{resultados.map((item) => <button type="button" key={`${item.tipo}-${item.codigo}`} onClick={() => adicionar(item)}><span><strong>{item.codigo}</strong>{item.descricao}</span><b>{item.tipo} · {moeda(item.preco)}</b></button>)}</div></div>}
          <div className="orc-field-wide composition-editor-table">
            <table><thead><tr><th>Tipo</th><th>Código e descrição</th><th>Base</th><th>Coef.</th><th>Total</th><th /></tr></thead><tbody>
              {dados.componentes.map((item, index) => <tr key={`${item.basePrecoId}-${item.referenciaCodigo}-${index}`}><td>{item.referenciaTipo}</td><td><strong>{item.referenciaCodigo}</strong><small>{item.descricao}</small></td><td>{item.baseTitulo}<small>{item.baseUf} · {item.baseReferencia}</small></td><td>{item.coeficiente}</td><td>{moeda(item.coeficiente * item.preco)}</td><td><button type="button" onClick={() => setDados((atual) => ({ ...atual, componentes: atual.componentes.filter((_, i) => i !== index) }))}>×</button></td></tr>)}
              {!dados.componentes.length && <tr><td colSpan="6">Adicione insumos ou composições. Se preferir, informe um custo manual abaixo.</td></tr>}
            </tbody></table>
          </div>
          <label><span>Custo unitário</span><input required={!dados.componentes.length} disabled={dados.componentes.length > 0} type="number" min="0" step="any" value={dados.componentes.length ? custo : dados.custoUnitario} onChange={(event) => setDados((atual) => ({ ...atual, custoUnitario: event.target.value }))} /></label>
        </div>
        <footer><button type="button" className="orc-btn orc-btn-ghost" onClick={fechar}>Cancelar</button><button type="submit" className="orc-btn orc-btn-primary">Salvar composição</button></footer>
      </form>
    </div>
  );
}

function ModalValoresEstados({ item, ufSelecionada, fechar, abrirComposicao }) {
  const precos = item.precosPorUf || {};
  return (
    <div className="orc-modal-backdrop" role="presentation" onMouseDown={fechar}>
      <section className="orc-modal orc-modal-wide state-prices-modal" role="dialog" aria-modal="true" aria-labelledby="state-prices-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>PREÇOS POR ESTADO</span><h3 id="state-prices-title">{item.codigo} · {item.descricao}</h3></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></header>
        <div className="state-prices-summary"><span>Unidade <strong>{item.unidade || "—"}</strong></span><span>Base <strong>{item.baseTitulo || "Base selecionada"}</strong></span><span>UF em uso <strong>{ufSelecionada}</strong></span></div>
        {item.precosPorUf ? <div className="state-prices-grid">{UFS_SINAPI.map((uf) => {
          const original = Number(precos[uf]) || 0;
          const sp = Number(precos.SP) || 0;
          const fallback = original <= 0 && sp > 0 && uf !== "SP";
          return <article key={uf} className={`${uf === ufSelecionada ? "is-selected" : ""} ${fallback ? "is-fallback" : ""}`}><strong>{uf}</strong><span>{original > 0 ? moeda(original) : fallback ? `${moeda(sp)} *` : "Sem preço"}</span></article>;
        })}</div> : <div className="orc-empty-base"><strong>Base sem variação estadual</strong><span>{item.semPreco ? "Preço não informado." : moeda(item.preco)}</span></div>}
        {item.precosPorUf && <p className="state-prices-legend">* Valor de SP apresentado porque não há preço publicado para o estado.</p>}
        <footer>{item.tipo === "composicao" && <button type="button" className="orc-btn orc-btn-ghost" onClick={abrirComposicao}>Abrir composição analítica →</button>}<button type="button" className="orc-btn orc-btn-primary" onClick={fechar}>Fechar</button></footer>
      </section>
    </div>
  );
}

export default function BasesPrecos({ basesPrecos }) {
  const [modal, setModal] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [detalhe, setDetalhe] = useState(null);
  const [itemEstados, setItemEstados] = useState(null);
  const [ufSelecionada, setUfSelecionada] = useState("RS");
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(200);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const referenciasComUf = useMemo(() => basesPrecos.referencias.map((item) => aplicarPrecoPorUf(item, ufSelecionada)), [basesPrecos.referencias, ufSelecionada]);
  const referenciasFiltradas = useMemo(() => referenciasComUf
    .filter((item) => tipo === "todos" || item.tipo === tipo)
    .filter((item) => (
      basesPrecos.baseAtivaId !== BASES_TODAS_ID
      || !mesSelecionado
      || item.baseReferencia === mesSelecionado
    ))
    .filter((item) => !busca.trim() || `${item.codigo} ${item.descricao} ${item.unidade || ""}`.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))), [referenciasComUf, busca, tipo, basesPrecos.baseAtivaId, mesSelecionado]);
  const totalPaginas = Math.max(1, Math.ceil(referenciasFiltradas.length / porPagina));
  const referencias = mostrarTodos
    ? referenciasFiltradas
    : referenciasFiltradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const baseAtiva = basesPrecos.baseAtiva;
  const totalItensPreco = Number(baseAtiva?.total)
    || Number(baseAtiva?.composicoes || 0) + Number(baseAtiva?.insumos || 0);
  const totalRegistros = Number(baseAtiva?.registros) || totalItensPreco;
  const publicacoesConsulta = basesPrecos.publicacoesConsulta || basesPrecos.bases.filter((base) => !base.propria);
  const baseTodas = basesPrecos.basesSelecionaveis.find((base) => base.id === BASES_TODAS_ID);
  const basePropria = basesPrecos.basesSelecionaveis.find((base) => base.id === BASE_PROPRIA_ID);
  const abasBases = useMemo(() => {
    const fontes = new Map();
    publicacoesConsulta.forEach((base) => {
      const atual = fontes.get(base.fonte);
      if (!atual || base.id === basesPrecos.baseAtivaId) fontes.set(base.fonte, base);
    });
    return [baseTodas, ...fontes.values(), basePropria].filter(Boolean);
  }, [publicacoesConsulta, baseTodas, basePropria, basesPrecos.baseAtivaId]);
  const mesesDisponiveis = useMemo(() => [...new Set(
    publicacoesConsulta
      .filter((base) => (
        baseAtiva?.id === BASES_TODAS_ID
        || base.fonte === baseAtiva?.fonte
      ))
      .map((base) => base.referencia)
      .filter(Boolean),
  )], [publicacoesConsulta, baseAtiva]);
  const basesLogicas = new Set(publicacoesConsulta.map((base) => base.fonte)).size + (basePropria ? 1 : 0);
  const filtrosAplicados = [
    baseAtiva?.id !== BASES_TODAS_ID && `Base: ${baseAtiva?.fonte}`,
    mesSelecionado && `Mês: ${mesSelecionado}`,
    baseAtiva?.fonte === "SINAPI" || baseAtiva?.id === BASES_TODAS_ID ? `Estado: ${ufSelecionada}` : false,
    tipo !== "todos" && `Tipo: ${tipo === "composicao" ? "Composições" : "Insumos"}`,
    busca.trim() && `Busca: ${busca.trim()}`,
  ].filter(Boolean);

  useEffect(() => {
    setPagina(1);
    setMostrarTodos(false);
  }, [busca, tipo, basesPrecos.baseAtivaId, ufSelecionada, porPagina]);

  useEffect(() => {
    if (baseAtiva?.id === BASES_TODAS_ID) {
      setMesSelecionado((atual) => (mesesDisponiveis.includes(atual) ? atual : ""));
      return;
    }
    if (baseAtiva?.propria) {
      setMesSelecionado("");
      return;
    }
    setMesSelecionado(baseAtiva?.referencia || "");
  }, [baseAtiva?.id, baseAtiva?.referencia, baseAtiva?.propria, mesesDisponiveis]);

  function avisar(texto) {
    setAviso(texto);
    globalThis.setTimeout(() => setAviso(""), 3000);
  }

  function selecionarAba(base) {
    basesPrecos.setBaseAtivaId(base.id);
  }

  function selecionarMes(referencia) {
    setMesSelecionado(referencia);
    if ([BASES_TODAS_ID, BASE_PROPRIA_ID].includes(baseAtiva?.id)) return;
    const encontrada = publicacoesConsulta.find((base) => (
      base.fonte === baseAtiva?.fonte
      && base.referencia === referencia
    ));
    if (encontrada) basesPrecos.setBaseAtivaId(encontrada.id);
  }

  function selecionarEstado(uf) {
    setUfSelecionada(uf);
    if (!baseAtiva || ["SINAPI", "PRÓPRIA", "TODAS"].includes(baseAtiva.fonte)) return;
    const encontrada = publicacoesConsulta.find((base) => (
      base.fonte === baseAtiva.fonte
      && base.referencia === baseAtiva.referencia
      && base.uf === uf
    ));
    if (encontrada) basesPrecos.setBaseAtivaId(encontrada.id);
  }

  function limparFiltros() {
    setBusca("");
    setTipo("todos");
    setUfSelecionada("RS");
    setMesSelecionado("");
    basesPrecos.setBaseAtivaId(BASES_TODAS_ID);
  }

  return (
    <section className="sigiu-page orc-page bases-module-page">
      {aviso && <div className="orc-toast" role="status">{aviso}</div>}
      {modal === "importar" && <ModalImportar fechar={() => setModal("")} basesPrecos={basesPrecos} avisar={avisar} />}
      {modal === "composicao" && <ModalComposicaoPropria fechar={() => setModal("")} basesPrecos={basesPrecos} avisar={avisar} />}
      {detalhe && <ModalComposicaoRastreavel referencia={detalhe} basesPrecos={basesPrecos} fechar={() => setDetalhe(null)} tituloContexto="Rastreabilidade da base" ufSelecionada={ufSelecionada} />}
      {itemEstados && <ModalValoresEstados item={itemEstados} ufSelecionada={ufSelecionada} fechar={() => setItemEstados(null)} abrirComposicao={() => { setDetalhe(itemEstados); setItemEstados(null); }} />}
      <section className="base-monitor-header">
        <div><span>BASES MONITORADAS</span><strong>{basesLogicas} {basesLogicas === 1 ? "base cadastrada" : "bases cadastradas"} · {publicacoesConsulta.length} {publicacoesConsulta.length === 1 ? "publicação disponível" : "publicações disponíveis"}</strong></div>
        <div className="base-monitor-pills">
          <b>{referenciasFiltradas.length.toLocaleString("pt-BR")} VISÍVEIS</b>
          <div className="catalog-type-buttons"><button type="button" className={tipo === "todos" ? "is-active" : ""} onClick={() => setTipo("todos")}>TODOS</button><button type="button" className={tipo === "composicao" ? "is-active" : ""} onClick={() => setTipo("composicao")}>COMPOSIÇÕES</button><button type="button" className={tipo === "insumo" ? "is-active" : ""} onClick={() => setTipo("insumo")}>INSUMOS</button></div>
        </div>
      </section>
      <section className="orc-card base-filter-panel">
        <div className="base-filter-actions"><button className="orc-btn orc-btn-ghost" type="button" onClick={() => setModal("importar")}>⇧ Importar base</button><button className="orc-btn orc-btn-primary" type="button" onClick={() => { basesPrecos.setBaseAtivaId(BASE_PROPRIA_ID); setModal("composicao"); }}>＋ Composição própria</button></div>
        <div className="base-filter-primary">
          <label><span>BUSCAR NA BASE</span><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar por código, descrição ou unidade..." /></label>
          <button type="button" className="orc-btn orc-btn-primary" onClick={() => setBusca((atual) => atual.trim())}>Atualizar</button>
        </div>
        <div className="base-publication-tabs">{abasBases.map((base) => {
          const ativa = base.id === basesPrecos.baseAtivaId
            || (!base.propria && !base.todas && base.fonte === baseAtiva?.fonte);
          const mesesFonte = new Set(publicacoesConsulta.filter((item) => item.fonte === base.fonte).map((item) => item.referencia)).size;
          return <button type="button" key={base.todas || base.propria ? base.id : base.fonte} className={ativa ? "is-active" : ""} onClick={() => selecionarAba(base)}><strong>{base.fonte}</strong><span>{base.todas ? "Todas as bases" : base.propria ? "Cadastro corporativo" : `${mesesFonte} ${mesesFonte === 1 ? "publicação mensal" : "publicações mensais"}`}</span><small>{Number(base.composicoes || 0).toLocaleString("pt-BR")} comp. · {Number(base.insumos || 0).toLocaleString("pt-BR")} insumos · {Number(base.total || (Number(base.composicoes || 0) + Number(base.insumos || 0))).toLocaleString("pt-BR")} itens</small></button>;
        })}</div>
        <button className="base-filter-toggle" type="button" onClick={() => setFiltrosAbertos((aberto) => !aberto)}><span><i>{filtrosAbertos ? "−" : "+"}</i> Filtros da visualização <em>{filtrosAplicados.length} aplicados</em></span><b>{referenciasFiltradas.length.toLocaleString("pt-BR")} de {Number(tipo === "todos" ? totalItensPreco : baseAtiva?.[tipo === "composicao" ? "composicoes" : "insumos"] || 0).toLocaleString("pt-BR")}</b></button>
        <div className="base-active-filters"><span>VISUALIZAÇÃO ATUAL</span>{filtrosAplicados.map((filtro) => <b key={filtro}>{filtro}</b>)}{!filtrosAplicados.length && <b className="is-empty">Sem filtros adicionais</b>}<button type="button" onClick={limparFiltros}>× Limpar filtros</button></div>
        {filtrosAbertos && !baseAtiva?.propria && <div className="base-filter-options compact"><label className="base-state-select"><span>Mês de referência</span><select value={mesSelecionado} onChange={(event) => selecionarMes(event.target.value)}>{baseAtiva?.id === BASES_TODAS_ID && <option value="">Todos os meses</option>}{mesesDisponiveis.map((referencia) => <option key={referencia}>{referencia}</option>)}</select></label><label className="base-state-select"><span>Estado para preços</span><select value={ufSelecionada} onChange={(event) => selecionarEstado(event.target.value)}>{UFS_SINAPI.map((uf) => <option key={uf}>{uf}</option>)}</select></label></div>}
      </section>
      <div className="base-count-grid">
        <article><span>COMPOSIÇÕES</span><strong>{Number(baseAtiva?.composicoes || 0).toLocaleString("pt-BR")}</strong><small>Serviços compostos</small></article>
        <article><span>INSUMOS</span><strong>{Number(baseAtiva?.insumos || 0).toLocaleString("pt-BR")}</strong><small>Materiais, mão de obra e equipamentos</small></article>
        <article><span>ITENS DE PREÇO</span><strong>{totalItensPreco.toLocaleString("pt-BR")}</strong><small>Composições e insumos pesquisáveis</small></article>
        <article><span>REGISTROS TÉCNICOS</span><strong>{totalRegistros.toLocaleString("pt-BR")}</strong><small>Inclui vínculos analíticos e tabelas auxiliares</small></article>
      </div>
      <main className="orc-card base-library-catalog">
        <header><div><span>CATÁLOGO</span><h3>{baseAtiva?.titulo || "Selecione uma base"}</h3></div><div className="base-catalog-header-actions"><label>Itens por página <select disabled={mostrarTodos} value={porPagina} onChange={(event) => setPorPagina(Number(event.target.value))}><option value="200">200</option><option value="500">500</option><option value="1000">1.000</option></select></label><button type="button" onClick={() => setMostrarTodos((valor) => !valor)}>{mostrarTodos ? "Usar paginação" : `Exibir todos (${referenciasFiltradas.length.toLocaleString("pt-BR")})`}</button></div></header>
        <div className="base-catalog-results">
          {referencias.map((item) => (
            <article key={`${item.basePrecoId || baseAtiva?.id}-${item.tipo}-${item.codigo}`} className="is-clickable" onClick={() => setItemEstados({ ...item, basePrecoId: item.basePrecoId || baseAtiva?.id, baseTitulo: item.baseTitulo || baseAtiva?.titulo })}>
              <span><strong>{item.codigo}</strong><small>{item.tipo}</small></span>
              <p>{item.descricao}</p>
              <span className="base-item-unit"><small>UNIDADE</small><strong>{item.unidade || "—"}</strong></span>
              <b className={item.semPreco ? "sem-preco" : ""} title={item.precoSubstituidoSp ? `Valor de SP utilizado porque não há preço publicado para ${ufSelecionada}.` : undefined}>{item.semPreco ? "Sem preço nesta UF" : <>{moeda(item.preco)}{item.precoSubstituidoSp && <sup>*</sup>}</>}</b>
              {baseAtiva?.propria && <button type="button" onClick={(event) => { event.stopPropagation(); basesPrecos.removerComposicaoPropria(basesPrecos.composicoesProprias.find((cpu) => cpu.codigo === item.codigo)?.id); }}>×</button>}
            </article>
          ))}
          {!referencias.length && <div className="orc-empty-base"><strong>Nenhum registro encontrado</strong><span>Troque o mês, o estado, o tipo ou o termo pesquisado.</span></div>}
        </div>
        {!mostrarTodos && referenciasFiltradas.length > porPagina && <footer className="base-pagination"><button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))}>← Anterior</button><span>Página {pagina} de {totalPaginas} · {referenciasFiltradas.length.toLocaleString("pt-BR")} registros</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}>Próxima →</button></footer>}
        {referencias.some((item) => item.precoSubstituidoSp) && <p className="base-price-legend">* Valor de SP utilizado porque a publicação não possui preço para {ufSelecionada}.</p>}
      </main>
      <aside className="orc-card procurement-roadmap-note"><span>EVOLUÇÃO PLANEJADA</span><strong>Relatório de suprimentos</strong><p>A decomposição recursiva das composições preparada nesta etapa será a base para calcular insumos, consumo por cronograma e datas de compra com antecedência configurável.</p></aside>
    </section>
  );
}
