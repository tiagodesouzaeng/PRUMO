/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/App.jsx
   DESCRIÇÃO......: SIGIU multi-módulo com páginas estruturadas
                    para PPCI, Alertas, Consumo Hídrico, Obras,
                    Manutenção, Relatórios e Administração.
===================================================== */

import { useState } from "react";
import "./App.css";

import usePPCI from "./hooks/usePPCI";
import SigiuLayout from "./layouts/SigiuLayout";
import VisaoGeral from "./pages/VisaoGeral";
import PPCI from "./pages/PPCI";
import CentralAlertas from "./pages/CentralAlertas";
import ConsumoHidrico from "./pages/ConsumoHidrico";
import Obras from "./pages/Obras";
import Manutencao from "./pages/Manutencao";
import Relatorios from "./pages/Relatorios";
import Administracao from "./pages/Administracao";
import Orcamento from "./pages/Orcamento";

function App() {
  const [paginaAtiva, setPaginaAtiva] = useState("visao-geral");
  const dadosPPCI = usePPCI();

  function renderizarPagina() {
    switch (paginaAtiva) {
      case "visao-geral":
        return (
          <VisaoGeral
            dadosPPCI={dadosPPCI}
            onAbrirModulo={setPaginaAtiva}
          />
        );

      case "ppci":
        return <PPCI dadosPPCI={dadosPPCI} />;

      case "alertas":
        return (
          <CentralAlertas
            dadosPPCI={dadosPPCI}
            onAbrirModulo={setPaginaAtiva}
          />
        );

      case "hidrico":
        return <ConsumoHidrico />;

      case "obras":
        return <Obras />;

      case "orcamento":
        return <Orcamento />;

      case "manutencao":
        return <Manutencao />;

      case "relatorios":
        return <Relatorios dadosPPCI={dadosPPCI} />;

      case "administracao":
        return <Administracao />;

      default:
        return (
          <VisaoGeral
            dadosPPCI={dadosPPCI}
            onAbrirModulo={setPaginaAtiva}
          />
        );
    }
  }

  return (
    <SigiuLayout
      paginaAtiva={paginaAtiva}
      setPaginaAtiva={setPaginaAtiva}
      ultimaAtualizacao={dadosPPCI.ultimaAtualizacao}
    >
      {renderizarPagina()}
    </SigiuLayout>
  );
}

export default App;
