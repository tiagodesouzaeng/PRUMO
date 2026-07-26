/* =========================================================
   RELEASE........: v2.5.0 RC1
   ARQUIVO........: src/components/Modal/ModalPPCI.jsx
   DESCRIÇÃO......: Modal de detalhes do PPCI com abas e campos padronizados
========================================================= */

import React, { useEffect, useState } from "react";

import { mapPPCI } from "../../domain";
import { PPCI_CAMPOS } from "../../domain/ppciCampos";
import { extrairUrlLinkProcesso } from "../../utils/linkProcesso";

function CampoInfo({ titulo, children }) {
  return (
    <div>
      <strong>{titulo}</strong>
      <br />
      {children}
    </div>
  );
}

function CampoTexto({ titulo, children }) {
  return (
    <div className="modal-bloco-texto">
      <strong>{titulo}</strong>
      <p>{children}</p>
    </div>
  );
}

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

  const linkProcessoBruto = ppciSelecionado?.[PPCI_CAMPOS.LINK_PROCESSO];
  const linkProcessoHref = extrairUrlLinkProcesso(linkProcessoBruto);

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
                <CampoInfo titulo="ID">
                  {valor(PPCI_CAMPOS.ID)}
                </CampoInfo>

                <CampoInfo titulo="Unidade">
                  {valor(PPCI_CAMPOS.UNIDADE)}
                </CampoInfo>

                <CampoInfo titulo="Prédio / Edificação">
                  {valor(PPCI_CAMPOS.PREDIO)}
                </CampoInfo>

                <CampoInfo titulo="Prioridade">
                  {valor(PPCI_CAMPOS.PRIORIDADE)}
                </CampoInfo>

                <CampoInfo titulo="Categoria">
                  {valor(PPCI_CAMPOS.CATEGORIA)}
                </CampoInfo>

                <CampoInfo titulo="Status / Situação">
                  {valor(PPCI_CAMPOS.STATUS, "Sem Status")}
                </CampoInfo>

                <CampoInfo titulo="% Conclusão">
                  {conclusao}%
                </CampoInfo>
              </div>
            </div>
          )}

          {abaAtual === "processo" && (
            <div className="modal-secao">
              <h4>Processo</h4>

              <div className="modal-grid">
                <CampoInfo titulo="Número do PPCI / Processo CBMRS">
                  {valor(PPCI_CAMPOS.PROCESSO)}
                </CampoInfo>

                <CampoInfo titulo="Link Processo">
                  {linkProcessoHref ? (
                    <a
                      className="modal-link-processo"
                      href={linkProcessoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={linkProcessoHref}
                    >
                      Abrir processo
                    </a>
                  ) : (
                    valor(PPCI_CAMPOS.LINK_PROCESSO)
                  )}
                </CampoInfo>

                <CampoInfo titulo="Solicitante">
                  {valor(PPCI_CAMPOS.SOLICITANTE)}
                </CampoInfo>

                <CampoInfo titulo="Responsável">
                  {valor(PPCI_CAMPOS.RESPONSAVEL)}
                </CampoInfo>
              </div>
            </div>
          )}

          {abaAtual === "andamento" && (
            <div className="modal-secao">
              <h4>Andamento</h4>

              <CampoTexto titulo="Descrição / Itens">
                {valor(PPCI_CAMPOS.DESCRICAO)}
              </CampoTexto>

              <CampoTexto titulo="Providência / Próximo passo">
                {valor(PPCI_CAMPOS.PROXIMO_PASSO)}
              </CampoTexto>

              <CampoTexto titulo="Observações">
                {valor(PPCI_CAMPOS.OBSERVACOES)}
              </CampoTexto>
            </div>
          )}

          {abaAtual === "cronograma" && (
            <div className="modal-secao">
              <h4>Cronograma</h4>

              <div className="modal-grid">
                <CampoInfo titulo="Data de entrada">
                  {data(PPCI_CAMPOS.DATA_ENTRADA)}
                </CampoInfo>

                <CampoInfo titulo="Data de início Obra/Projeto">
                  {data(PPCI_CAMPOS.DATA_INICIO)}
                </CampoInfo>

                <CampoInfo titulo="Data prevista entrega Obra/Projeto">
                  {data(PPCI_CAMPOS.DATA_ENTREGA)}
                </CampoInfo>

                <CampoInfo titulo="Data limite / vencimento PPCI">
                  {data(PPCI_CAMPOS.DATA_VENCIMENTO)}
                </CampoInfo>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
