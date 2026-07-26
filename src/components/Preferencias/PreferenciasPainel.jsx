/* =========================================================
   RELEASE........: v4.4.0 RC1
   ARQUIVO........: src/components/Preferencias/PreferenciasPainel.jsx
   DESCRIÇÃO......: Ações operacionais para salvar, restaurar e limpar
                    preferências locais do Painel PPCI.
========================================================= */

import React, { useMemo, useState } from "react";

function formatarDataHora(valor) {
  if (!valor) return "Nenhuma visão salva";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "Visão salva";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PreferenciasPainel({
  haVisaoSalva = false,
  dataVisaoSalva = null,
  onSalvarVisao,
  onRestaurarVisao,
  onLimparPreferencias,
}) {
  const [mensagem, setMensagem] = useState("");

  const textoUltimaVisao = useMemo(
    () => formatarDataHora(dataVisaoSalva),
    [dataVisaoSalva]
  );

  const salvar = () => {
    if (typeof onSalvarVisao === "function") {
      onSalvarVisao();
      setMensagem("Visão atual salva.");
    }
  };

  const restaurar = () => {
    if (typeof onRestaurarVisao === "function") {
      const restaurou = onRestaurarVisao();
      setMensagem(restaurou ? "Visão salva restaurada." : "Não há visão salva.");
    }
  };

  const limpar = () => {
    if (typeof onLimparPreferencias === "function") {
      onLimparPreferencias();
      setMensagem("Preferências locais limpas.");
    }
  };

  return (
    <section className="preferencias-painel" aria-label="Preferências locais do painel">
      <div className="preferencias-info">
        <strong>Preferências</strong>
        <span>
          Cards/Lista e ordenação são mantidos automaticamente. A visão de filtros pode ser salva manualmente.
        </span>
      </div>

      <div className="preferencias-status">
        <span>Última visão</span>
        <strong>{textoUltimaVisao}</strong>
      </div>

      <div className="preferencias-acoes">
        <button
          type="button"
          className="preferencias-botao preferencias-botao-principal"
          onClick={salvar}
        >
          Salvar visão
        </button>

        <button
          type="button"
          className="preferencias-botao"
          onClick={restaurar}
          disabled={!haVisaoSalva}
        >
          Restaurar
        </button>

        <button
          type="button"
          className="preferencias-botao preferencias-botao-alerta"
          onClick={limpar}
        >
          Limpar preferências
        </button>
      </div>

      {mensagem && (
        <span className="preferencias-mensagem" role="status">
          {mensagem}
        </span>
      )}
    </section>
  );
}
