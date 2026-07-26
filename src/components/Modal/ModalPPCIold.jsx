/* =========================================================
   RELEASE........: v1.1.1 RC1
   ARQUIVO........: src/components/Modal/ModalPPCI.jsx
   DESCRIÇÃO......: Modal de detalhes do PPCI com abas e todos os campos da API
========================================================= */

import React, { useEffect, useState } from "react";
import { mapPPCI } from "../../domain";

export default function ModalPPCI({
  ppciSelecionado,
  setPpciSelecionado,
  textoOuPadrao,
  formatarData,
}) {
  const [abaAtual, setAbaAtual] = useState("geral");

  useEffect(() => {
    if (!ppciSelecionado) return;

    const onKey = (e) => {
      if (e.key === "Escape") setPpciSelecionado(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ppciSelecionado, setPpciSelecionado]);

  useEffect(() => {
    if (ppciSelecionado) setAbaAtual("geral");
  }, [ppciSelecionado]);

  if (!ppciSelecionado) return null;

  const ppci = mapPPCI(ppciSelecionado);
  const conclusao = Math.round((ppci.conclusao ?? 0) * 100);

  const valor = (campo, padrao = "-") =>
    textoOuPadrao(ppciSelecionado?.[campo], padrao);

  const data = (campo) =>
    textoOuPadrao(formatarData(ppciSelecionado?.[campo]), "-");

  const linkProcesso = ppciSelecionado?.["Link Processo"];
  const linkProcessoValido =
    typeof linkProcesso === "string" && /^https?:\/\//i.test(linkProcesso.trim());

  const abas = [
    { id: "geral", label: "Geral" },
    { id: "processo", label: "Processo" },
    { id: "andamento", label: "Andamento" },
    { id: "cronograma", label: "Cronograma" },
  ];

  return (
    <div className="modal-overlay" onClick={() => setPpciSelecionado(null)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close"
          onClick={() => setPpciSelecionado(null)}
          aria-label="Fechar modal"
        >
          ✕
        </button>

        <header className="modal-header">
          <div>
            <h2>{textoOuPadrao(ppci.id, "PPCI sem ID")}</h2>
            <h3>{textoOuPadrao(ppci.predio)}</h3>
            <p className="modal-unidade">{textoOuPadrao(ppci.unidade)}</p>
          </div>
        </header>

        <div className="modal-progresso">
          <div className="progress-header">
            <span>Conclusão</span>
            <strong>{conclusao}%</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${conclusao}%` }}
            />
          </div>
        </div>

        <nav className="modal-tabs" aria-label="Abas de detalhes do PPCI">
          {abas.map((aba) => (
            <button
              key={aba.id}
              type="button"
              className={`modal-tab ${abaAtual === aba.id ? "active" : ""}`}
              onClick={() => setAbaAtual(aba.id)}
            >
              {aba.label}
            </button>
          ))}
        </nav>

        <section className="modal-tab-content">
          {abaAtual === "geral" && (
            <div className="modal-secao">
              <h4>Informações gerais</h4>

              <div className="modal-grid">
                <div>
                  <strong>ID</strong>
                  <br />
                  {valor("ID")}
                </div>

                <div>
                  <strong>Unidade</strong>
                  <br />
                  {valor("Unidade")}
                </div>

                <div>
                  <strong>Prédio / Edificação</strong>
                  <br />
                  {valor("Prédio / Edificação")}
                </div>

                <div>
                  <strong>Prioridade</strong>
                  <br />
                  {valor("Prioridade")}
                </div>

                <div>
                  <strong>Categoria</strong>
                  <br />
                  {valor("Categoria")}
                </div>

                <div>
                  <strong>Status / Situação</strong>
                  <br />
                  {valor("Status / Situação", "Sem Status")}
                </div>

                <div>
                  <strong>% Conclusão</strong>
                  <br />
                  {conclusao}%
                </div>
              </div>
            </div>
          )}

          {abaAtual === "processo" && (
            <div className="modal-secao">
              <h4>Processo</h4>

              <div className="modal-grid">
                <div>
                  <strong>Número do PPCI / Processo CBMRS</strong>
                  <br />
                  {valor("Número do PPCI / Processo CBMRS")}
                </div>

                <div>
                  <strong>Link Processo</strong>
                  <br />
                  {linkProcessoValido ? (
                    <a
                      href={linkProcesso.trim()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir processo
                    </a>
                  ) : (
                    valor("Link Processo")
                  )}
                </div>

                <div>
                  <strong>Solicitante</strong>
                  <br />
                  {valor("Solicitante")}
                </div>

                <div>
                  <strong>Responsável</strong>
                  <br />
                  {valor("Responsável")}
                </div>
              </div>
            </div>
          )}

          {abaAtual === "andamento" && (
            <div className="modal-secao">
              <h4>Andamento</h4>

              <div className="modal-bloco-texto">
                <strong>Descrição / Itens</strong>
                <p>{valor("Descrição / Itens")}</p>
              </div>

              <div className="modal-bloco-texto">
                <strong>Providência / Próximo passo</strong>
                <p>{valor("Providência / Próximo passo")}</p>
              </div>

              <div className="modal-bloco-texto">
                <strong>Observações</strong>
                <p>{valor("Observações")}</p>
              </div>
            </div>
          )}

          {abaAtual === "cronograma" && (
            <div className="modal-secao">
              <h4>Cronograma</h4>

              <div className="modal-grid">
                <div>
                  <strong>Data de entrada</strong>
                  <br />
                  {data("Data de entrada")}
                </div>

                <div>
                  <strong>Data de início Obra/Projeto</strong>
                  <br />
                  {data("Data de início Obra/Projeto")}
                </div>

                <div>
                  <strong>Data prevista entrega Obra/Projeto</strong>
                  <br />
                  {data("Data prevista entrega Obra/Projeto")}
                </div>

                <div>
                  <strong>Data limite / vencimento PPCI</strong>
                  <br />
                  {data("Data limite / vencimento PPCI")}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
