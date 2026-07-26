/* =====================================================
   RELEASE........: v5.7.0 RC1
   ARQUIVO........: src/components/QualidadeDados/QualidadeDados.jsx
   DESCRIÇÃO......: Seção recolhível de saúde da base de dados PPCI
                    com ranking, evolução, checklist, exportação
                    gerencial e filtro operacional por pendência
===================================================== */

import React, { useEffect, useMemo, useState } from "react";
import {
  exportarQualidadeCSV,
  exportarQualidadeGerencialCSV,
} from "../../services/exportQualidadeCSV";
import { SIGIU_STORAGE_KEYS } from "../../config/sigiuConfig";

const LIMITE_HISTORICO = 30;

function obterDataHoje() {
  return new Date().toISOString().slice(0, 10);
}

function lerHistoricoLocal() {
  if (typeof window === "undefined") return [];

  try {
    const bruto = window.localStorage.getItem(SIGIU_STORAGE_KEYS.QUALIDADE_HISTORICO);
    const dados = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.warn("Não foi possível ler o histórico de qualidade.", erro);
    return [];
  }
}

function salvarHistoricoLocal(historico) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      SIGIU_STORAGE_KEYS.QUALIDADE_HISTORICO,
      JSON.stringify(historico)
    );
  } catch (erro) {
    console.warn("Não foi possível salvar o histórico de qualidade.", erro);
  }
}

function montarHistoricoAtualizado(qualidade) {
  const hoje = obterDataHoje();
  const historicoAnterior = lerHistoricoLocal();
  const snapshot = {
    data: hoje,
    percentualPreenchimento: qualidade.percentualPreenchimento,
    totalPendencias: qualidade.totalPendencias,
    registrosComPendencia: qualidade.registrosComPendencia,
    total: qualidade.total,
  };

  const semHoje = historicoAnterior.filter((item) => item.data !== hoje);
  return [...semHoje, snapshot].slice(-LIMITE_HISTORICO);
}

function formatarVariacao(valor) {
  if (valor === 0) return "sem variação";
  return `${valor > 0 ? "+" : ""}${valor} p.p.`;
}

