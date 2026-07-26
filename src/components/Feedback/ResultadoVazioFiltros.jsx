/* =========================================================
   RELEASE........: v6.2.0 RC1
   ARQUIVO........: src/components/Feedback/ResultadoVazioFiltros.jsx
   DESCRIÇÃO......: Estado vazio específico para resultados filtrados
                    sem PPCIs correspondentes.
========================================================= */

import React from "react";

const FILTROS_CONFIG = [
  {
    id: "busca",
    rotulo: "Busca textual",
    chaveValor: "busca",
    chaveSetter: "setFiltro",
    valorVazio: "",
  },
  {
    id: "status",
    rotulo: "Status",
    chaveValor: "status",
    chaveSetter: "setFiltroStatus",
    valorVazio: "",
  },
  {
    id: "situacao",
    rotulo: "Situação",
    chaveValor: "situacao",
    chaveSetter: "setFiltroSituacao",
    valorVazio: "",
  },
  {
    id: "categoria",
    rotulo: "Categoria",
    chaveValor: "categoria",
    chaveSetter: "setFiltroCategoria",
    valorVazio: "",
  },
  {
    id: "responsavel",
    rotulo: "Responsável",
    chaveValor: "responsavel",
    chaveSetter: "setFiltroResponsavel",
    valorVazio: "",
  },
  {
    id: "unidade",
    rotulo: "Unidade",
    chaveValor: "unidade",
    chaveSetter: "setFiltroUnidade",
    valorVazio: "",
  },
  {
    id: "qualidade",
    rotulo: "Pendência",
    chaveValor: "qualidade",
    chaveSetter: "setFiltroQualidade",
    valorVazio: null,
  },
  {
    id: "alerta",
    rotulo: "Alerta",
    chaveValor: "alerta",
    chaveSetter: "setFiltroAlerta",
    valorVazio: null,
  },
];

function formatarValor(valor) {
  if (!valor) return "";
  if (typeof valor === "object") return valor.label ?? valor.id ?? "Filtro aplicado";
  return valor;
}

export default function ResultadoVazioFiltros({
  totalGeral = 0,
  filtrosAtivos = {},
  acoesFiltros = {},
}) {
  const filtros = FILTROS_CONFIG.map((config) => ({
    ...config,
    valor: filtrosAtivos?.[config.chaveValor],
    valorFormatado: formatarValor(filtrosAtivos?.[config.chaveValor]),
  })).filter((config) => config.valorFormatado);

  const removerFiltro = (config) => {
    const setter = acoesFiltros?.[config.chaveSetter];
    if (typeof setter === "function") setter(config.valorVazio);
  };

  const limparTodos = () => {
    if (typeof acoesFiltros?.onLimpar === "function") {
      acoesFiltros.onLimpar();
    }
  };

  return (
    <div className="resultado-vazio-filtros">
      <div className="resultado-vazio-icone" aria-hidden="true">
        ⌀
      </div>

      <div className="resultado-vazio-conteudo">
        <strong>Nenhum PPCI encontrado com os filtros aplicados.</strong>

        <p>
          A base possui {totalGeral} PPCI{totalGeral === 1 ? "" : "s"}, mas
          nenhum registro atende à combinação atual de filtros.
        </p>

        {filtros.length > 0 && (
          <div className="resultado-vazio-filtros-lista">
            <span className="resultado-vazio-label">
              Filtros em conflito
            </span>

            <div className="resultado-vazio-chips">
              {filtros.map((filtro) => (
                <button
                  key={filtro.id}
                  type="button"
                  className="resultado-vazio-chip"
                  onClick={() => removerFiltro(filtro)}
                  title={`Remover filtro: ${filtro.rotulo}`}
                >
                  <span>{filtro.rotulo}</span>
                  <strong>{filtro.valorFormatado}</strong>
                  <em aria-hidden="true">×</em>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="resultado-vazio-acoes">
          {filtros.length > 0 && (
            <button
              type="button"
              className="resultado-vazio-botao resultado-vazio-botao-principal"
              onClick={limparTodos}
            >
              Limpar todos os filtros
            </button>
          )}

          <span className="resultado-vazio-ajuda">
            Remova um filtro individual ou limpe todos para voltar à listagem.
          </span>
        </div>
      </div>
    </div>
  );
}
