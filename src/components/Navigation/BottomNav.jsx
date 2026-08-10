/* =====================================================
   RELEASE........: v7.6 RC1
   ARQUIVO........: src/components/Navigation/BottomNav.jsx
   DESCRIÇÃO......: Navegação mobile-first com botão Mais
                    para módulos secundários do SIGIU.
===================================================== */

import { useState } from "react";
import { SIGIU_NAV_ITEMS } from "./navItems";

const MOBILE_PRIMARY_ITEMS = ["visao-geral", "ppci", "orcamento", "obras"];

function obterLabelMobile(item) {
  if (item.id === "visao-geral") return "Geral";
  if (item.id === "hidrico") return "Consumo";
  return item.label;
}

export default function BottomNav({ paginaAtiva, setPaginaAtiva, modulosPermitidos }) {
  const [menuAberto, setMenuAberto] = useState(false);

  const itensPermitidos = modulosPermitidos?.size
    ? SIGIU_NAV_ITEMS.filter((item) => modulosPermitidos.has(item.moduleId))
    : SIGIU_NAV_ITEMS;
  const itensPrimarios = itensPermitidos.filter((item) => MOBILE_PRIMARY_ITEMS.includes(item.id));
  const itensMais = itensPermitidos.filter((item) => !MOBILE_PRIMARY_ITEMS.includes(item.id));
  const maisAtivo = itensMais.some((item) => item.id === paginaAtiva);

  function navegar(id) {
    setPaginaAtiva(id);
    setMenuAberto(false);
  }

  return (
    <>
      {menuAberto && (
        <button
          type="button"
          className="sigiu-mobile-more-backdrop"
          aria-label="Fechar menu de módulos"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <div className={`sigiu-mobile-more-sheet ${menuAberto ? "is-open" : ""}`} aria-hidden={!menuAberto}>
        <div className="sigiu-mobile-more-sheet__handle" />
        <header>
          <strong>Mais módulos</strong>
          <small>Acesse todos os demais módulos habilitados para sua organização.</small>
        </header>
        <div className="sigiu-mobile-more-sheet__grid">
          {itensMais.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sigiu-mobile-more-item ${paginaAtiva === item.id ? "is-active" : ""}`}
              onClick={() => navegar(item.id)}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>

      <nav className="sigiu-bottom-nav" aria-label="Navegação mobile PRUMO">
        {itensPrimarios.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sigiu-bottom-nav__item ${paginaAtiva === item.id ? "is-active" : ""}`}
            onClick={() => navegar(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{obterLabelMobile(item)}</small>
          </button>
        ))}

        <button
          type="button"
          className={`sigiu-bottom-nav__item ${maisAtivo || menuAberto ? "is-active" : ""}`}
          onClick={() => setMenuAberto((valor) => !valor)}
          aria-expanded={menuAberto}
        >
          <span aria-hidden="true">•••</span>
          <small>Mais</small>
        </button>
      </nav>
    </>
  );
}
