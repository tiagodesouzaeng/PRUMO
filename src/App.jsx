/* =====================================================
   RELEASE........: v8.0 + v8.1 RC1
   ARQUIVO........: src/App.jsx
   DESCRIÇÃO......: SIGIU multi-módulo com páginas estruturadas
                    para PPCI, Alertas, Consumo Hídrico, Obras,
                    Manutenção, Relatórios e Administração.
===================================================== */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";

import usePPCI from "./hooks/usePPCI";
import SigiuLayout from "./layouts/SigiuLayout";
import useBasesPrecos from "./hooks/useBasesPrecos";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "./services/infraestruturaCorporativa";

const VisaoGeral = lazy(() => import("./pages/VisaoGeral"));
const PPCI = lazy(() => import("./pages/PPCI"));
const CentralAlertas = lazy(() => import("./pages/CentralAlertas"));
const ConsumoHidrico = lazy(() => import("./pages/ConsumoHidrico"));
const Obras = lazy(() => import("./pages/Obras"));
const Manutencao = lazy(() => import("./pages/Manutencao"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Administracao = lazy(() => import("./pages/Administracao"));
const Orcamento = lazy(() => import("./pages/Orcamento"));
const BasesPrecos = lazy(() => import("./pages/BasesPrecos"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Patrimonio = lazy(() => import("./pages/Patrimonio"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const Suprimentos = lazy(() => import("./pages/Suprimentos"));
const Contratos = lazy(() => import("./pages/Contratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Convenios = lazy(() => import("./pages/Convenios"));
const Regularidade = lazy(() => import("./pages/Regularidade"));

function App() {
  const [paginaAtiva, setPaginaAtiva] = useState("visao-geral");
  const dadosPPCI = usePPCI();
  const basesPrecos = useBasesPrecos();
  const [modulosPermitidos, setModulosPermitidos] = useState(null);
  const [catalogoCarregado, setCatalogoCarregado] = useState(false);
  const cliente = useMemo(() => {
    const config = obterConfiguracaoInfraestrutura();
    return config.apiConfigurada
      ? criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() })
      : null;
  }, []);

  useEffect(() => {
    if (!cliente) {
      setCatalogoCarregado(true);
      return;
    }
    cliente.listarModulos()
      .then((modulos) => setModulosPermitidos(new Set(modulos.map((item) => item.id))))
      .catch(() => setModulosPermitidos(new Set()))
      .finally(() => setCatalogoCarregado(true));
  }, [cliente]);

  const modulosNavegacao = cliente && !catalogoCarregado ? new Set() : modulosPermitidos;

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

      case "patrimonio":
        return <Patrimonio />;

      case "planejamento":
        return <Planejamento />;

      case "suprimentos":
        return <Suprimentos />;

      case "contratos":
        return <Contratos />;

      case "financeiro":
        return <Financeiro />;

      case "convenios":
        return <Convenios />;

      case "regularidade":
        return <Regularidade />;

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
      modulosPermitidos={modulosNavegacao}
    >
      <Suspense fallback={<div className="sigiu-empty">Carregando módulo…</div>}>
        {renderizarPagina()}
      </Suspense>
    </SigiuLayout>
  );
}

export default App;
