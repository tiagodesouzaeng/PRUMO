/* =====================================================
   RELEASE........: v7.4.0 RC1
   ARQUIVO........: src/pages/CentralAlertas.jsx
   DESCRIÇÃO......: Central unificada de alertas SIGIU,
                    inicialmente alimentada pelo módulo PPCI
===================================================== */

import { useMemo, useState } from "react";

import PainelFeedback from "../components/Feedback/PainelFeedback";
import ModalPPCI from "../components/Modal/ModalPPCI";

import useAlertasPPCI from "../hooks/useAlertasPPCI";

import {
  exportarAlertasOperacionaisCSV,
  exportarRankingRiscoOperacionalCSV,
} from "../services/exportAlertasCSV";

import {
  calcularScoreOperacionalPPCI,
  obterAlertasPPCI,
} from "../domain/ppciAlertas";
import { PPCI_CAMPOS } from "../domain/ppciCampos";

import {
  formatarData,
  textoOuPadrao,
} from "../utils/ppciUtils";

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function montarAlertasPPCI(ppcis = []) {
  return ppcis.flatMap((item) => {
    const risco = calcularScoreOperacionalPPCI(item);
    const alertas = obterAlertasPPCI(item);

    return alertas
      .filter((alerta) => alerta.id !== "regular")
      .map((alerta) => ({
        id: `${item?.[PPCI_CAMPOS.ID] || "ppci"}-${alerta.id}`,
        modulo: "PPCI",
        moduloId: "ppci",
        severidade: alerta.nivel,
        tipo: alerta.label,
        descricao: alerta.descricao,
        prazo: alerta.textoPrazo,
        item,
        risco,
      }));
  });
}

function classificarSeveridade(severidade) {
  if (severidade === "critico") return "Crítico";
  if (severidade === "atencao") return "Atenção";
  if (severidade === "regular") return "Regular";
  return "Informativo";
}

function obterClasseSeveridade(severidade) {
  if (severidade === "critico") return "sigiu-alerta-severidade--critico";
  if (severidade === "atencao") return "sigiu-alerta-severidade--atencao";
  if (severidade === "regular") return "sigiu-alerta-severidade--regular";
  return "sigiu-alerta-severidade--neutro";
}

function FiltrarPor({ filtro, setFiltro, contadores }) {
  const opcoes = [
    { id: "todos", label: "Todos", total: contadores.todos },
    { id: "critico", label: "Críticos", total: contadores.critico },
    { id: "atencao", label: "Atenção", total: contadores.atencao },
    { id: "ppci", label: "PPCI", total: contadores.ppci },
  ];

  return (
    <div className="sigiu-alertas-filtros" aria-label="Filtros rápidos da central de alertas">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className={filtro === opcao.id ? "is-active" : ""}
          onClick={() => setFiltro(opcao.id)}
        >
          <span>{opcao.label}</span>
          <strong>{opcao.total}</strong>
        </button>
      ))}
    </div>
  );
}

function AlertaLinha({ alerta, onSelecionar }) {
  const item = alerta.item;
  const titulo = item?.[PPCI_CAMPOS.PREDIO] || item?.[PPCI_CAMPOS.UNIDADE] || "PPCI sem identificação";
  const id = item?.[PPCI_CAMPOS.ID] || "-";
  const responsavel = item?.[PPCI_CAMPOS.RESPONSAVEL] || "—";
  const dataLimite = item?.[PPCI_CAMPOS.DATA_VENCIMENTO];

  return (
    <button type="button" className="sigiu-central-alerta-row" onClick={() => onSelecionar(item)}>
      <span className={`sigiu-alerta-severidade ${obterClasseSeveridade(alerta.severidade)}`}>
        {classificarSeveridade(alerta.severidade)}
      </span>

      <span className="sigiu-central-alerta-row__main">
        <strong>{alerta.tipo}</strong>
        <small>{id} · {titulo}</small>
      </span>

      <span className="sigiu-central-alerta-row__modulo">
        <small>Módulo</small>
        <strong>{alerta.modulo}</strong>
      </span>

      <span className="sigiu-central-alerta-row__prazo">
        <small>Prazo</small>
        <strong>{alerta.prazo || formatarData(dataLimite) || "—"}</strong>
      </span>

      <span className="sigiu-central-alerta-row__responsavel">
        <small>Responsável</small>
        <strong>{responsavel}</strong>
      </span>

      <span className="sigiu-central-alerta-row__score">
        <small>Risco</small>
        <strong>{alerta.risco.score}</strong>
      </span>

      <span className="sigiu-alert-row__chevron">›</span>
    </button>
  );
}

function ModuloFuturoCard({ icone, titulo, descricao, status }) {
  return (
    <div className="sigiu-central-modulo-card">
      <span>{icone}</span>
      <strong>{titulo}</strong>
      <small>{descricao}</small>
      <em>{status}</em>
    </div>
  );
}