function TabelaRanking({ titulo, subtitulo, itens = [] }) {
  if (!itens.length) return null;

  return (
    <article className="qualidade-ranking-card">
      <div className="qualidade-ranking-cabecalho">
        <strong>{titulo}</strong>
        <span>{subtitulo}</span>
      </div>

      <div className="qualidade-ranking-lista">
        {itens.map((item, index) => (
          <div className="qualidade-ranking-linha" key={`${titulo}-${item.nome}-${index}`}>
            <span className="qualidade-ranking-posicao">{index + 1}</span>
            <span className="qualidade-ranking-nome" title={item.nome}>{item.nome}</span>
            <span>{item.registrosComPendencia}/{item.total}</span>
            <span>{item.totalPendencias} pend.</span>
            <strong>{item.percentualSaude}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function EvolucaoQualidade({ historico = [] }) {
  const ultimo = historico[historico.length - 1];
  const anterior = historico[historico.length - 2];

  if (!ultimo) return null;

  const variacao = anterior
    ? ultimo.percentualPreenchimento - anterior.percentualPreenchimento
    : 0;

  return (
    <div className="qualidade-evolucao">
      <div className="qualidade-subtitulo-bloco">
        <strong>Evolução da qualidade</strong>
        <span>Histórico local dos últimos fechamentos carregados neste navegador.</span>
      </div>

      <div className="qualidade-evolucao-grid">
        <article className="qualidade-evolucao-card">
          <span>Último registro</span>
          <strong>{ultimo.percentualPreenchimento}%</strong>
          <small>{ultimo.data}</small>
        </article>

        <article className="qualidade-evolucao-card">
          <span>Variação</span>
          <strong className={variacao >= 0 ? "qualidade-variacao-ok" : "qualidade-variacao-queda"}>
            {formatarVariacao(variacao)}
          </strong>
          <small>{anterior ? `comparado a ${anterior.data}` : "baseline inicial"}</small>
        </article>

        <article className="qualidade-evolucao-card">
          <span>Pendências atuais</span>
          <strong>{ultimo.totalPendencias}</strong>
          <small>{ultimo.registrosComPendencia} PPCIs com pendência</small>
        </article>
      </div>
    </div>
  );
}

function ChecklistSaneamento({ itens = [], onFiltrarPendencia }) {
  if (!itens.length) return null;

  return (
    <div className="qualidade-checklist">
      <div className="qualidade-subtitulo-bloco">
        <strong>Checklist de saneamento</strong>
        <span>Prioridade operacional sugerida para correção da base.</span>
      </div>

      <div className="qualidade-checklist-lista">
        {itens.map((item, index) => (
          <article className={`qualidade-checkitem qualidade-checkitem-${item.nivel}`} key={item.id}>
            <span className="qualidade-checkitem-posicao">{index + 1}</span>

            <div className="qualidade-checkitem-conteudo">
              <strong>{item.label}</strong>
              <span>{item.acao}</span>
              <small>{item.campo}</small>
            </div>

            <div className="qualidade-checkitem-meta">
              <strong>{item.quantidade}</strong>
              <span>{item.prioridade}</span>
            </div>

            <button
              type="button"
              className="qualidade-botao qualidade-botao-secundario"
              onClick={() => onFiltrarPendencia?.({
                id: item.id,
                label: item.label,
                campo: item.campo,
                nivel: item.nivel,
                descricao: item.descricao,
              })}
            >
              Filtrar
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function QualidadeDados({
  qualidade,
  filtroQualidade,
  onFiltrarPendencia,
  onSelecionarPPCI,
}) {
  const [mostrar, setMostrar] = useState(false);
  const [historicoQualidade, setHistoricoQualidade] = useState([]);

  useEffect(() => {
    if (!qualidade || !qualidade.total) return;

    const atualizado = montarHistoricoAtualizado(qualidade);
    salvarHistoricoLocal(atualizado);
    setHistoricoQualidade(atualizado);
  }, [
    qualidade?.total,
    qualidade?.percentualPreenchimento,
    qualidade?.totalPendencias,
    qualidade?.registrosComPendencia,
  ]);

  const historicoOrdenado = useMemo(
    () => [...historicoQualidade].sort((a, b) => a.data.localeCompare(b.data)),
    [historicoQualidade]
  );

  if (!qualidade || !qualidade.total) return null;

  const {
    percentualPreenchimento,
    camposAvaliados,
    totalPendencias,
    pendenciasCriticas,
    pendenciasAtencao,
    registrosComPendencia,
    registrosCompletos,
    total,
    itens,
    registrosPendentes = [],
    rankingUnidades = [],
    rankingResponsaveis = [],
    checklistSaneamento = [],
    resumoChecklist = { alta: 0, media: 0, total: 0 },
  } = qualidade;

  const classeSaude =
    percentualPreenchimento >= 90
      ? "qualidade-ok"
      : percentualPreenchimento >= 75
        ? "qualidade-atencao"
        : "qualidade-critico";

  const itensComPendencia = itens.filter((item) => item.quantidade > 0);
  const podeExportar = registrosPendentes.length > 0;
  const filtroAtivoId = filtroQualidade?.id ?? null;

  const abrirPPCI = (item) => {
    if (typeof onSelecionarPPCI === "function" && item) {
      onSelecionarPPCI(item);
    }
  };

  const alternarFiltroPendencia = (item) => {
    if (typeof onFiltrarPendencia !== "function") return;

    if (filtroAtivoId === item.id) {
      onFiltrarPendencia(null);
      return;
    }

    onFiltrarPendencia({
      id: item.id,
      label: item.label,
      campo: item.campo,
      nivel: item.nivel,
      descricao: item.descricao,
    });
  };

  return (
    <section className="qualidade-dados secao-painel">
      <div className="qualidade-cabecalho">
        <h3
          className="secao-titulo titulo-expansivel"
          onClick={() => setMostrar(!mostrar)}
        >
          <span className="icone-expansivel">
            {mostrar ? "▼" : "▶"}
          </span>

          <span>SAÚDE DA BASE DE DADOS</span>
        </h3>

        {mostrar && podeExportar && (
          <div className="qualidade-acoes-topo">
            <button
              type="button"
              className="qualidade-botao qualidade-botao-principal"
              onClick={() => exportarQualidadeCSV(registrosPendentes, "geral")}
            >
              Exportar pendências CSV
            </button>

            <button
              type="button"
              className="qualidade-botao qualidade-botao-principal"
              onClick={() => exportarQualidadeGerencialCSV(qualidade)}
            >
              Exportar gerencial CSV
            </button>
          </div>
        )}
      </div>

      {mostrar && (
        <div className="qualidade-conteudo">
          <p className="qualidade-intro">
            Conferência automática de campos críticos e operacionais da base PPCI.
          </p>

          {filtroQualidade && (
            <div className="qualidade-filtro-ativo">
              <div>
                <span>Filtro de pendência ativo</span>
                <strong>{filtroQualidade.label}</strong>
              </div>

              <button
                type="button"
                className="qualidade-botao qualidade-botao-secundario"
                onClick={() => onFiltrarPendencia?.(null)}
              >
                Remover filtro
              </button>
            </div>
          )}

          <div className="qualidade-resumo-grid">
            <article className={`qualidade-card qualidade-card-principal ${classeSaude}`}>
              <span>Preenchimento geral</span>
              <strong>{percentualPreenchimento}%</strong>
              <small>{camposAvaliados} campos avaliados por PPCI</small>
            </article>

            <article className="qualidade-card">
              <span>Registros completos</span>
              <strong>{registrosCompletos}</strong>
              <small>de {total} PPCIs monitorados</small>
            </article>

            <article className="qualidade-card qualidade-card-alerta">
              <span>Com pendência</span>
              <strong>{registrosComPendencia}</strong>
              <small>{totalPendencias} ocorrências totais</small>
            </article>

            <article className="qualidade-card qualidade-card-critico">
              <span>Críticas</span>
              <strong>{pendenciasCriticas}</strong>
              <small>Status, responsável, vencimento ou prédio</small>
            </article>

            <article className="qualidade-card qualidade-card-atencao">
              <span>Atenção</span>
              <strong>{pendenciasAtencao}</strong>
              <small>Processo, prioridade, categoria, link ou próximo passo</small>
            </article>

            <article className="qualidade-card qualidade-card-checklist">
              <span>Checklist</span>
              <strong>{resumoChecklist.total}</strong>
              <small>{resumoChecklist.alta} alta · {resumoChecklist.media} média</small>
            </article>
          </div>

          <EvolucaoQualidade historico={historicoOrdenado} />

          <div className="qualidade-rankings-grid">
            <TabelaRanking
              titulo="Ranking por unidade"
              subtitulo="Ordenado por criticidade e volume de pendências"
              itens={rankingUnidades}
            />

            <TabelaRanking
              titulo="Ranking por responsável"
              subtitulo="Inclui registros sem responsável definido"
              itens={rankingResponsaveis}
            />
          </div>

          <ChecklistSaneamento
            itens={checklistSaneamento}
            onFiltrarPendencia={onFiltrarPendencia}
          />

          <div className="qualidade-detalhes">
            {itensComPendencia.length === 0 ? (
              <div className="qualidade-vazio">
                Nenhuma pendência encontrada nos campos avaliados.
              </div>
            ) : (
              itensComPendencia.map((item) => {
                const filtroAtivo = filtroAtivoId === item.id;

                return (
                  <article
                    key={item.id}
                    className={`qualidade-pendencia qualidade-pendencia-${item.nivel} ${
                      filtroAtivo ? "qualidade-pendencia-ativa" : ""
                    }`}
                  >
                    <div className="qualidade-pendencia-topo">
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.descricao}</span>
                      </div>

                      <div className="qualidade-pendencia-contador">
                        <strong>{item.quantidade}</strong>
                        <span>{item.percentual}%</span>
                      </div>
                    </div>

                    <div className="qualidade-pendencia-acoes">
                      <button
                        type="button"
                        className={`qualidade-botao ${
                          filtroAtivo ? "qualidade-botao-ativo" : "qualidade-botao-secundario"
                        }`}
                        onClick={() => alternarFiltroPendencia(item)}
                      >
                        {filtroAtivo ? "Filtro aplicado" : "Filtrar esta pendência"}
                      </button>

                      <button
                        type="button"
                        className="qualidade-botao"
                        onClick={() => exportarQualidadeCSV(item.registros, item.id)}
                      >
                        Exportar esta pendência
                      </button>
                    </div>

                    {item.exemplos.length > 0 && (
                      <div className="qualidade-exemplos">
                        {item.exemplos.map((exemplo, index) => (
                          <button
                            type="button"
                            className="qualidade-exemplo-botao"
                            key={`${item.id}-${exemplo.id}-${index}`}
                            onClick={() => abrirPPCI(exemplo.item)}
                            title="Abrir detalhes do PPCI"
                          >
                            <strong>{exemplo.id}</strong>
                            <span>{exemplo.predio}</span>
                            <small>{exemplo.unidade}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
