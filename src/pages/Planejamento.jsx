import { useEffect, useMemo, useState } from "react";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "../services/infraestruturaCorporativa";
import { useContextoPatrimonial } from "../contexts/ContextoPatrimonialContext";

const STATUS = { rascunho: "Rascunho", em_analise: "Em análise", priorizada: "Priorizada", aprovada: "Aprovada", rejeitada: "Rejeitada", incorporada: "Na carteira" };
const CATEGORIAS = { obra_reforma: "Obras e reformas", manutencao: "Manutenção", regularidade: "Regularidade", eficiencia: "Eficiência", acessibilidade: "Acessibilidade", tecnologia: "Tecnologia", outro: "Outro" };
const ACOES = {
  rascunho: [["enviar_analise", "Enviar para análise"]],
  em_analise: [["priorizar", "Priorizar"], ["rejeitar", "Rejeitar"]],
  priorizada: [["aprovar", "Aprovar"], ["rejeitar", "Rejeitar"]],
  rejeitada: [["reabrir", "Reabrir análise"]],
};
const vazioDemanda = { codigo: "", titulo: "", patrimonioUnidadeId: "", programaId: "", categoria: "obra_reforma", descricao: "", solicitante: "", valorEstimado: 0, dataDesejada: "", urgencia: 3, impacto: 3, risco: 3, alinhamento: 3, dados: {} };

