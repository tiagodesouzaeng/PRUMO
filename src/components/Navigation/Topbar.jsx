import { SIGIU_NAV_ITEMS } from "./navItems";

function obterTituloPagina(paginaAtiva) {
  return SIGIU_NAV_ITEMS.find((item) => item.id === paginaAtiva)?.label ?? "Visão Geral";
}

export default function Topbar({ paginaAtiva, setPaginaAtiva, ultimaAtualizacao }) {
  const tituloPagina = obterTituloPagina(paginaAtiva);

  return (
    <header className="sigiu-topbar sigiu-topbar-main">
      <div className="sigiu-topbar-title">
        <span className="sigiu-mobile-brand">PRUMO</span>
        <div>
          <h1>{paginaAtiva === "visao-geral" ? "PRUMO" : tituloPagina}</h1>
          <p>Plataforma de Inteligência e Gestão</p>
        </div>
      </div>

      <div className="sigiu-topbar-actions">
        <button type="button" className="sigiu-select-button">
          🏢 <span>Campus Canoas</span> <strong>⌄</strong>
        </button>

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
        <button type="button" className="sigiu-select-button sigiu-select-button--mobile">
          🏢 Campus Canoas <strong>⌄</strong>
        </button>
        <button type="button" className="sigiu-icon-button" aria-label="Buscar">⌕</button>
        <button type="button" className="sigiu-icon-button sigiu-icon-button--notification" aria-label="Notificações">🔔<span>3</span></button>
      </div>

      {ultimaAtualizacao && (
        <div className="sigiu-topbar-update">Atualizado em {ultimaAtualizacao}</div>
      )}
    </header>
  );
}
