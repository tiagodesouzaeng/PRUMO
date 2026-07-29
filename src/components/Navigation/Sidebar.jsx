import { SIGIU_NAV_ITEMS } from "./navItems";
import PrumoLogo from "../Brand/PrumoLogo";

export default function Sidebar({ paginaAtiva, setPaginaAtiva }) {
  return (
    <aside className="sigiu-sidebar sigiu-sidebar-main">
      <div className="sigiu-sidebar-brand">
        <PrumoLogo />
      </div>

      <nav className="sigiu-sidebar-nav" aria-label="Módulos do PRUMO">
        {SIGIU_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sigiu-nav-item ${paginaAtiva === item.id ? "is-active" : ""}`}
            onClick={() => setPaginaAtiva(item.id)}
          >
            <span className="sigiu-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="sigiu-sidebar-collapse" aria-label="Recolher menu">
        «
      </button>
    </aside>
  );
}
