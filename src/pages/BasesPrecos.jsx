import { useMemo, useState } from "react";
import { BASE_PROPRIA_ID } from "../hooks/useBasesPrecos";
import { UNIDADES_ORCAMENTARIAS } from "../domain/orcamento";
import ModalComposicaoRastreavel from "../components/Orcamento/ModalComposicaoRastreavel";
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
          <label><span>Estado</span><select value={dados.uf} onChange={(event) => setDados((atual) => ({ ...atual, uf: event.target.value }))}>{ufs.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
          <label><span>Mês de referência</span><input required value={dados.referencia} onChange={(event) => setDados((atual) => ({ ...atual, referencia: event.target.value }))} placeholder="MM/AAAA" /></label>
          <label className="orc-field-wide"><span>Regime</span><select value={dados.regime} onChange={(event) => setDados((atual) => ({ ...atual, regime: event.target.value }))}><option value="PADRAO">Padrão</option><option value="SEM-DESONERACAO">Sem desoneração</option><option value="DESONERADO">Desonerado</option><option value="SEM-ENCARGOS">Sem encargos</option></select></label>
          <label className="orc-field-wide orc-file-drop"><span>ZIP, XLSX ou XLS</span><input required type="file" accept=".zip,.xlsx,.xls" onChange={(event) => setArquivo(event.target.files[0] || null)} /><small>{arquivo?.name || "Selecione a publicação da base."}</small></label>
          <div className="orc-sinapi-official-note orc-field-wide"><strong>Importação independente dos orçamentos</strong><span>O pacote será versionado no submódulo Bases de Preços. O SINAPI completo inclui composições sintéticas, analíticas e insumos.</span></div>
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

export default function BasesPrecos({ basesPrecos }) {
  const [modal, setModal] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("composicao");
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [detalhe, setDetalhe] = useState(null);
  const referenciasFiltradas = useMemo(() => basesPrecos.referencias
    .filter((item) => item.tipo === tipo)
    .filter((item) => !busca.trim() || `${item.codigo} ${item.descricao} ${item.unidade || ""}`.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))), [basesPrecos.referencias, busca, tipo]);
  const referencias = referenciasFiltradas.slice(0, 80);
  const baseAtiva = basesPrecos.baseAtiva;
  const totalRegistros = Number(baseAtiva?.registros)
    || Number(baseAtiva?.composicoes || 0) + Number(baseAtiva?.insumos || 0);

  function avisar(texto) {
    setAviso(texto);
    globalThis.setTimeout(() => setAviso(""), 3000);
  }

  return (
    <section className="sigiu-page orc-page bases-module-page">
      {aviso && <div className="orc-toast" role="status">{aviso}</div>}
      {modal === "importar" && <ModalImportar fechar={() => setModal("")} basesPrecos={basesPrecos} avisar={avisar} />}
      {modal === "composicao" && <ModalComposicaoPropria fechar={() => setModal("")} basesPrecos={basesPrecos} avisar={avisar} />}
      {detalhe && <ModalComposicaoRastreavel referencia={detalhe} basesPrecos={basesPrecos} fechar={() => setDetalhe(null)} tituloContexto="Rastreabilidade da base" />}
      <div className="orc-section-heading">
        <div><span>SUBMÓDULO INDEPENDENTE</span><h2>Bases de preços</h2><p>Publicações oficiais, composições analíticas, insumos e base corporativa fora dos orçamentos.</p></div>
        <div className="orc-heading-actions"><button className="orc-btn orc-btn-ghost" type="button" onClick={() => setModal("importar")}>⇧ Importar base</button><button className="orc-btn orc-btn-primary" type="button" onClick={() => { basesPrecos.setBaseAtivaId(BASE_PROPRIA_ID); setModal("composicao"); }}>＋ Composição própria</button></div>
      </div>
      <section className="base-monitor-header">
        <div><span>BASES MONITORADAS</span><strong>{basesPrecos.bases.length} publicações cadastradas</strong></div>
        <div className="base-monitor-pills">
          <b>{referenciasFiltradas.length.toLocaleString("pt-BR")} VISÍVEIS</b>
          <b>{baseAtiva?.fonte || "SEM BASE"} · {baseAtiva?.uf || "—"} · {baseAtiva?.referencia || "—"}</b>
          <div className="catalog-type-buttons"><button type="button" className={tipo === "composicao" ? "is-active" : ""} onClick={() => setTipo("composicao")}>COMPOSIÇÕES</button><button type="button" className={tipo === "insumo" ? "is-active" : ""} onClick={() => setTipo("insumo")}>INSUMOS</button></div>
        </div>
      </section>
      <section className="orc-card base-filter-panel">
        <div className="base-filter-primary">
          <label><span>BUSCAR NA BASE</span><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar por código, descrição ou unidade..." /></label>
          <button type="button" className="orc-btn orc-btn-primary" onClick={() => setBusca((atual) => atual.trim())}>Atualizar</button>
        </div>
        <button className="base-filter-toggle" type="button" onClick={() => setFiltrosAbertos((aberto) => !aberto)}><span><i>{filtrosAbertos ? "−" : "+"}</i> Filtros da publicação</span><b>{referenciasFiltradas.length.toLocaleString("pt-BR")} de {Number(baseAtiva?.[tipo === "composicao" ? "composicoes" : "insumos"] || 0).toLocaleString("pt-BR")}</b></button>
        {filtrosAbertos && <div className="base-filter-options"><SeletorPublicacao basesPrecos={basesPrecos} /><div className="base-publication-tabs">{basesPrecos.bases.map((base) => <button type="button" key={base.id} className={base.id === basesPrecos.baseAtivaId ? "is-active" : ""} onClick={() => basesPrecos.setBaseAtivaId(base.id)}><strong>{base.fonte}</strong><span>{base.uf} · {base.referencia}</span><small>{Number(base.composicoes || 0).toLocaleString("pt-BR")} comp. · {Number(base.insumos || 0).toLocaleString("pt-BR")} insumos · {Number(base.registros || (Number(base.composicoes || 0) + Number(base.insumos || 0))).toLocaleString("pt-BR")} itens</small></button>)}</div></div>}
      </section>
      <div className="base-count-grid">
        <article><span>COMPOSIÇÕES</span><strong>{Number(baseAtiva?.composicoes || 0).toLocaleString("pt-BR")}</strong><small>Serviços compostos</small></article>
        <article><span>INSUMOS</span><strong>{Number(baseAtiva?.insumos || 0).toLocaleString("pt-BR")}</strong><small>Materiais, mão de obra e equipamentos</small></article>
        <article><span>ITENS DA BASE</span><strong>{totalRegistros.toLocaleString("pt-BR")}</strong><small>Registros catalogados</small></article>
        <article><span>PUBLICAÇÃO ATIVA</span><strong>{baseAtiva?.referencia || "—"}</strong><small>{baseAtiva?.titulo || "Selecione uma publicação"}</small></article>
      </div>
      <main className="orc-card base-library-catalog">
        <header><div><span>CATÁLOGO</span><h3>{baseAtiva?.titulo || "Selecione uma base"}</h3></div><small>Clique em uma composição para abrir sua memória e navegar pelos níveis internos.</small></header>
        <div className="base-catalog-results">
          {referencias.map((item) => (
            <article key={`${item.tipo}-${item.codigo}`} className={item.tipo === "composicao" ? "is-clickable" : ""} onClick={() => item.tipo === "composicao" && setDetalhe({ basePrecoId: baseAtiva?.id, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, preco: item.preco })}>
              <span><strong>{item.codigo}</strong><small>{item.tipo}</small></span>
              <p>{item.descricao}</p>
              <span className="base-item-unit"><small>UNIDADE</small><strong>{item.unidade || "—"}</strong></span>
              <b className={item.semPreco ? "sem-preco" : ""}>{item.semPreco ? "Sem preço nesta UF" : moeda(item.preco)}</b>
              {baseAtiva?.propria && <button type="button" onClick={(event) => { event.stopPropagation(); basesPrecos.removerComposicaoPropria(basesPrecos.composicoesProprias.find((cpu) => cpu.codigo === item.codigo)?.id); }}>×</button>}
            </article>
          ))}
          {!referencias.length && <div className="orc-empty-base"><strong>Nenhum registro encontrado</strong><span>Troque o mês, o estado, o tipo ou o termo pesquisado.</span></div>}
        </div>
        {referenciasFiltradas.length > referencias.length && <footer className="base-results-limit">Exibindo os primeiros {referencias.length} de {referenciasFiltradas.length.toLocaleString("pt-BR")} registros para manter a navegação rápida.</footer>}
      </main>
      <aside className="orc-card procurement-roadmap-note"><span>EVOLUÇÃO PLANEJADA</span><strong>Relatório de suprimentos</strong><p>A decomposição recursiva das composições preparada nesta etapa será a base para calcular insumos, consumo por cronograma e datas de compra com antecedência configurável.</p></aside>
    </section>
  );
}
