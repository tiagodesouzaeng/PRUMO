import { useEffect, useMemo, useState } from "react";
import {
  criarClientePrumo,
  obterConfiguracaoInfraestrutura,
  obterContextoDesenvolvimento,
} from "../services/infraestruturaCorporativa";
import { sugerirCodigoPatrimonial } from "../services/codigosPatrimonio";

const NIVEIS = ["cliente", "site", "predio", "sala"];
const ROTULOS = { cliente: "Cliente", site: "Site", predio: "Prédio", sala: "Sala" };
const PAI_ESPERADO = { cliente: "", site: "cliente", predio: "site", sala: "predio" };
const ICONES = { cliente: "◎", site: "⌖", predio: "▦", sala: "□" };
const SELECAO_VAZIA = { cliente: "", site: "", predio: "", sala: "" };

const NOVA_UNIDADE = {
  nivel: "cliente", parentId: "", codigo: "", nome: "", status: "ativo",
  endereco: { logradouro: "", cidade: "", uf: "" }, areaM2: null,
  responsavel: "", ocupacao: "", dados: {},
};

const NOVO_ATIVO = {
  salaId: "", codigo: "", nome: "", categoria: "equipamento",
  numeroPatrimonio: "", fabricante: "", modelo: "", numeroSerie: "",
  status: "ativo", dados: {},
};

function criarCliente() {
  const config = obterConfiguracaoInfraestrutura();
  if (!config.apiConfigurada) return null;
  return criarClientePrumo({
    baseUrl: config.apiUrl,
    obterContexto: () => obterContextoDesenvolvimento(),
  });
}

function caminhoTexto(unidade) {
  return (unidade?.caminho || []).map((item) => item.nome).join(" › ");
}

function selecaoDoCaminho(unidade, lista) {
  if (!unidade) return SELECAO_VAZIA;
  const porId = new Map(lista.map((item) => [item.id, item]));
  const selecao = { ...SELECAO_VAZIA };
  let atual = unidade;
  while (atual) {
    selecao[atual.nivel] = atual.id;
    atual = atual.parentId ? porId.get(atual.parentId) : null;
  }
  return selecao;
}

