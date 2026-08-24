/* =====================================================
   RELEASE........: v7.1.0 RC1
   ARQUIVO........: src/layouts/SigiuLayout.jsx
   DESCRIÇÃO......: Layout principal multi-módulo do SIGIU
===================================================== */

import { useState } from "react";
import Sidebar from "../components/Navigation/Sidebar";
import Topbar from "../components/Navigation/Topbar";
import BottomNav from "../components/Navigation/BottomNav";

export default function SigiuLayout({
  children,
  paginaAtiva,
  setPaginaAtiva,
  ultimaAtualizacao,
  modulosPermitidos,
  sessao,
  onSair,
}) {
  const [menuRecolhido, setMenuRecolhido] = useState(() => {
    try {
      return globalThis.localStorage?.getItem("prumo:menu-lateral-recolhido") === "true";
    } catch {
      return false;
    }
  });

  function alternarMenu() {
    setMenuRecolhido((atual) => {
      const proximo = !atual;
      try {
        globalThis.localStorage?.setItem("prumo:menu-lateral-recolhido", String(proximo));
      } catch {
        // Preferência visual não deve impedir o uso do sistema.
      }
      return proximo;
    });
  }

  return (
    <div className={`sigiu-shell ${menuRecolhido ? "is-sidebar-collapsed" : ""}`}>
      <Sidebar
        paginaAtiva={paginaAtiva}
        setPaginaAtiva={setPaginaAtiva}
        recolhido={menuRecolhido}
        onAlternar={alternarMenu}
        modulosPermitidos={modulosPermitidos}
      />

      <div className="sigiu-main">
        <Topbar
          paginaAtiva={paginaAtiva}
          setPaginaAtiva={setPaginaAtiva}
          ultimaAtualizacao={ultimaAtualizacao}
          sessao={sessao}
          onSair={onSair}
        />

        <main className="sigiu-content">{children}</main>
      </div>

      <BottomNav paginaAtiva={paginaAtiva} setPaginaAtiva={setPaginaAtiva} modulosPermitidos={modulosPermitidos} />
    </div>
  );
}
