/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/App.jsx
   DESCRIÇÃO......: SIGIU multi-módulo com páginas estruturadas
                    para PPCI, Alertas, Consumo Hídrico, Obras,
                    Manutenção, Relatórios e Administração.
===================================================== */

import { useEffect, useMemo, useState } from "react";
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
import BasesPrecos from "./pages/BasesPrecos";
import useBasesPrecos from "./hooks/useBasesPrecos";
import Documentos from "./pages/Documentos";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "./services/infraestruturaCorporativa";

function App() {
  const [paginaAtiva, setPaginaAtiva] = useState("visao-geral");
  const dadosPPCI = usePPCI();
  const basesPrecos = useBasesPrecos();
  const [modulosPermitidos, setModulosPermitidos] = useState(null);
  const cliente = useMemo(() => {
    const config = obterConfiguracaoInfraestrutura();
    return config.apiConfigurada
      ? criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() })
      : null;
  }, []);

  useEffect(() => {
    if (!cliente) return;
    cliente.listarModulos()
      .then((modulos) => setModulosPermitidos(new Set(modulos.map((item) => item.id))))
      .catch(() => setModulosPermitidos(null));
  }, [cliente]);

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
        return <Orcamento basesPrecos={basesPrecos} />;

      case "bases-precos":
        return <BasesPrecos basesPrecos={basesPrecos} />;

      case "manutencao":
        return <Manutencao />;

      case "documentos":
        return <Documentos />;

      case "relatorios":
        return <Relatorios dadosPPCI={dadosPPCI} />;

      case "administracao":
        return <Administracao basesPrecos={basesPrecos} />;

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
      modulosPermitidos={modulosPermitidos}
    >
      {renderizarPagina()}
    </SigiuLayout>
  );
}

export default App;