function moeda(valor) { return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function chave() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function pontuacao(item) { return Math.round((((Number(item.urgencia) || 3) * 30 + (Number(item.impacto) || 3) * 30 + (Number(item.risco) || 3) * 20 + (Number(item.alinhamento) || 3) * 20) / 5) * 100) / 100; }
function caminho(unidade) { return (unidade?.caminho || []).map((parte) => parte.nome).join(" › ") || unidade?.nome || ""; }
function proximoCodigo(prefixo, itens) { const maior = itens.reduce((maximo, item) => Math.max(maximo, Number(String(item.codigo || "").match(/(\d+)$/)?.[1]) || 0), 0); return `${prefixo}-${String(maior + 1).padStart(3, "0")}`; }
function prepararDemanda(item) {
  const payload = { patrimonioUnidadeId: item.patrimonioUnidadeId, programaId: item.programaId || "", codigo: item.codigo, titulo: item.titulo, descricao: item.descricao || "", solicitante: item.solicitante || "", categoria: item.categoria || "obra_reforma", valorEstimado: Number(item.valorEstimado) || 0, urgencia: Number(item.urgencia) || 3, impacto: Number(item.impacto) || 3, risco: Number(item.risco) || 3, alinhamento: Number(item.alinhamento) || 3, dados: item.dados || {} };
  if (item.dataDesejada) payload.dataDesejada = item.dataDesejada;
  return payload;
}

export default function Planejamento() {
  const contextoPatrimonial = useContextoPatrimonial();
  const cliente = useMemo(() => { const config = obterConfiguracaoInfraestrutura(); return config.apiConfigurada ? criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() }) : null; }, []);
  const [dados, setDados] = useState({ demandas: [], programas: [], carteiras: [], unidades: [] });
  const [aba, setAba] = useState("demandas"); const [filtro, setFiltro] = useState(""); const [status, setStatus] = useState("");
  const [modal, setModal] = useState(null); const [form, setForm] = useState(vazioDemanda); const [selecionada, setSelecionada] = useState(null);
  const [mensagem, setMensagem] = useState(""); const [carregando, setCarregando] = useState(true); const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (!cliente) { setMensagem("Configure a API local para utilizar Demandas e Investimentos."); setCarregando(false); return; }
    try {
      const [demandas, programas, carteiras, unidades] = await Promise.all([cliente.listarDemandasInvestimento(), cliente.listarProgramasInvestimento(), cliente.listarCarteirasInvestimento(), cliente.listarUnidadesPatrimoniais({ status: "ativo" })]);
      setDados({ demandas, programas, carteiras, unidades }); setMensagem("");
    } catch (erro) { setMensagem(erro.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  const demandasEscopo = useMemo(() => dados.demandas.filter((item) => contextoPatrimonial.estaNoEscopo(item.patrimonioUnidadeId)), [dados.demandas, contextoPatrimonial.idsEscopo]);
  const demandas = useMemo(() => demandasEscopo.filter((item) => !status || item.status === status).filter((item) => !filtro || `${item.codigo} ${item.titulo} ${item.solicitante}`.toLocaleLowerCase("pt-BR").includes(filtro.toLocaleLowerCase("pt-BR"))), [demandasEscopo, filtro, status]);
  const totais = useMemo(() => ({ total: demandasEscopo.length, analise: demandasEscopo.filter((item) => ["em_analise", "priorizada"].includes(item.status)).length, aprovadas: demandasEscopo.filter((item) => ["aprovada", "incorporada"].includes(item.status)).length, valor: demandasEscopo.filter((item) => item.status === "incorporada").reduce((soma, item) => soma + Number(item.valorEstimado || 0), 0) }), [demandasEscopo]);

  function abrirDemanda(item = null) { setForm(item ? { ...item } : { ...vazioDemanda, codigo: proximoCodigo("D", dados.demandas) }); setModal("demanda"); }
  async function salvarDemanda(evento) {
    evento.preventDefault(); setSalvando(true);
    try { const payload = prepararDemanda(form); if (form.id) await cliente.atualizarDemandaInvestimento(form.id, payload, form.versao); else await cliente.criarDemandaInvestimento(payload, chave()); setModal(null); await carregar(); }
    catch (erro) { setMensagem(erro.message); } finally { setSalvando(false); }
  }
  async function abrirDetalhe(item) { try { setSelecionada(await cliente.obterDemandaInvestimento(item.id)); } catch (erro) { setMensagem(erro.message); } }
  async function decidir(acao) {
    const justificativa = acao === "rejeitar" ? globalThis.prompt("Justificativa da rejeição:") : globalThis.prompt("Observação da decisão (opcional):", "");
    if (justificativa === null) return;
    try { const resultado = await cliente.decidirDemandaInvestimento(selecionada.id, { acao, justificativa }, selecionada.versao, chave()); setSelecionada({ ...resultado.demanda, decisoes: [resultado.decisao, ...(selecionada.decisoes || [])] }); await carregar(); }
    catch (erro) { setMensagem(erro.message); }
  }
  async function incorporar(evento) {
    evento.preventDefault(); const corpo = new FormData(evento.currentTarget); const carteiraId = corpo.get("carteiraId");
    try { await cliente.incorporarDemandaCarteira(carteiraId, { demandId: selecionada.id, ordem: Number(corpo.get("ordem")), valorPlanejado: Number(corpo.get("valorPlanejado")), observacao: corpo.get("observacao") }, selecionada.versao, chave()); setSelecionada(null); await carregar(); }
    catch (erro) { setMensagem(erro.message); }
  }
  async function salvarPrograma(evento) {
    evento.preventDefault(); setSalvando(true); const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try { await cliente.criarProgramaInvestimento({ ...corpo, anoInicio: corpo.anoInicio ? Number(corpo.anoInicio) : null, anoFim: corpo.anoFim ? Number(corpo.anoFim) : null, limiteFinanceiro: Number(corpo.limiteFinanceiro || 0), dados: {} }, chave()); setModal(null); await carregar(); }
    catch (erro) { setMensagem(erro.message); } finally { setSalvando(false); }
  }
  async function salvarCarteira(evento) {
    evento.preventDefault(); setSalvando(true); const corpo = Object.fromEntries(new FormData(evento.currentTarget));
    try { await cliente.criarCarteiraInvestimento({ ...corpo, ano: Number(corpo.ano), limiteFinanceiro: Number(corpo.limiteFinanceiro || 0), dados: {} }, chave()); setModal(null); await carregar(); }
    catch (erro) { setMensagem(erro.message); } finally { setSalvando(false); }
  }

  return <div className="sigiu-page sigiu-planning">
    <header className="sigiu-page-heading sigiu-page-heading--modulo sigiu-planning-header"><div><span className="sigiu-page-eyebrow">Planejamento estratégico</span><h1>Demandas e investimentos</h1><p>Da necessidade identificada no patrimônio à carteira anual aprovada.</p></div><button className="sigiu-primary" onClick={() => abrirDemanda()}>+ Nova demanda</button></header>
    {mensagem && <div className="sigiu-feedback">{mensagem}</div>}
    {contextoPatrimonial.unidadeAtiva && <div className="sigiu-context-scope-notice">Exibindo o contexto: <strong>{contextoPatrimonial.unidadeAtiva.nome}</strong></div>}
    <section className="sigiu-planning-kpis">
      <article><span>Demandas</span><strong>{totais.total}</strong></article><article><span>Em avaliação</span><strong>{totais.analise}</strong></article><article><span>Aprovadas</span><strong>{totais.aprovadas}</strong></article><article><span>Carteira incorporada</span><strong>{moeda(totais.valor)}</strong></article>
    </section>
    <nav className="sigiu-planning-tabs"><button className={aba === "demandas" ? "active" : ""} onClick={() => setAba("demandas")}>Demandas</button><button className={aba === "programas" ? "active" : ""} onClick={() => setAba("programas")}>Programas</button><button className={aba === "carteiras" ? "active" : ""} onClick={() => setAba("carteiras")}>Carteiras e plano anual</button></nav>
    {carregando ? <div className="sigiu-empty">Carregando planejamento…</div> : aba === "demandas" ? <>
      <div className="sigiu-planning-toolbar"><input aria-label="Pesquisar demandas" placeholder="Pesquisar código, título ou solicitante" value={filtro} onChange={(e) => setFiltro(e.target.value)} /><select aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os estágios</option>{Object.entries(STATUS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select></div>
      <div className="sigiu-planning-table"><table><thead><tr><th>Prioridade</th><th>Demanda</th><th>Local</th><th>Valor estimado</th><th>Estágio</th><th></th></tr></thead><tbody>{demandas.map((item) => { const unidade = dados.unidades.find((u) => u.id === item.patrimonioUnidadeId); return <tr key={item.id} onClick={() => abrirDetalhe(item)}><td><strong className="sigiu-score">{item.pontuacao}</strong></td><td><b>{item.codigo}</b><span>{item.titulo}</span></td><td>{caminho(unidade)}</td><td>{moeda(item.valorEstimado)}</td><td><span className={`sigiu-status status-${item.status}`}>{STATUS[item.status]}</span></td><td><button className="sigiu-link" onClick={(e) => { e.stopPropagation(); abrirDetalhe(item); }}>Abrir</button></td></tr>; })}</tbody></table>{!demandas.length && <div className="sigiu-empty">Nenhuma demanda encontrada.</div>}</div>
    </> : aba === "programas" ? <section className="sigiu-planning-cards"><div className="sigiu-section-title"><div><h2>Programas de investimento</h2><p>Agrupam demandas por objetivo estratégico.</p></div><button onClick={() => setModal("programa")}>+ Novo programa</button></div>{dados.programas.map((item) => <article key={item.id}><span>{item.codigo}</span><h3>{item.nome}</h3><p>{item.objetivo || "Objetivo ainda não informado."}</p><footer><b>{moeda(item.limiteFinanceiro)}</b><small>{item.anoInicio || "—"} a {item.anoFim || "—"}</small></footer></article>)}</section>
    : <section className="sigiu-planning-cards"><div className="sigiu-section-title"><div><h2>Carteiras e plano anual</h2><p>Consolidação financeira das demandas aprovadas.</p></div><button onClick={() => setModal("carteira")}>+ Nova carteira</button></div>{dados.carteiras.map((item) => { const usado = (item.itens || []).reduce((soma, vinculo) => soma + Number(vinculo.valorPlanejado || 0), 0); return <article key={item.id}><span>{item.codigo} · {item.ano}</span><h3>{item.nome}</h3><p>{item.itens?.length || 0} demanda(s) incorporada(s)</p><div className="sigiu-progress"><i style={{ width: `${item.limiteFinanceiro ? Math.min(100, usado / item.limiteFinanceiro * 100) : 0}%` }} /></div><footer><b>{moeda(usado)}</b><small>de {moeda(item.limiteFinanceiro)}</small></footer></article>; })}</section>}

    {modal === "demanda" && <div className="sigiu-modal-backdrop"><form className="sigiu-modal sigiu-planning-modal" onSubmit={salvarDemanda}><header><div><span>DEMANDA DE INVESTIMENTO</span><h2>{form.id ? "Editar demanda" : "Nova demanda"}</h2></div><button type="button" onClick={() => setModal(null)}>×</button></header><div className="sigiu-form-grid">
      <label>Código<input required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></label><label className="span-2">Título<input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label>
      <label className="span-2">Local patrimonial<select required value={form.patrimonioUnidadeId} onChange={(e) => setForm({ ...form, patrimonioUnidadeId: e.target.value })}><option value="">Selecione Cliente › Site › Prédio › Sala</option>{dados.unidades.map((item) => <option key={item.id} value={item.id}>{caminho(item)}</option>)}</select></label><label>Programa<select value={form.programaId} onChange={(e) => setForm({ ...form, programaId: e.target.value })}><option value="">Sem programa</option>{dados.programas.filter((item) => item.status === "ativo").map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
      <label>Categoria<select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{Object.entries(CATEGORIAS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select></label><label>Valor estimado<input type="number" min="0" step="0.01" value={form.valorEstimado} onChange={(e) => setForm({ ...form, valorEstimado: Number(e.target.value) })} /></label><label>Data desejada<input type="date" value={form.dataDesejada || ""} onChange={(e) => setForm({ ...form, dataDesejada: e.target.value })} /></label>
      <label>Solicitante<input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></label><label className="span-2">Descrição<textarea rows="3" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
    </div><div className="sigiu-score-editor"><div><span>Pontuação calculada</span><strong>{pontuacao(form)}</strong></div>{[["urgencia","Urgência"],["impacto","Impacto"],["risco","Risco"],["alinhamento","Alinhamento"]].map(([campo, rotulo]) => <label key={campo}>{rotulo}<input type="range" min="1" max="5" value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: Number(e.target.value) })} /><b>{form[campo]}</b></label>)}</div><footer><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="sigiu-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar demanda"}</button></footer></form></div>}
    {modal === "programa" && <div className="sigiu-modal-backdrop"><form className="sigiu-modal sigiu-planning-small" onSubmit={salvarPrograma}><header><h2>Novo programa</h2><button type="button" onClick={() => setModal(null)}>×</button></header><label>Código<input name="codigo" defaultValue={proximoCodigo("PRG", dados.programas)} required /></label><label>Nome<input name="nome" required /></label><label>Objetivo<textarea name="objetivo" rows="3" /></label><div className="sigiu-form-grid"><label>Ano inicial<input name="anoInicio" type="number" min="2000" max="2200" /></label><label>Ano final<input name="anoFim" type="number" min="2000" max="2200" /></label><label>Limite financeiro<input name="limiteFinanceiro" type="number" min="0" step="0.01" /></label></div><footer><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="sigiu-primary" disabled={salvando}>Criar programa</button></footer></form></div>}
    {modal === "carteira" && <div className="sigiu-modal-backdrop"><form className="sigiu-modal sigiu-planning-small" onSubmit={salvarCarteira}><header><h2>Nova carteira anual</h2><button type="button" onClick={() => setModal(null)}>×</button></header><label>Código<input name="codigo" defaultValue={`CAR-${new Date().getFullYear()}-${String(dados.carteiras.length + 1).padStart(2, "0")}`} required /></label><label>Nome<input name="nome" defaultValue={`Plano anual ${new Date().getFullYear()}`} required /></label><label>Ano<input name="ano" type="number" defaultValue={new Date().getFullYear()} required /></label><label>Limite financeiro<input name="limiteFinanceiro" type="number" min="0" step="0.01" /></label><footer><button type="button" onClick={() => setModal(null)}>Cancelar</button><button className="sigiu-primary" disabled={salvando}>Criar carteira</button></footer></form></div>}
    {selecionada && <div className="sigiu-drawer-backdrop" onClick={() => setSelecionada(null)}><aside className="sigiu-planning-drawer" onClick={(e) => e.stopPropagation()}><header><div><span>{selecionada.codigo}</span><h2>{selecionada.titulo}</h2></div><button onClick={() => setSelecionada(null)}>×</button></header><div className="sigiu-planning-detail"><div className="sigiu-score large">{selecionada.pontuacao}</div><div><span className={`sigiu-status status-${selecionada.status}`}>{STATUS[selecionada.status]}</span><p>{selecionada.descricao || "Sem descrição."}</p><b>{moeda(selecionada.valorEstimado)}</b></div></div><div className="sigiu-detail-actions">{(ACOES[selecionada.status] || []).map(([acao, rotulo]) => <button key={acao} className={acao === "rejeitar" ? "danger" : ""} onClick={() => decidir(acao)}>{rotulo}</button>)}{['rascunho','em_analise','rejeitada'].includes(selecionada.status) && <button onClick={() => { setSelecionada(null); abrirDemanda(selecionada); }}>Editar</button>}</div>{selecionada.status === "aprovada" && <form className="sigiu-incorporar" onSubmit={incorporar}><h3>Incorporar à carteira</h3><select name="carteiraId" required><option value="">Selecione a carteira</option>{dados.carteiras.filter((item) => ['elaboracao','em_aprovacao'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select><div><input name="ordem" type="number" min="1" defaultValue="1" required /><input name="valorPlanejado" type="number" min="0" step="0.01" defaultValue={selecionada.valorEstimado} required /></div><input name="observacao" placeholder="Observação" /><button className="sigiu-primary">Incorporar</button></form>}<section className="sigiu-timeline"><h3>Histórico de decisões</h3>{(selecionada.decisoes || []).map((item) => <article key={item.id}><i /><div><b>{STATUS[item.statusNovo]}</b><span>{item.decididoPor} · {new Date(item.decididoEm).toLocaleString("pt-BR")}</span>{item.justificativa && <p>{item.justificativa}</p>}</div></article>)}{!selecionada.decisoes?.length && <p>Nenhuma decisão registrada.</p>}</section></aside></div>}
  </div>;
}
