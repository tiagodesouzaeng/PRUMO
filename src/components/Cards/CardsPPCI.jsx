/* =========================================================
   RELEASE........: v7.4.2 RC1
   ARQUIVO........: src/components/Cards/CardsPPCI.jsx
   DESCRIÇÃO......: Listagem de cards PPCI com cabeçalho compacto,
                    alternância Cards/Lista, persistência visual,
                    estado vazio filtrado aprimorado, reset de preferências
                    e controles compactos integrados ao cabeçalho.
========================================================= */

import React, { useEffect, useState } from "react";
import CardPPCI from "./CardPPCI";
import ResultadoVazioFiltros from "../Feedback/ResultadoVazioFiltros";

import {
  MODO_VISUAL_PADRAO,
  SIGIU_STORAGE_KEYS,
} from "../../config/sigiuConfig";

const ORDENACOES_LABEL = {
  risco_operacional: "Risco operacional",
  prioridade: "Prioridade",
  vencimento: "Vencimento",
  predio: "Prédio / Edificação",
  responsavel: "Responsável",
};

function obterModoVisualInicial() {
  try {
    const modoSalvo = window.localStorage.getItem(SIGIU_STORAGE_KEYS.MODO_VISUAL);
    return modoSalvo === "lista" || modoSalvo === "cards"
      ? modoSalvo
      : MODO_VISUAL_PADRAO;
  } catch {
    return MODO_VISUAL_PADRAO;
  }
}

function salvarModoVisual(modoVisual) {
  try {
    window.localStorage.setItem(SIGIU_STORAGE_KEYS.MODO_VISUAL, modoVisual);
  } catch {
    // Mantém o painel funcional mesmo quando o navegador bloquear localStorage.
  }
}

export default function CardsPPCI({
  ppcis = [],
  totalGeral = 0,
  ordenacao = "prioridade",
  filtrosAtivos = {},
  acoesFiltros = {},
  obterDiasParaVencer,
  obterClasseVencimento,
  textoOuPadrao,
  formatarData,
  aplicarFiltroRapido,
  setPpciSelecionado,
  preferenciasVersao = 0,
  controlesListagem = null,
  preferenciasListagem = null,
}) {
  const [modoVisual, setModoVisual] = useState(obterModoVisualInicial);

  useEffect(() => {
    salvarModoVisual(modoVisual);
  }, [modoVisual]);

  useEffect(() => {
    setModoVisual(obterModoVisualInicial());
  }, [preferenciasVersao]);

  const totalFiltrado = ppcis.length;
  const existemFiltros = totalGeral > 0 && totalFiltrado !== totalGeral;
  const labelOrdenacao = ORDENACOES_LABEL[ordenacao] ?? textoOuPadrao(ordenacao);

  const CabecalhoListagem = () => (
    <div className="cards-cabecalho">
      <div>
        <h3 className="secao-titulo cards-titulo">PPCIs Monitorados</h3>
        <p className="cards-subtitulo">
          {existemFiltros
            ? `${totalFiltrado} de ${totalGeral} PPCIs exibidos`
            : `${totalGeral} PPCIs cadastrados`}
        </p>
      </div>

      <div className="cards-resumo-lista" aria-label="Resumo da listagem">
        <span className="cards-contador">
          <strong>{totalFiltrado}</strong>
          <small>visíveis</small>
        </span>

        <span className="cards-ordenacao">
          Ordenado por <strong>{labelOrdenacao}</strong>
        </span>

        <div className="cards-modo-visual" aria-label="Modo de visualização dos PPCIs">
          <button
            type="button"
            className={`cards-modo-botao ${modoVisual === "cards" ? "ativo" : ""}`}
            onClick={() => setModoVisual("cards")}
            aria-pressed={modoVisual === "cards"}
          >
            Cards
          </button>

          <button
            type="button"
            className={`cards-modo-botao ${modoVisual === "lista" ? "ativo" : ""}`}
            onClick={() => setModoVisual("lista")}
            aria-pressed={modoVisual === "lista"}
          >
            Lista
          </button>
        </div>
      </div>
    </div>
  );

  if (!ppcis.length) {
    return (
      <section className="secao-painel secao-painel-cards">
        <CabecalhoListagem />
        {controlesListagem && (
          <div className="cards-controles-integrados">
            {controlesListagem}
          </div>
        )}
        {preferenciasListagem}

        <ResultadoVazioFiltros
          totalGeral={totalGeral}
          filtrosAtivos={filtrosAtivos}
          acoesFiltros={acoesFiltros}
        />
      </section>
    );
  }

  return (
    <section className="secao-painel secao-painel-cards">
      <CabecalhoListagem />
      {controlesListagem && (
        <div className="cards-controles-integrados">
          {controlesListagem}
        </div>
      )}
      {preferenciasListagem}

      <div
        className={`cards-grid ${
          modoVisual === "lista" ? "cards-grid-lista" : "cards-grid-cards"
        }`}
      >
        {ppcis.map((item) => {
          const dias =
            obterDiasParaVencer(
              item["Data limite / vencimento PPCI"]
            ) ?? 9999;

          return (
            <CardPPCI
              key={item.ID}
              item={item}
              dias={dias}
              textoOuPadrao={textoOuPadrao}
              formatarData={formatarData}
              obterClasseVencimento={obterClasseVencimento}
              aplicarFiltroRapido={aplicarFiltroRapido}
              setPpciSelecionado={setPpciSelecionado}
            />
          );
        })}
      </div>
    </section>
  );
}
