/* =====================================================
   IMPORTS
===================================================== */

import { useState } from "react";

import "./App.css";

/* -----------------------------------------------------
   SERVICES
----------------------------------------------------- */

import { exportarCSV } from "./services/exportCSV";

/* -----------------------------------------------------
   HOOKS
----------------------------------------------------- */

import usePPCI from "./hooks/usePPCI";
import useDashboard from "./hooks/useDashboard";
import useOrdenacao from "./hooks/useOrdenacao";
import usePesquisa from "./hooks/usePesquisa";

import {
  limparFiltros,
  aplicarFiltroRapido
} from "./hooks/useFiltros";

/* -----------------------------------------------------
   UTILS
----------------------------------------------------- */

import {
  formatarData,
  textoOuPadrao,
  obterDiasParaVencer,
  obterClasseVencimento
} from "./utils/ppciUtils";

/* -----------------------------------------------------
   COMPONENTES
  --------------------------------------------------- */

import DashboardExecutivo from "./components/Dashboard/DashboardExecutivo";

import Toolbar from "./components/Toolbar/Toolbar";

import CardsPPCI from "./components/Cards/CardsPPCI";

import ModalPPCI from "./components/Modal/ModalPPCI";

/* -----------------------------------------------------
   ANALISES
  --------------------------------------------------- */
import PainelAnalises from "./components/Analises/PainelAnalises";

/* -----------------------------------------------------
   HEADER
  --------------------------------------------------- */
import Header from "./components/Header";

/* =====================================================
   FIM SEÇÃO IMPORTS
===================================================== */

/* =====================================================
   COMPONENTE PRINCIPAL
===================================================== */

function App() {

/* =====================================================
   HOOK PPCI
===================================================== */

const {

  ppcis,

  loading,

  ultimaAtualizacao,

  carregarDados

} = usePPCI();

console.log(ppcis[0]);

/* =====================================================
   ESTADOS DA INTERFACE
===================================================== */

const [filtro, setFiltro] =
  useState("");

const [filtroSituacao, setFiltroSituacao] =
  useState("");

const [filtroStatus, setFiltroStatus] =
  useState("");

const [filtroCategoria, setFiltroCategoria] =
  useState("");

const [filtroResponsavel, setFiltroResponsavel] = 
  useState("");

const [filtroUnidade, setFiltroUnidade] = 
  useState("");

const [ordenacao, setOrdenacao] =
  useState("prioridade");

const [ppciSelecionado, setPpciSelecionado] =
  useState(null);

const [mostrarAnalise, setMostrarAnalise] =
  useState(false);

const [
  mostrarResponsabilidades,
  setMostrarResponsabilidades
] = useState(false);


/* =====================================================
   DASHBOARD
===================================================== */

const {

  statusOrdenados,

  categoriasOrdenadas,

  responsaveisOrdenados,

  unidadesOrdenadas,

  vencidos,

  criticos,

  regulares,

  semData,

  mediaConclusao,

  maiorStatus,

  maiorSituacao

} = useDashboard(ppcis);

/* =====================================================
   ORDENAÇÃO
===================================================== */

const ppcisOrdenados =
  useOrdenacao(
    ppcis,
    ordenacao
  );

/* =====================================================
   FILTROS
===================================================== */

const ppcisFiltrados = usePesquisa(
    ppcisOrdenados,
    filtro,
    filtroCategoria,
    filtroStatus,
    filtroSituacao,
    filtroResponsavel,
    filtroUnidade
);


/* =====================================================
   INTERFACE
===================================================== */

return (

  <div className="container">

    {/* =====================================================
        HEADER
    ===================================================== */}

<Header

    totalPPCIs={ppcis.length}

    totalFiltrados={ppcisFiltrados.length}

    ultimaAtualizacao={ultimaAtualizacao}

/>

    {/* =====================================================
        PAINÉIS EXECUTIVOS
    ===================================================== */}

{/* =====================================================
   ANÁLISE DA CARTEIRA PPCI
===================================================== */}

<PainelAnalises

    mostrarAnalise={mostrarAnalise}
    setMostrarAnalise={setMostrarAnalise}

    mostrarResponsabilidades={mostrarResponsabilidades}
    setMostrarResponsabilidades={setMostrarResponsabilidades}

    statusOrdenados={statusOrdenados}
    categoriasOrdenadas={categoriasOrdenadas}

    responsaveisOrdenados={responsaveisOrdenados}
    unidadesOrdenadas={unidadesOrdenadas}

    aplicarFiltroRapido={(tipo, valor) =>
    aplicarFiltroRapido(
        tipo,
        valor,
        {
            setFiltroCategoria,
            setFiltroStatus,
            setFiltroResponsavel,
            setFiltroUnidade
        }
    )
}

/>
{/* =====================================================
   DASHBOARD EXECUTIVO.jsx
===================================================== */}

<DashboardExecutivo

    statusOrdenados={statusOrdenados}

    maiorStatus={maiorStatus}

    filtroStatus={filtroStatus}
    setFiltroStatus={setFiltroStatus}

    vencidos={vencidos}
    criticos={criticos}
    regulares={regulares}
    semData={semData}

    maiorSituacao={maiorSituacao}

    filtroSituacao={filtroSituacao}
    setFiltroSituacao={setFiltroSituacao}


    mediaConclusao={mediaConclusao}
/>

{/* =====================================================
   CARDS PPCI
===================================================== */}
<Toolbar
    filtro={filtro}
    setFiltro={setFiltro}

    categorias={categoriasOrdenadas.map(([categoria]) => categoria)}

    filtroCategoria={filtroCategoria}
    setFiltroCategoria={setFiltroCategoria}

    ordenacao={ordenacao}
    setOrdenacao={setOrdenacao}

    onAtualizar={carregarDados}

    onExportar={() => exportarCSV(ppcisFiltrados)}

    onLimpar={() =>
        limparFiltros({
            setFiltro,
            setFiltroStatus,
            setFiltroSituacao,
            setFiltroCategoria,
            setOrdenacao,
            setFiltroResponsavel,
            setFiltroUnidade
        })
    }
/>

{/* =====================================================
   CARDS PPCI
===================================================== */}

<CardsPPCI
    ppcis={ppcisFiltrados}

    setPpciSelecionado={setPpciSelecionado}

    formatarData={formatarData}

    textoOuPadrao={textoOuPadrao}

    obterClasseVencimento={obterClasseVencimento}

    obterDiasParaVencer={obterDiasParaVencer}

    aplicarFiltroRapido={(tipo, valor) =>
        aplicarFiltroRapido(
            tipo,
            valor,
            {
                setFiltroCategoria,
                setFiltroStatus
            }
        )
    }
/>

{/* =====================================================
   MODAL
===================================================== */}

<ModalPPCI
    ppciSelecionado={ppciSelecionado}
    setPpciSelecionado={setPpciSelecionado}
    formatarData={formatarData}
    textoOuPadrao={textoOuPadrao}
/>
  </div>

);

}

/* =====================================================
   EXPORT DEFAULT
===================================================== */

export default App;