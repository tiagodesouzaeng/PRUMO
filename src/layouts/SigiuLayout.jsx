/* =====================================================
   RELEASE........: v7.1.0 RC1
   ARQUIVO........: src/layouts/SigiuLayout.jsx
   DESCRIÇÃO......: Layout principal multi-módulo do SIGIU
===================================================== */

import Sidebar from "../components/Navigation/Sidebar";
import Topbar from "../components/Navigation/Topbar";
import BottomNav from "../components/Navigation/BottomNav";

export default function SigiuLayout({
  children,
  paginaAtiva,
  setPaginaAtiva,
  ultimaAtualizacao,
}) {
  return (
    <div className="sigiu-shell">
      <Sidebar paginaAtiva={paginaAtiva} setPaginaAtiva={setPaginaAtiva} />

      <div className="sigiu-main">
        <Topbar
          paginaAtiva={paginaAtiva}
          setPaginaAtiva={setPaginaAtiva}
          ultimaAtualizacao={ultimaAtualizacao}
        />

        <main className="sigiu-content">{children}</main>
      </div>

      <BottomNav paginaAtiva={paginaAtiva} setPaginaAtiva={setPaginaAtiva} />
    </div>
  );
}