function Modal({ titulo, descricao, onClose, children }) {
  return (
    <div className="sigiu-patrimonio-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sigiu-patrimonio-modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <div><span>Cadastro patrimonial</span><h2>{titulo}</h2><p>{descricao}</p></div>
          <button type="button" aria-label="Fechar cadastro" onClick={onClose}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function Patrimonio() {
  const cliente = useMemo(criarCliente, []);
  const [unidades, setUnidades] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [selecao, setSelecao] = useState(SELECAO_VAZIA);
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState("");
  const [ativoSelecionadoId, setAtivoSelecionadoId] = useState("");
  const [formUnidade, setFormUnidade] = useState(NOVA_UNIDADE);
  const [formAtivo, setFormAtivo] = useState(NOVO_ATIVO);
  const [edicaoUnidadeId, setEdicaoUnidadeId] = useState("");
  const [edicaoAtivoId, setEdicaoAtivoId] = useState("");
  const [modalUnidadeAberto, setModalUnidadeAberto] = useState(false);
  const [modalAtivoAberto, setModalAtivoAberto] = useState(false);
  const [unidadeParaExcluir, setUnidadeParaExcluir] = useState(null);
  const [movimento, setMovimento] = useState({ destinoSalaId: "", motivo: "" });
  const [mensagem, setMensagem] = useState(
    cliente ? "Carregando cadastro patrimonial…" : "Conecte a API corporativa para usar o patrimônio.",
  );
  const [salvando, setSalvando] = useState(false);

  const unidadeSelecionada = unidades.find((item) => item.id === unidadeSelecionadaId) || null;
  const salaSelecionada = unidades.find((item) => item.id === selecao.sala) || null;
  const ativoSelecionado = ativos.find((item) => item.id === ativoSelecionadoId) || null;
  const salas = unidades.filter((item) => item.nivel === "sala" && item.status === "ativo");
  const ativosDaSala = ativos.filter((item) => item.salaId === selecao.sala);
  const paisPermitidos = unidades.filter((item) => (
    item.id !== edicaoUnidadeId
    && item.nivel === PAI_ESPERADO[formUnidade.nivel] && item.status === "ativo"
  ));

  function aplicarSelecao(id, lista = unidades) {
    const item = lista.find((unidade) => unidade.id === id);
    if (!item) return;
    setSelecao(selecaoDoCaminho(item, lista));
    setUnidadeSelecionadaId(item.id);
  }

  async function carregar(selecionarId = "") {
    if (!cliente) return;
    try {
      const [listaUnidades, listaAtivos] = await Promise.all([
        cliente.listarUnidadesPatrimoniais(),
        cliente.listarAtivosPatrimoniais(),
      ]);
      setUnidades(listaUnidades);
      setAtivos(listaAtivos);
      const alvo = selecionarId
        || (unidadeSelecionadaId && listaUnidades.some((item) => item.id === unidadeSelecionadaId) ? unidadeSelecionadaId : "")
        || listaUnidades.find((item) => item.nivel === "cliente")?.id
        || "";
      if (alvo) {
        const item = listaUnidades.find((unidade) => unidade.id === alvo);
        setSelecao(selecaoDoCaminho(item, listaUnidades));
        setUnidadeSelecionadaId(alvo);
      }
      setMensagem("");
    } catch (error) {
      setMensagem(error.message);
    }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!cliente || !ativoSelecionadoId) {
      setMovimentacoes([]);
      return;
    }
    cliente.listarMovimentacoesPatrimoniais(ativoSelecionadoId)
      .then(setMovimentacoes)
      .catch((error) => setMensagem(error.message));
  }, [cliente, ativoSelecionadoId]);

  function selecionarUnidade(item) {
    const indice = NIVEIS.indexOf(item.nivel);
    const proxima = { ...selecao, [item.nivel]: item.id };
    NIVEIS.slice(indice + 1).forEach((nivel) => { proxima[nivel] = ""; });
    setSelecao(proxima);
    setUnidadeSelecionadaId(item.id);
    setAtivoSelecionadoId("");
  }

  function abrirNovaUnidade(nivel) {
    const nivelPai = PAI_ESPERADO[nivel];
    const parentId = nivelPai ? selecao[nivelPai] : "";
    setEdicaoUnidadeId("");
    setFormUnidade({
      ...NOVA_UNIDADE,
      nivel,
      parentId,
      codigo: sugerirCodigoPatrimonial(nivel, parentId, unidades),
    });
    setModalUnidadeAberto(true);
  }

  function editarUnidade(item) {
    setEdicaoUnidadeId(item.id);
    setUnidadeSelecionadaId(item.id);
    setFormUnidade({
      nivel: item.nivel, parentId: item.parentId, codigo: item.codigo, nome: item.nome,
      status: item.status, endereco: item.endereco || {}, areaM2: item.areaM2,
      responsavel: item.responsavel || "", ocupacao: item.ocupacao || "", dados: item.dados || {},
    });
    setModalUnidadeAberto(true);
  }

  async function salvarUnidade(event) {
    event.preventDefault();
    if (!cliente) return;
    setSalvando(true);
    try {
      const dados = { ...formUnidade, areaM2: formUnidade.areaM2 === "" ? null : Number(formUnidade.areaM2) };
      const atual = unidades.find((item) => item.id === edicaoUnidadeId);
      const salva = edicaoUnidadeId
        ? await cliente.atualizarUnidadePatrimonial(edicaoUnidadeId, dados, atual.versao)
        : await cliente.criarUnidadePatrimonial(dados, crypto.randomUUID());
      setModalUnidadeAberto(false);
      setEdicaoUnidadeId("");
      await carregar(salva.id);
      setMensagem(`${ROTULOS[salva.nivel]} salvo com sucesso.`);
    } catch (error) { setMensagem(error.message); }
    finally { setSalvando(false); }
  }

  async function excluirUnidade() {
    if (!cliente || !unidadeParaExcluir) return;
    setSalvando(true);
    try {
      const selecionarDepois = unidadeParaExcluir.parentId || "";
      await cliente.excluirUnidadePatrimonial(unidadeParaExcluir.id, unidadeParaExcluir.versao);
      setUnidadeParaExcluir(null);
      setModalUnidadeAberto(false);
      setEdicaoUnidadeId("");
      setUnidadeSelecionadaId("");
      setSelecao(SELECAO_VAZIA);
      await carregar(selecionarDepois);
      setMensagem(`${ROTULOS[unidadeParaExcluir.nivel]} excluído com sucesso.`);
    } catch (error) { setMensagem(error.message); setUnidadeParaExcluir(null); }
    finally { setSalvando(false); }
  }

  function abrirNovoAtivo() {
    if (!salaSelecionada) return;
    setEdicaoAtivoId("");
    setFormAtivo({ ...NOVO_ATIVO, salaId: salaSelecionada.id });
    setModalAtivoAberto(true);
  }

  function editarAtivo(item) {
    setAtivoSelecionadoId(item.id);
    setEdicaoAtivoId(item.id);
    setFormAtivo({
      salaId: item.salaId, codigo: item.codigo, nome: item.nome, categoria: item.categoria,
      numeroPatrimonio: item.numeroPatrimonio, fabricante: item.fabricante,
      modelo: item.modelo, numeroSerie: item.numeroSerie, status: item.status, dados: item.dados || {},
    });
    setModalAtivoAberto(true);
  }

  async function salvarAtivo(event) {
    event.preventDefault();
    if (!cliente) return;
    setSalvando(true);
    try {
      const atual = ativos.find((item) => item.id === edicaoAtivoId);
      const salvo = edicaoAtivoId
        ? await cliente.atualizarAtivoPatrimonial(edicaoAtivoId, formAtivo, atual.versao)
        : await cliente.criarAtivoPatrimonial(formAtivo, crypto.randomUUID());
      setModalAtivoAberto(false);
      setEdicaoAtivoId("");
      setAtivoSelecionadoId(salvo.id);
      await carregar(salvo.salaId);
      setMensagem("Ativo patrimonial salvo com sucesso.");
    } catch (error) { setMensagem(error.message); }
    finally { setSalvando(false); }
  }

  async function movimentar(event) {
    event.preventDefault();
    if (!cliente || !ativoSelecionado) return;
    setSalvando(true);
    try {
      const resultado = await cliente.movimentarAtivoPatrimonial(ativoSelecionado.id, movimento, crypto.randomUUID());
      setMovimento({ destinoSalaId: "", motivo: "" });
      await carregar(resultado.destinoSalaId);
      setAtivoSelecionadoId(ativoSelecionado.id);
      setMovimentacoes(await cliente.listarMovimentacoesPatrimoniais(ativoSelecionado.id));
      setMensagem("Movimentação registrada na trilha patrimonial.");
    } catch (error) { setMensagem(error.message); }
    finally { setSalvando(false); }
  }

  const contagens = Object.fromEntries(NIVEIS.map((nivel) => [nivel, unidades.filter((item) => item.nivel === nivel).length]));
  const itensPorNivel = {
    cliente: unidades.filter((item) => item.nivel === "cliente"),
    site: unidades.filter((item) => item.nivel === "site" && item.parentId === selecao.cliente),
    predio: unidades.filter((item) => item.nivel === "predio" && item.parentId === selecao.site),
    sala: unidades.filter((item) => item.nivel === "sala" && item.parentId === selecao.predio),
  };

  return (
    <section className="sigiu-page sigiu-page-modulo sigiu-page-patrimonio">
      <div className="sigiu-page-heading sigiu-page-heading--modulo">
        <div><span className="sigiu-page-eyebrow">Fonte corporativa única</span><h1>Patrimônio e espaços</h1><p>Selecione a estrutura da esquerda para a direita: Cliente → Site → Prédio → Sala.</p></div>
        <div className="sigiu-page-heading__meta"><strong>11.0</strong><span>cadastro patrimonial</span></div>
      </div>

      <div className="sigiu-module-kpis sigiu-patrimonio-kpis">
        {NIVEIS.map((nivel) => <article key={nivel} className="sigiu-module-kpi sigiu-module-kpi--primary"><span>{ICONES[nivel]}</span><small>{ROTULOS[nivel]}</small><strong>{contagens[nivel]}</strong><em>cadastrados</em></article>)}
        <article className="sigiu-module-kpi sigiu-module-kpi--success"><span>⚙</span><small>Ativos</small><strong>{ativos.length}</strong><em>equipamentos</em></article>
      </div>

      {mensagem && <p className="sigiu-patrimonio-message" role="status">{mensagem}</p>}

      <section className="sigiu-card sigiu-admin-card sigiu-patrimonio-browser">
        <header className="sigiu-card-header-row"><div><h2>Estrutura patrimonial</h2><p>Cada coluna apresenta somente os registros vinculados à seleção anterior.</p></div></header>
        <div className="sigiu-patrimonio-columns">
          {NIVEIS.map((nivel) => {
            const nivelPai = PAI_ESPERADO[nivel];
            const habilitado = !nivelPai || Boolean(selecao[nivelPai]);
            return (
              <section className={`sigiu-patrimonio-column ${!habilitado ? "is-disabled" : ""}`} key={nivel} aria-label={ROTULOS[nivel]}>
                <header><div><span>{ICONES[nivel]}</span><strong>{ROTULOS[nivel]}</strong><small>{itensPorNivel[nivel].length}</small></div><button type="button" disabled={!cliente || !habilitado} onClick={() => abrirNovaUnidade(nivel)}>+ Novo</button></header>
                <div className="sigiu-patrimonio-column-list">
                  {itensPorNivel[nivel].map((item) => (
                    <article key={item.id} className={selecao[nivel] === item.id ? "is-selected" : ""}>
                      <button type="button" onClick={() => selecionarUnidade(item)}><strong>{item.nome}</strong><small>{item.codigo} · {item.status}</small></button>
                      <button type="button" className="sigiu-patrimonio-edit" aria-label={`Editar ${item.nome}`} onClick={() => editarUnidade(item)}>✎</button>
                      <button type="button" className="sigiu-patrimonio-delete" aria-label={`Excluir ${item.nome}`} onClick={() => setUnidadeParaExcluir(item)}>×</button>
                    </article>
                  ))}
                  {habilitado && !itensPorNivel[nivel].length && <p>Nenhum {ROTULOS[nivel].toLocaleLowerCase("pt-BR")} cadastrado.</p>}
                  {!habilitado && <p>Selecione primeiro um {ROTULOS[nivelPai].toLocaleLowerCase("pt-BR")}.</p>}
                </div>
              </section>
            );
          })}
        </div>
        <footer className="sigiu-patrimonio-breadcrumb"><span>Local selecionado</span><strong>{unidadeSelecionada ? caminhoTexto(unidadeSelecionada) : "Selecione um cliente para começar"}</strong></footer>
      </section>

      <section className="sigiu-card sigiu-admin-card sigiu-patrimonio-assets-section">
        <header className="sigiu-card-header-row">
          <div><h2>Ativos e equipamentos</h2><p>{salaSelecionada ? caminhoTexto(salaSelecionada) : "Selecione uma Sala na estrutura patrimonial para consultar seus ativos."}</p></div>
          <button type="button" className="sigiu-btn sigiu-btn--primary" disabled={!salaSelecionada} onClick={abrirNovoAtivo}>+ Novo ativo</button>
        </header>
        {salaSelecionada ? (
          <div className="sigiu-patrimonio-assets-table">
            <div className="sigiu-patrimonio-assets-head"><span>Equipamento</span><span>Identificação</span><span>Situação</span><span>Ações</span></div>
            {ativosDaSala.map((item) => <article key={item.id} className={ativoSelecionadoId === item.id ? "is-selected" : ""} onClick={() => setAtivoSelecionadoId(item.id)}><div><strong>{item.nome}</strong><small>{item.fabricante} {item.modelo}</small></div><div><strong>{item.codigo}</strong><small>{item.numeroPatrimonio || "Sem nº patrimonial"}</small></div><span>{item.status.replaceAll("_", " ")}</span><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={(event) => { event.stopPropagation(); editarAtivo(item); }}>Editar</button></article>)}
            {!ativosDaSala.length && <p className="sigiu-empty-inline">Nenhum ativo cadastrado nesta sala.</p>}
          </div>
        ) : <div className="sigiu-patrimonio-room-empty"><span>□</span><strong>Nenhuma sala selecionada</strong><p>Escolha Cliente, Site, Prédio e Sala nas colunas acima.</p></div>}
      </section>

      {ativoSelecionado && (
        <section className="sigiu-card sigiu-admin-card sigiu-patrimonio-movements">
          <header className="sigiu-card-header-row"><div><h2>Movimentação patrimonial</h2><p>Transfira {ativoSelecionado.nome} para outra sala com justificativa e trilha auditável.</p></div></header>
          <form className="sigiu-patrimonio-move-form" onSubmit={movimentar}>
            <label><span>Local atual</span><strong>{caminhoTexto(unidades.find((item) => item.id === ativoSelecionado.salaId))}</strong></label>
            <label><span>Sala de destino</span><select required value={movimento.destinoSalaId} onChange={(e) => setMovimento((atual) => ({ ...atual, destinoSalaId: e.target.value }))}><option value="">Selecione…</option>{salas.filter((sala) => sala.id !== ativoSelecionado.salaId).map((sala) => <option key={sala.id} value={sala.id}>{caminhoTexto(sala)}</option>)}</select></label>
            <label><span>Motivo</span><input required minLength={3} value={movimento.motivo} onChange={(e) => setMovimento((atual) => ({ ...atual, motivo: e.target.value }))} placeholder="Ex.: remanejamento operacional" /></label>
            <button type="submit" className="sigiu-btn sigiu-btn--primary" disabled={salvando}>Movimentar</button>
          </form>
          <div className="sigiu-patrimonio-history">
            {movimentacoes.map((item) => <article key={item.id}><strong>{unidades.find((unidade) => unidade.id === item.origemSalaId)?.nome || "Sala anterior"} → {unidades.find((unidade) => unidade.id === item.destinoSalaId)?.nome || "Nova sala"}</strong><span>{item.motivo}</span><time>{new Date(item.movimentadoEm).toLocaleString("pt-BR")}</time></article>)}
            {!movimentacoes.length && <p className="sigiu-empty-inline">Este ativo ainda não possui movimentações.</p>}
          </div>
        </section>
      )}

      {modalUnidadeAberto && (
        <Modal titulo={edicaoUnidadeId ? `Editar ${ROTULOS[formUnidade.nivel]}` : `Novo ${ROTULOS[formUnidade.nivel]}`} descricao="Preencha a identificação, localização e responsabilidade da unidade." onClose={() => setModalUnidadeAberto(false)}>
          <form className="sigiu-simple-form sigiu-patrimonio-modal-form" onSubmit={salvarUnidade}>
            <div className="sigiu-patrimonio-modal-grid">
              <label><span>Nível</span><select value={formUnidade.nivel} disabled={!edicaoUnidadeId} onChange={(e) => setFormUnidade((atual) => ({ ...atual, nivel: e.target.value, parentId: "" }))}>{NIVEIS.map((nivel) => <option key={nivel} value={nivel}>{ROTULOS[nivel]}</option>)}</select>{edicaoUnidadeId && <small>O nível pode ser corrigido quando não há registros dependentes.</small>}</label>
              <label><span>Código</span><input required maxLength={80} value={formUnidade.codigo} onChange={(e) => setFormUnidade((atual) => ({ ...atual, codigo: e.target.value.toUpperCase() }))} placeholder={`Ex.: ${sugerirCodigoPatrimonial(formUnidade.nivel, formUnidade.parentId, unidades)}`} />{!edicaoUnidadeId && <small>Sugestão sequencial automática; o código permanece editável.</small>}</label>
              {formUnidade.nivel !== "cliente" && <label className="is-wide"><span>{ROTULOS[PAI_ESPERADO[formUnidade.nivel]]} responsável</span><select required value={formUnidade.parentId} onChange={(e) => setFormUnidade((atual) => ({ ...atual, parentId: e.target.value }))}><option value="">Selecione…</option>{paisPermitidos.map((item) => <option key={item.id} value={item.id}>{caminhoTexto(item)}</option>)}</select></label>}
              <label className="is-wide"><span>Nome</span><input required minLength={2} value={formUnidade.nome} onChange={(e) => setFormUnidade((atual) => ({ ...atual, nome: e.target.value }))} /></label>
              <label><span>Área (m²)</span><input type="number" min="0" step="0.01" value={formUnidade.areaM2 ?? ""} onChange={(e) => setFormUnidade((atual) => ({ ...atual, areaM2: e.target.value }))} /></label>
              <label><span>Situação</span><select value={formUnidade.status} onChange={(e) => setFormUnidade((atual) => ({ ...atual, status: e.target.value }))}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
              <label><span>Responsável</span><input value={formUnidade.responsavel} onChange={(e) => setFormUnidade((atual) => ({ ...atual, responsavel: e.target.value }))} /></label>
              <label><span>Ocupação/uso</span><input value={formUnidade.ocupacao} onChange={(e) => setFormUnidade((atual) => ({ ...atual, ocupacao: e.target.value }))} placeholder="Ex.: Administrativo" /></label>
              <label className="is-wide"><span>Logradouro</span><input value={formUnidade.endereco?.logradouro || ""} onChange={(e) => setFormUnidade((atual) => ({ ...atual, endereco: { ...atual.endereco, logradouro: e.target.value } }))} /></label>
              <label><span>Cidade</span><input value={formUnidade.endereco?.cidade || ""} onChange={(e) => setFormUnidade((atual) => ({ ...atual, endereco: { ...atual.endereco, cidade: e.target.value } }))} /></label>
              <label><span>UF</span><input maxLength={2} value={formUnidade.endereco?.uf || ""} onChange={(e) => setFormUnidade((atual) => ({ ...atual, endereco: { ...atual.endereco, uf: e.target.value.toUpperCase() } }))} /></label>
            </div>
            <footer>{edicaoUnidadeId && <button type="button" className="sigiu-btn sigiu-patrimonio-danger" onClick={() => setUnidadeParaExcluir(unidades.find((item) => item.id === edicaoUnidadeId))}>Excluir</button>}<button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => setModalUnidadeAberto(false)}>Cancelar</button><button type="submit" className="sigiu-btn sigiu-btn--primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar unidade"}</button></footer>
          </form>
        </Modal>
      )}

      {modalAtivoAberto && (
        <Modal titulo={edicaoAtivoId ? "Editar ativo" : "Novo ativo"} descricao={caminhoTexto(salaSelecionada)} onClose={() => setModalAtivoAberto(false)}>
          <form className="sigiu-simple-form sigiu-patrimonio-modal-form" onSubmit={salvarAtivo}>
            <div className="sigiu-patrimonio-modal-grid">
              <label className="is-wide"><span>Sala</span><select required disabled value={formAtivo.salaId}><option value={formAtivo.salaId}>{caminhoTexto(unidades.find((item) => item.id === formAtivo.salaId))}</option></select></label>
              <label><span>Código</span><input required value={formAtivo.codigo} onChange={(e) => setFormAtivo((atual) => ({ ...atual, codigo: e.target.value }))} /></label>
              <label><span>Nº patrimonial</span><input value={formAtivo.numeroPatrimonio} onChange={(e) => setFormAtivo((atual) => ({ ...atual, numeroPatrimonio: e.target.value }))} /></label>
              <label className="is-wide"><span>Nome</span><input required minLength={2} value={formAtivo.nome} onChange={(e) => setFormAtivo((atual) => ({ ...atual, nome: e.target.value }))} /></label>
              <label><span>Categoria</span><input value={formAtivo.categoria} onChange={(e) => setFormAtivo((atual) => ({ ...atual, categoria: e.target.value }))} /></label>
              <label><span>Situação</span><select value={formAtivo.status} onChange={(e) => setFormAtivo((atual) => ({ ...atual, status: e.target.value }))}><option value="ativo">Ativo</option><option value="em_manutencao">Em manutenção</option><option value="inativo">Inativo</option><option value="baixado">Baixado</option></select></label>
              <label><span>Fabricante</span><input value={formAtivo.fabricante} onChange={(e) => setFormAtivo((atual) => ({ ...atual, fabricante: e.target.value }))} /></label>
              <label><span>Modelo</span><input value={formAtivo.modelo} onChange={(e) => setFormAtivo((atual) => ({ ...atual, modelo: e.target.value }))} /></label>
              <label className="is-wide"><span>Número de série</span><input value={formAtivo.numeroSerie} onChange={(e) => setFormAtivo((atual) => ({ ...atual, numeroSerie: e.target.value }))} /></label>
            </div>
            <footer><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => setModalAtivoAberto(false)}>Cancelar</button><button type="submit" className="sigiu-btn sigiu-btn--primary" disabled={salvando}>Salvar ativo</button></footer>
          </form>
        </Modal>
      )}

      {unidadeParaExcluir && (
        <Modal titulo={`Excluir ${ROTULOS[unidadeParaExcluir.nivel]}`} descricao="Esta ação remove definitivamente o cadastro quando não existem vínculos dependentes." onClose={() => setUnidadeParaExcluir(null)}>
          <div className="sigiu-patrimonio-confirm-delete">
            <p>Confirma a exclusão de <strong>{unidadeParaExcluir.nome}</strong>?</p>
            <small>Unidades filhas, ativos, obras ou movimentações vinculadas impedem a exclusão para proteger a integridade dos dados.</small>
            <footer><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => setUnidadeParaExcluir(null)}>Cancelar</button><button type="button" className="sigiu-btn sigiu-patrimonio-danger" disabled={salvando} onClick={excluirUnidade}>{salvando ? "Excluindo…" : "Excluir definitivamente"}</button></footer>
          </div>
        </Modal>
      )}
    </section>
  );
}
