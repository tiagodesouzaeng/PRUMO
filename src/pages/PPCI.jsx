/* =====================================================
   RELEASE........: v7.4.2 RC1
   ARQUIVO........: src/pages/PPCI.jsx
   DESCRIÇÃO......: Compactação operacional da aba Listagem PPCI.
                    Busca, ordenação, filtros e preferências passam
                    a ficar agrupados dentro do bloco PPCIs Monitorados.
===================================================== */

import { useState } from "react";

import { exportarCSV } from "../services/exportCSV";
import {
  exportarAlertasFiltradosCSV,
  exportarAlertasOperacionaisCSV,
  exportarRankingRiscoOperacionalCSV,
} from "../services/exportAlertasCSV";

import { PPCI_SITUACOES } from "../domain/ppciCampos";
import { PPCI_ALERTAS_LISTA } from "../domain/ppciAlertas";

import useFiltrosPainel from "../hooks/useFiltrosPainel";
import usePainelInterface from "../hooks/usePainelInterface";
import usePainelPPCIDados from "../hooks/usePainelPPCIDados";
import useQualidadeDados from "../hooks/useQualidadeDados";
import useAlertasPPCI from "../hooks/useAlertasPPCI";

import {
  formatarData,
  textoOuPadrao,
  obterDiasParaVencer,
  obterClasseVencimento,
} from "../utils/ppciUtils";

import PainelFeedback from "../components/Feedback/PainelFeedback";
import DashboardExecutivo from "../components/Dashboard/DashboardExecutivo";
import PainelAnalises from "../components/Analises/PainelAnalises";
import FiltrosAtivos from "../components/FiltrosAtivos";
import PreferenciasPainel from "../components/Preferencias";
import QualidadeDados from "../components/QualidadeDados";
import AlertasOperacionais from "../components/Alertas";
import CardsPPCI from "../components/Cards/CardsPPCI";
import ModalPPCI from "../components/Modal/ModalPPCI";

const PPCI_ABAS = Object.freeze([
  {
    id: "resumo",
    label: "Resumo",
    descricao: "Situação geral e conclusão média",
  },
  {
    id: "alertas",
    label: "Alertas",
    descricao: "Prazos e risco operacional",
  },
  {
    id: "carteira",
    label: "Carteira",
    descricao: "Status, categorias e responsabilidades",
  },
  {
    id: "saude-base",
    label: "Saúde da Base",
    descricao: "Qualidade dos dados PPCI",
  },
  {
    id: "listagem",
    label: "Listagem",
    descricao: "Cards, lista e filtros operacionais",
  },
  {
    id: "relatorios",
    label: "Relatórios",
    descricao: "Exportações e recortes CSV",
  },
]);

const SITUACOES_FILTRO_PPCI = Object.freeze([
  { id: PPCI_SITUACOES.VENCIDOS, label: "Vencidos" },
  { id: PPCI_SITUACOES.CRITICOS, label: "Críticos" },
  { id: PPCI_SITUACOES.REGULARES, label: "Regulares" },
  { id: PPCI_SITUACOES.SEM_DATA, label: "Sem data" },
]);

function contarFiltrosOperacionaisAtivos({
  filtro,
  filtroSituacao,
  filtroStatus,
  filtroCategoria,
  filtroResponsavel,
  filtroUnidade,
  filtroQualidade,
  filtroAlerta,
}) {
  return [
    filtro,
    filtroSituacao,
    filtroStatus,
    filtroCategoria,
    filtroResponsavel,
    filtroUnidade,
    filtroQualidade,
    filtroAlerta,
  ].filter(Boolean).length;
}

const OPCOES_ORDENACAO_PPCI = Object.freeze([
  { id: "risco_operacional", label: "Risco operacional" },
  { id: "prioridade", label: "Prioridade" },
  { id: "vencimento", label: "Vencimento" },
  { id: "predio", label: "Prédio" },
  { id: "responsavel", label: "Responsável" },
]);

