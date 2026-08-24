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
import { ContextoPatrimonialProvider } from "./contexts/ContextoPatrimonialContext";
import Login from "./pages/Login";
import { carregarSessao, encerrarSessaoLocal, limparSessao, obterConfiguracaoAcesso } from "./services/sessaoPrumo";

const VisaoGeral = lazy(() => import("./pages/VisaoGeral"));
const ConsumoHidrico = lazy(() => import("./pages/ConsumoHidrico"));
const Obras = lazy(() => import("./pages/Obras"));
const Manutencao = lazy(() => import("./pages/Manutencao"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Administracao = lazy(() => import("./pages/Administracao"));
const Orcamento = lazy(() => import("./pages/Orcamento"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Patrimonio = lazy(() => import("./pages/Patrimonio"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const Suprimentos = lazy(() => import("./pages/Suprimentos"));
const Contratos = lazy(() => import("./pages/Contratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Convenios = lazy(() => import("./pages/Convenios"));
const Regularidade = lazy(() => import("./pages/Regularidade"));

function AplicacaoAutenticada({ configuracaoAcesso, sessao, onSessaoEncerrada }) {
  const [paginaAtiva, setPaginaAtiva] = useState("visao-geral");
  const dadosPPCI = usePPCI();
  const basesPrecos = useBasesPrecos();
  const [modulosPermitidos, setModulosPermitidos] = useState(null);
  const [catalogoCarregado, setCatalogoCarregado] = useState(false);
  const [contextoGed, setContextoGed] = useState(null);
  const cliente = useMemo(() => {
    const config = obterConfiguracaoInfraestrutura();
    return config.apiConfigurada
      ? criarClientePrumo({ baseUrl: config.apiUrl, obterContexto: () => obterContextoDesenvolvimento() })
      : null;
  }, [sessao]);

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
        return <Regularidade onAbrirGed={(contexto) => { setContextoGed(contexto); setPaginaAtiva("documentos"); }} />;

      case "orcamento":
        return <Orcamento basesPrecos={basesPrecos} />;

      case "manutencao":
        return <Manutencao />;

      case "documentos":
        return <Documentos contextoInicial={contextoGed} />;

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

  async function sair() {
    await encerrarSessaoLocal(configuracaoAcesso.apiUrl, sessao);
    onSessaoEncerrada();
  }

  return (
    <ContextoPatrimonialProvider key={sessao?.accessToken || "sem-sessao"}>
    <SigiuLayout
      paginaAtiva={paginaAtiva}
      setPaginaAtiva={setPaginaAtiva}
      ultimaAtualizacao={dadosPPCI.ultimaAtualizacao}
      modulosPermitidos={modulosNavegacao}
      sessao={sessao}
      onSair={sair}
    >
      <Suspense fallback={<div className="sigiu-empty">Carregando módulo…</div>}>
        {renderizarPagina()}
      </Suspense>
    </SigiuLayout>
    </ContextoPatrimonialProvider>
  );
}

function App() {
  const configuracaoAcesso = useMemo(() => obterConfiguracaoAcesso(), []);
  const [sessao, setSessao] = useState(() => carregarSessao());

  useEffect(() => {
    if (!sessao?.expiresAt) return undefined;
    const restante = Number(sessao.expiresAt) - Date.now();
    if (restante <= 0) {
      limparSessao();
      setSessao(null);
      return undefined;
    }
    const temporizador = globalThis.setTimeout(() => {
      limparSessao();
      setSessao(null);
    }, restante);
    return () => globalThis.clearTimeout(temporizador);
  }, [sessao]);

  if (configuracaoAcesso.autenticacaoObrigatoria && !sessao) {
    return <Login configuracao={configuracaoAcesso} onEntrar={setSessao} />;
  }

  return (
    <AplicacaoAutenticada
      configuracaoAcesso={configuracaoAcesso}
      sessao={sessao}
      onSessaoEncerrada={() => setSessao(null)}
    />
  );
}

export default App;