export default function CentralAlertas({ dadosPPCI, onAbrirModulo }) {
  const [filtro, setFiltro] = useState("todos");
  const [ppciSelecionado, setPpciSelecionado] = useState(null);

  const { ppcis, loading, erro, carregarDados } = dadosPPCI;
  const resumoPPCI = useAlertasPPCI(ppcis);

  const alertas = useMemo(() => montarAlertasPPCI(ppcis), [ppcis]);

  const contadores = useMemo(() => ({
    todos: alertas.length,
    critico: alertas.filter((alerta) => alerta.severidade === "critico").length,
    atencao: alertas.filter((alerta) => alerta.severidade === "atencao").length,
    ppci: alertas.filter((alerta) => alerta.moduloId === "ppci").length,
  }), [alertas]);

  const alertasFiltrados = useMemo(() => {
    if (filtro === "todos") return alertas;
    if (filtro === "ppci") return alertas.filter((alerta) => alerta.moduloId === "ppci");
    return alertas.filter((alerta) => alerta.severidade === filtro);
  }, [alertas, filtro]);

  const buscaContexto = normalizarTexto(filtro);
  const deveExibirConteudo = !loading && !erro && ppcis.length > 0;

  return (
    <section className="sigiu-page sigiu-page-central-alertas">
      <div className="sigiu-page-heading">
        <div>
          <span className="sigiu-page-eyebrow">Central PRUMO</span>
          <h1>Central de Alertas</h1>
          <p>
            Visão única de pendências críticas, atenção operacional e riscos por módulo. Nesta versão, a central está alimentada pelo PPCI e preparada para Hídrico, Obras e Manutenção.
          </p>
        </div>
        <div className="sigiu-page-heading__meta sigiu-page-heading__meta--alertas">
          <strong>{contadores.todos}</strong>
          <span>alertas ativos</span>
        </div>
      </div>

      <PainelFeedback
        loading={loading}
        erro={erro}
        total={ppcis.length}
        onTentarNovamente={carregarDados}
      />

      {deveExibirConteudo && (
        <>
          <div className="sigiu-central-alertas-resumo">
            <div className="sigiu-central-alertas-kpi sigiu-central-alertas-kpi--critico">
              <span>Críticos</span>
              <strong>{contadores.critico}</strong>
              <small>vencidos, críticos ou sem responsável</small>
            </div>
            <div className="sigiu-central-alertas-kpi sigiu-central-alertas-kpi--atencao">
              <span>Atenção</span>
              <strong>{contadores.atencao}</strong>
              <small>prazos intermediários ou sem data</small>
            </div>
            <div className="sigiu-central-alertas-kpi sigiu-central-alertas-kpi--ppci">
              <span>PPCI</span>
              <strong>{resumoPPCI.totalPPCIs}</strong>
              <small>registros monitorados</small>
            </div>
          </div>

          <section className="sigiu-card sigiu-central-alertas-card">
            <header className="sigiu-card-header-row sigiu-central-alertas-header">
              <div>
                <h2>Alertas consolidados</h2>
                <p>Use filtros simples. Os filtros operacionais detalhados permanecem dentro de cada módulo.</p>
              </div>

              <div className="sigiu-central-alertas-actions">
                <button type="button" className="sigiu-btn sigiu-btn--outline" onClick={() => exportarAlertasOperacionaisCSV(ppcis)}>
                  CSV alertas
                </button>
                <button type="button" className="sigiu-btn sigiu-btn--primary" onClick={() => exportarRankingRiscoOperacionalCSV(ppcis)}>
                  CSV risco
                </button>
              </div>
            </header>

            <FiltrarPor filtro={filtro} setFiltro={setFiltro} contadores={contadores} />

            <div className="sigiu-central-alertas-contexto">
              <span>Filtro ativo: <strong>{filtro === "todos" ? "Todos" : buscaContexto}</strong></span>
              <span>{alertasFiltrados.length} alerta(s) exibido(s)</span>
            </div>

            <div className="sigiu-central-alertas-lista">
              {alertasFiltrados.length ? (
                alertasFiltrados
                  .slice()
                  .sort((a, b) => b.risco.score - a.risco.score)
                  .map((alerta) => (
                    <AlertaLinha
                      key={alerta.id}
                      alerta={alerta}
                      onSelecionar={setPpciSelecionado}
                    />
                  ))
              ) : (
                <div className="sigiu-empty-inline">Nenhum alerta encontrado para este recorte.</div>
              )}
            </div>
          </section>

          <section className="sigiu-central-modulos sigiu-card">
            <header className="sigiu-card-header-row">
              <div>
                <h2>Fontes de alerta planejadas</h2>
                <p>Estrutura preparada para expansão do PRUMO.</p>
              </div>
            </header>

            <div className="sigiu-central-modulos-grid">
              <button type="button" className="sigiu-central-modulo-card is-active" onClick={() => onAbrirModulo("ppci")}>
                <span>🛡</span>
                <strong>PPCI</strong>
                <small>Alertas de prazo, risco, responsável e saúde da base.</small>
                <em>Operacional</em>
              </button>
              <ModuloFuturoCard icone="💧" titulo="Consumo Hídrico" descricao="Anomalias de consumo, leituras ausentes e tendências." status="Preparado" />
              <ModuloFuturoCard icone="🏗" titulo="Obras" descricao="Prazos, medições, atrasos e marcos críticos." status="Preparado" />
              <ModuloFuturoCard icone="🛠" titulo="Manutenção" descricao="OS críticas, preventivas vencidas e recorrência." status="Preparado" />
            </div>
          </section>

          <ModalPPCI
            ppciSelecionado={ppciSelecionado}
            setPpciSelecionado={setPpciSelecionado}
            formatarData={formatarData}
            textoOuPadrao={textoOuPadrao}
          />
        </>
      )}
    </section>
  );
}