function renderizarOpcoesFiltro(opcoes = []) {
  return opcoes.map(([label, quantidade]) => (
    <option key={label} value={label}>
      {label} ({quantidade})
    </option>
  ));
}

function ListagemControlesPPCI({
  filtro,
  setFiltro,
  filtroSituacao,
  setFiltroSituacao,
  filtroStatus,
  setFiltroStatus,
  filtroCategoria,
  setFiltroCategoria,
  filtroResponsavel,
  setFiltroResponsavel,
  filtroUnidade,
  setFiltroUnidade,
  filtroQualidade,
  setFiltroQualidade,
  filtroAlerta,
  setFiltroAlerta,
  ordenacao,
  setOrdenacao,
  statusOrdenados,
  categoriasOrdenadas,
  responsaveisOrdenados,
  unidadesOrdenadas,
  totalFiltrado,
  totalGeral,
  onLimpar,
  onAtualizar,
}) {
  const totalFiltrosAtivos = contarFiltrosOperacionaisAtivos({
    filtro,
    filtroSituacao,
    filtroStatus,
    filtroCategoria,
    filtroResponsavel,
    filtroUnidade,
    filtroQualidade,
    filtroAlerta,
  });

  return (
    <div className="sigiu-listagem-controles">
      <div className="sigiu-listagem-controles__principal">
        <label className="sigiu-campo sigiu-listagem-busca">
          <span>Buscar PPCI</span>
          <input
            type="search"
            placeholder="Pesquisar por prédio, unidade, responsável ou processo..."
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value)}
          />
        </label>

        <label className="sigiu-campo sigiu-listagem-ordenacao">
          <span>Ordenar por</span>
          <select
            value={ordenacao}
            onChange={(evento) => setOrdenacao(evento.target.value)}
          >
            {OPCOES_ORDENACAO_PPCI.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.label}
              </option>
            ))}
          </select>
        </label>

        <div className="sigiu-listagem-acoes">
          {totalFiltrosAtivos > 0 && (
            <button
              type="button"
              className="sigiu-btn sigiu-btn--outline"
              onClick={onLimpar}
            >
              Limpar filtros
            </button>
          )}

          <button
            type="button"
            className="sigiu-btn sigiu-btn--secondary"
            onClick={onAtualizar}
          >
            Atualizar
          </button>
        </div>
      </div>

      <details
        className="sigiu-listagem-filtros-detalhados"
        open={totalFiltrosAtivos > 0}
      >
        <summary>
          <span>Filtros operacionais</span>
          <strong>{totalFiltrado} de {totalGeral} PPCIs</strong>
          {totalFiltrosAtivos > 0 && <em>{totalFiltrosAtivos} ativo(s)</em>}
        </summary>

        <div className="sigiu-ppci-filtros-grid sigiu-ppci-filtros-grid--compacto">
          <label className="sigiu-campo">
            <span>Unidade</span>
            <select
              value={filtroUnidade}
              onChange={(evento) => setFiltroUnidade(evento.target.value)}
            >
              <option value="">Todas</option>
              {renderizarOpcoesFiltro(unidadesOrdenadas)}
            </select>
          </label>

          <label className="sigiu-campo">
            <span>Status</span>
            <select
              value={filtroStatus}
              onChange={(evento) => setFiltroStatus(evento.target.value)}
            >
              <option value="">Todos</option>
              {renderizarOpcoesFiltro(statusOrdenados)}
            </select>
          </label>

          <label className="sigiu-campo">
            <span>Responsável</span>
            <select
              value={filtroResponsavel}
              onChange={(evento) => setFiltroResponsavel(evento.target.value)}
            >
              <option value="">Todos</option>
              {renderizarOpcoesFiltro(responsaveisOrdenados)}
            </select>
          </label>

          <label className="sigiu-campo">
            <span>Categoria</span>
            <select
              value={filtroCategoria}
              onChange={(evento) => setFiltroCategoria(evento.target.value)}
            >
              <option value="">Todas</option>
              {renderizarOpcoesFiltro(categoriasOrdenadas)}
            </select>
          </label>

          <label className="sigiu-campo">
            <span>Situação</span>
            <select
              value={filtroSituacao}
              onChange={(evento) => setFiltroSituacao(evento.target.value)}
            >
              <option value="">Todas</option>
              {SITUACOES_FILTRO_PPCI.map((situacao) => (
                <option key={situacao.id} value={situacao.id}>
                  {situacao.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sigiu-campo">
            <span>Alerta</span>
            <select
              value={filtroAlerta?.id || ""}
              onChange={(evento) => setFiltroAlerta(evento.target.value || null)}
            >
              <option value="">Todos</option>
              {PPCI_ALERTAS_LISTA.map((alerta) => (
                <option key={alerta.id} value={alerta.id}>
                  {alerta.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <FiltrosAtivos
        filtro={filtro}
        filtroStatus={filtroStatus}
        filtroSituacao={filtroSituacao}
        filtroCategoria={filtroCategoria}
        filtroResponsavel={filtroResponsavel}
        filtroUnidade={filtroUnidade}
        filtroQualidade={filtroQualidade}
        filtroAlerta={filtroAlerta}
        setFiltro={setFiltro}
        setFiltroStatus={setFiltroStatus}
        setFiltroSituacao={setFiltroSituacao}
        setFiltroCategoria={setFiltroCategoria}
        setFiltroResponsavel={setFiltroResponsavel}
        setFiltroUnidade={setFiltroUnidade}
        setFiltroQualidade={setFiltroQualidade}
        setFiltroAlerta={setFiltroAlerta}
        onLimpar={onLimpar}
      />
    </div>
  );
}

function PreferenciasCompactas({
  haVisaoSalva,
  dataVisaoSalva,
  onSalvarVisao,
  onRestaurarVisao,
  onLimparPreferencias,
}) {
  return (
    <details className="sigiu-preferencias-compactas">
      <summary>
        <span>Preferências de visualização</span>
        <strong>{haVisaoSalva ? "Visão salva disponível" : "Nenhuma visão salva"}</strong>
      </summary>

      <PreferenciasPainel
        haVisaoSalva={haVisaoSalva}
        dataVisaoSalva={dataVisaoSalva}
        onSalvarVisao={onSalvarVisao}
        onRestaurarVisao={onRestaurarVisao}
        onLimparPreferencias={onLimparPreferencias}
      />
    </details>
  );
}

function obterDescricaoOrdenacao(ordenacao) {
  const mapa = {
    prioridade: "Prioridade manual",
    vencimento: "Data de vencimento",
    predio: "Prédio / Edificação",
    responsavel: "Responsável",
    risco: "Risco operacional",
    risco_operacional: "Risco operacional",
  };

  return mapa[ordenacao] || ordenacao || "Prioridade manual";
}

function AbaButton({ aba, ativa, contador, onClick }) {
  return (
    <button
      type="button"
      className={`sigiu-ppci-tab ${ativa ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={ativa}
    >
      <span>{aba.label}</span>
      {contador !== null && contador !== undefined && (
        <strong>{contador}</strong>
      )}
      <small>{aba.descricao}</small>
    </button>
  );
}

function RelatoriosPPCI({
  totalGeral,
  totalFiltrado,
  filtroAlerta,
  ordenacao,
  onExportarLista,
  onExportarAlertas,
  onExportarFiltro,
  onExportarRisco,
}) {
  return (
    <section className="sigiu-card sigiu-ppci-relatorios">
      <header className="sigiu-card-header-row">
        <div>
          <h2>Relatórios PPCI</h2>
          <p>Exportações operacionais a partir da visão atual do módulo.</p>
        </div>
      </header>

      <div className="sigiu-relatorios-grid">
        <button type="button" className="sigiu-relatorio-card" onClick={onExportarLista}>
          <span>CSV</span>
          <strong>Listagem atual</strong>
          <small>{totalFiltrado} de {totalGeral} PPCIs conforme filtros aplicados.</small>
        </button>

        <button type="button" className="sigiu-relatorio-card" onClick={onExportarAlertas}>
          <span>CSV</span>
          <strong>Alertas operacionais</strong>
          <small>PPCIs com alerta de prazo, responsável ou data limite.</small>
        </button>

        <button type="button" className="sigiu-relatorio-card" onClick={onExportarRisco}>
          <span>CSV</span>
          <strong>Ranking de risco</strong>
          <small>Ordenado por score operacional e criticidade.</small>
        </button>

        <button
          type="button"
          className={`sigiu-relatorio-card ${!filtroAlerta ? "is-disabled" : ""}`}
          onClick={filtroAlerta ? onExportarFiltro : undefined}
          disabled={!filtroAlerta}
        >
          <span>CSV</span>
          <strong>Alerta filtrado</strong>
          <small>
            {filtroAlerta
              ? `Recorte ativo: ${filtroAlerta.label}.`
              : "Disponível após aplicar filtro de alerta."}
          </small>
        </button>
      </div>

      <div className="sigiu-relatorios-contexto">
        <span>Ordenação atual: <strong>{obterDescricaoOrdenacao(ordenacao)}</strong></span>
        <span>Registros visíveis: <strong>{totalFiltrado}</strong></span>
      </div>
    </section>
  );
}

export default function PPCI({ dadosPPCI, integrado = false }) {
  const [abaAtual, setAbaAtual] = useState("resumo");

  const {
    ppcis,
    loading,
    erro,
    carregarDados,
  } = dadosPPCI;

  const filtrosPainel = useFiltrosPainel();

  const {
    filtro,
    setFiltro,
    filtroSituacao,
    setFiltroSituacao,
    filtroStatus,
    setFiltroStatus,
    filtroCategoria,
    setFiltroCategoria,
    filtroResponsavel,
    setFiltroResponsavel,
    filtroUnidade,
    setFiltroUnidade,
    filtroQualidade,
    setFiltroQualidade,
    filtroAlerta,
    setFiltroAlerta,
    ordenacao,
    setOrdenacao,
    aplicarFiltro,
    limparTodosFiltros,
    salvarVisaoAtual,
    restaurarVisaoSalva,
    limparPreferenciasLocais,
    preferenciasVersao,
    haVisaoSalva,
    dataVisaoSalva,
  } = filtrosPainel;

  const {
    ppciSelecionado,
    setPpciSelecionado,
    mostrarAnalise,
    setMostrarAnalise,
    mostrarResponsabilidades,
    setMostrarResponsabilidades,
  } = usePainelInterface();

  const { ppcisFiltrados, dashboard } = usePainelPPCIDados(
    ppcis,
    filtrosPainel
  );

  const qualidadeDados = useQualidadeDados(ppcis);
  const alertasPPCI = useAlertasPPCI(ppcis);

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
    maiorSituacao,
  } = dashboard;

  const deveExibirConteudo = !loading && !erro && ppcis.length > 0;

  function filtrarAlerta(alerta) {
    setFiltroAlerta(alerta);
    setAbaAtual("listagem");
  }

  function filtrarPendenciaQualidade(pendencia) {
    setFiltroQualidade(pendencia);
    setAbaAtual("listagem");
  }

  const contadoresAbas = {
    resumo: ppcis.length,
    alertas: alertasPPCI.totalCriticos + alertasPPCI.totalAtencao,
    carteira: statusOrdenados.length + categoriasOrdenadas.length,
    "saude-base": qualidadeDados?.totalPendencias || 0,
    listagem: ppcisFiltrados.length,
    relatorios: null,
  };

  return (
    <section className="sigiu-page sigiu-page-ppci sigiu-page-ppci-tabs">
      {!integrado && <div className="sigiu-page-heading">
        <div>
          <span className="sigiu-page-eyebrow">Módulo operacional</span>
          <h1>PPCI</h1>
          <p>
            Gestão de PPCIs organizada por resumo, alertas, carteira, saúde da base, listagem e relatórios.
          </p>
        </div>
        <div className="sigiu-page-heading__meta">
          <strong>{ppcis.length}</strong>
          <span>PPCIs cadastrados</span>
        </div>
      </div>}

      <PainelFeedback
        loading={loading}
        erro={erro}
        total={ppcis.length}
        onTentarNovamente={carregarDados}
      />

      {deveExibirConteudo && (
        <>
          <nav className="sigiu-ppci-tabs" aria-label="Seções do módulo PPCI">
            {PPCI_ABAS.map((aba) => (
              <AbaButton
                key={aba.id}
                aba={aba}
                ativa={abaAtual === aba.id}
                contador={contadoresAbas[aba.id]}
                onClick={() => setAbaAtual(aba.id)}
              />
            ))}
          </nav>

          <div className="sigiu-ppci-tab-panel">
            {abaAtual === "resumo" && (
              <div className="sigiu-ppci-tab-stack">
                <DashboardExecutivo
                  vencidos={vencidos}
                  criticos={criticos}
                  regulares={regulares}
                  semData={semData}
                  maiorSituacao={maiorSituacao}
                  filtroSituacao={filtroSituacao}
                  setFiltroSituacao={(valor) => {
                    setFiltroSituacao(valor);
                    setAbaAtual("listagem");
                  }}
                  mediaConclusao={mediaConclusao}
                />

                <section className="sigiu-card sigiu-ppci-resumo-atalhos">
                  <header className="sigiu-card-header-row">
                    <div>
                      <h2>Atalhos operacionais</h2>
                      <p>Abra apenas a seção necessária para reduzir a poluição visual.</p>
                    </div>
                  </header>

                  <div className="sigiu-atalhos-grid">
                    <button type="button" onClick={() => setAbaAtual("alertas")}>
                      <span>⚠</span>
                      <strong>Alertas</strong>
                      <small>{alertasPPCI.totalCriticos + alertasPPCI.totalAtencao} pendências operacionais</small>
                    </button>
                    <button type="button" onClick={() => setAbaAtual("carteira")}>
                      <span>▦</span>
                      <strong>Carteira</strong>
                      <small>Status, categorias, responsáveis e unidades</small>
                    </button>
                    <button type="button" onClick={() => setAbaAtual("saude-base")}>
                      <span>✓</span>
                      <strong>Saúde da Base</strong>
                      <small>{qualidadeDados?.totalPendencias || 0} pendências de qualidade</small>
                    </button>
                    <button type="button" onClick={() => setAbaAtual("listagem")}>
                      <span>☰</span>
                      <strong>Listagem</strong>
                      <small>{ppcisFiltrados.length} PPCIs visíveis</small>
                    </button>
                  </div>
                </section>
              </div>
            )}

            {abaAtual === "alertas" && (
              <AlertasOperacionais
                alertas={alertasPPCI}
                filtroAlerta={filtroAlerta}
                onFiltrarAlerta={filtrarAlerta}
                onExportarAlertas={() => exportarAlertasOperacionaisCSV(ppcis)}
                onExportarFiltro={() => exportarAlertasFiltradosCSV(ppcis, filtroAlerta)}
                onExportarRisco={() => exportarRankingRiscoOperacionalCSV(ppcis)}
              />
            )}

            {abaAtual === "carteira" && (
              <PainelAnalises
                mostrarAnalise={mostrarAnalise}
                setMostrarAnalise={setMostrarAnalise}
                mostrarResponsabilidades={mostrarResponsabilidades}
                setMostrarResponsabilidades={setMostrarResponsabilidades}
                statusOrdenados={statusOrdenados}
                categoriasOrdenadas={categoriasOrdenadas}
                responsaveisOrdenados={responsaveisOrdenados}
                unidadesOrdenadas={unidadesOrdenadas}
                filtroStatus={filtroStatus}
                filtroCategoria={filtroCategoria}
                filtroResponsavel={filtroResponsavel}
                filtroUnidade={filtroUnidade}
                aplicarFiltroRapido={(tipo, valor) => {
                  aplicarFiltro(tipo, valor);
                  setAbaAtual("listagem");
                }}
              />
            )}

            {abaAtual === "saude-base" && (
              <QualidadeDados
                qualidade={qualidadeDados}
                filtroQualidade={filtroQualidade}
                onFiltrarPendencia={filtrarPendenciaQualidade}
                onSelecionarPPCI={setPpciSelecionado}
              />
            )}

            {abaAtual === "listagem" && (
              <CardsPPCI
                ppcis={ppcisFiltrados}
                totalGeral={ppcis.length}
                ordenacao={ordenacao}
                filtrosAtivos={{
                  busca: filtro,
                  status: filtroStatus,
                  situacao: filtroSituacao,
                  categoria: filtroCategoria,
                  responsavel: filtroResponsavel,
                  unidade: filtroUnidade,
                  qualidade: filtroQualidade,
                  alerta: filtroAlerta,
                }}
                acoesFiltros={{
                  setFiltro,
                  setFiltroStatus,
                  setFiltroSituacao,
                  setFiltroCategoria,
                  setFiltroResponsavel,
                  setFiltroUnidade,
                  setFiltroQualidade,
                  setFiltroAlerta,
                  onLimpar: limparTodosFiltros,
                }}
                controlesListagem={(
                  <ListagemControlesPPCI
                    filtro={filtro}
                    setFiltro={setFiltro}
                    filtroSituacao={filtroSituacao}
                    setFiltroSituacao={setFiltroSituacao}
                    filtroStatus={filtroStatus}
                    setFiltroStatus={setFiltroStatus}
                    filtroCategoria={filtroCategoria}
                    setFiltroCategoria={setFiltroCategoria}
                    filtroResponsavel={filtroResponsavel}
                    setFiltroResponsavel={setFiltroResponsavel}
                    filtroUnidade={filtroUnidade}
                    setFiltroUnidade={setFiltroUnidade}
                    filtroQualidade={filtroQualidade}
                    setFiltroQualidade={setFiltroQualidade}
                    filtroAlerta={filtroAlerta}
                    setFiltroAlerta={setFiltroAlerta}
                    ordenacao={ordenacao}
                    setOrdenacao={setOrdenacao}
                    statusOrdenados={statusOrdenados}
                    categoriasOrdenadas={categoriasOrdenadas}
                    responsaveisOrdenados={responsaveisOrdenados}
                    unidadesOrdenadas={unidadesOrdenadas}
                    totalFiltrado={ppcisFiltrados.length}
                    totalGeral={ppcis.length}
                    onLimpar={limparTodosFiltros}
                    onAtualizar={carregarDados}
                  />
                )}
                preferenciasListagem={(
                  <PreferenciasCompactas
                    haVisaoSalva={haVisaoSalva}
                    dataVisaoSalva={dataVisaoSalva}
                    onSalvarVisao={salvarVisaoAtual}
                    onRestaurarVisao={restaurarVisaoSalva}
                    onLimparPreferencias={limparPreferenciasLocais}
                  />
                )}
                setPpciSelecionado={setPpciSelecionado}
                formatarData={formatarData}
                textoOuPadrao={textoOuPadrao}
                obterClasseVencimento={obterClasseVencimento}
                obterDiasParaVencer={obterDiasParaVencer}
                aplicarFiltroRapido={aplicarFiltro}
                preferenciasVersao={preferenciasVersao}
              />
            )}

            {abaAtual === "relatorios" && (
              <RelatoriosPPCI
                totalGeral={ppcis.length}
                totalFiltrado={ppcisFiltrados.length}
                filtroAlerta={filtroAlerta}
                ordenacao={ordenacao}
                onExportarLista={() => exportarCSV(ppcisFiltrados)}
                onExportarAlertas={() => exportarAlertasOperacionaisCSV(ppcis)}
                onExportarFiltro={() => exportarAlertasFiltradosCSV(ppcis, filtroAlerta)}
                onExportarRisco={() => exportarRankingRiscoOperacionalCSV(ppcis)}
              />
            )}
          </div>

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
