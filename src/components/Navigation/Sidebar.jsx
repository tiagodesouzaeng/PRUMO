import { SIGIU_NAV_ITEMS } from "./navItems";
import PrumoLogo from "../Brand/PrumoLogo";

export default function Sidebar({ paginaAtiva, setPaginaAtiva, recolhido, onAlternar, modulosPermitidos }) {
  const itens = modulosPermitidos instanceof Set
    ? SIGIU_NAV_ITEMS.filter((item) => modulosPermitidos.has(item.moduleId))
    : SIGIU_NAV_ITEMS;
  return (
    <aside className={`sigiu-sidebar sigiu-sidebar-main ${recolhido ? "is-collapsed" : ""}`}>
      <div className="sigiu-sidebar-brand">
        <PrumoLogo compacto={recolhido} />
      </div>

      <nav className="sigiu-sidebar-nav" aria-label="Módulos do PRUMO">
        {itens.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sigiu-nav-item ${paginaAtiva === item.id ? "is-active" : ""}`}
            onClick={() => setPaginaAtiva(item.id)}
            title={recolhido ? item.label : undefined}
            aria-label={item.label}
          >
            <span className="sigiu-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="sigiu-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="sigiu-sidebar-collapse"
        aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
        aria-expanded={!recolhido}
        title={recolhido ? "Expandir menu" : "Recolher menu"}
        onClick={onAlternar}
      >
        {recolhido ? "»" : "«"}
      </button>
    </aside>
  );
}
