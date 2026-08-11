import { useEffect, useRef, useState } from "react";
import { SIGIU_NAV_ITEMS } from "./navItems";
import PrumoLogo from "../Brand/PrumoLogo";
import { useContextoPatrimonial } from "../../contexts/ContextoPatrimonialContext";

function obterTituloPagina(paginaAtiva) {
  return SIGIU_NAV_ITEMS.find((item) => item.id === paginaAtiva)?.label ?? "Visão Geral";
}

export default function Topbar({ paginaAtiva, setPaginaAtiva, ultimaAtualizacao }) {
  const tituloPagina = obterTituloPagina(paginaAtiva);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const seletorRef = useRef(null);
  const {
    contextoCorporativo, clienteSelecionado, unidadeAtiva, porNivel, selecao,
    selecionar, carregando, erro,
  } = useContextoPatrimonial();
  const nomeCliente = clienteSelecionado?.nome || contextoCorporativo?.tenantNome || "Selecione o cliente";
  const localSelecionado = unidadeAtiva && unidadeAtiva.nivel !== "cliente"
    ? unidadeAtiva.nome
    : "Todos os locais";

  useEffect(() => {
    function fechar(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !seletorRef.current?.contains(event.target))) {
        setSeletorAberto(false);
      }
    }
    document.addEventListener("pointerdown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("pointerdown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, []);

  const painelContexto = seletorAberto && (
    <section className="sigiu-context-popover" role="dialog" aria-label="Selecionar contexto patrimonial">
      <header><strong>Contexto de trabalho</strong><small>{contextoCorporativo?.tenantNome || "Empresa ativa"}</small></header>
      {erro && <p className="sigiu-context-error">{erro}</p>}
      <label><span>Cliente</span><select value={selecao.cliente} onChange={(event) => selecionar("cliente", event.target.value)}><option value="">Selecione…</option>{porNivel.cliente.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
      <label><span>Site</span><select value={selecao.site} disabled={!selecao.cliente} onChange={(event) => selecionar("site", event.target.value)}><option value="">Todos os sites</option>{porNivel.site.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
      <label><span>Prédio</span><select value={selecao.predio} disabled={!selecao.site} onChange={(event) => selecionar("predio", event.target.value)}><option value="">Todos os prédios</option>{porNivel.predio.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
      <label><span>Sala</span><select value={selecao.sala} disabled={!selecao.predio} onChange={(event) => selecionar("sala", event.target.value)}><option value="">Todas as salas</option>{porNivel.sala.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>)}</select></label>
      <footer><button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => setSeletorAberto(false)}>Aplicar contexto</button></footer>
    </section>
  );

  const seletorContexto = (
    <div className="sigiu-context-selector">
      <button
        type="button"
        className="sigiu-select-button sigiu-context-trigger"
        aria-expanded={seletorAberto}
        aria-haspopup="dialog"
        onClick={() => setSeletorAberto((atual) => !atual)}
      >
        <span aria-hidden="true">🏢</span>
        <span className="sigiu-context-trigger__text"><strong>{carregando ? "Carregando…" : nomeCliente}</strong><small>{localSelecionado}</small></span>
        <strong aria-hidden="true">⌄</strong>
      </button>
    </div>
  );

  return (
    <header className="sigiu-topbar sigiu-topbar-main" ref={seletorRef}>
      <div className="sigiu-topbar-title">
        <PrumoLogo compacto className="sigiu-mobile-brand" />
        <div>
          <h1>{paginaAtiva === "visao-geral" ? "PRUMO" : tituloPagina}</h1>
          <p>Plataforma de Inteligência e Gestão</p>
        </div>
      </div>

      <div className="sigiu-topbar-actions">
        {seletorContexto}

        <label className="sigiu-global-search">
          <span>⌕</span>
          <input type="search" placeholder="Buscar no PRUMO..." />
        </label>

        <button type="button" className="sigiu-date-button">
          📅 <span>Período atual</span> <strong>⌄</strong>
        </button>

        <button type="button" className="sigiu-notification-button" aria-label="Notificações">
          🔔 <span>3</span>
        </button>
      </div>

      <div className="sigiu-mobile-controls">
        <button type="button" className="sigiu-select-button sigiu-select-button--mobile" onClick={() => setSeletorAberto(true)}>
          🏢 {nomeCliente} <strong>⌄</strong>
        </button>
        <button type="button" className="sigiu-icon-button" aria-label="Buscar">⌕</button>
        <button type="button" className="sigiu-icon-button sigiu-icon-button--notification" aria-label="Notificações">🔔<span>3</span></button>
      </div>

      {ultimaAtualizacao && (
        <div className="sigiu-topbar-update">Atualizado em {ultimaAtualizacao}</div>
      )}
      {painelContexto}
    </header>
  );
}
