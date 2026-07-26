/* =========================================================
   RELEASE........: v1.0.0 RC1
   ARQUIVO........: Header.jsx

   RESPONSABILIDADE:
   Cabeçalho principal do Painel PPCI.
========================================================= */

import React from "react";

export default function Header({

  totalPPCIs,

  totalFiltrados,

  ultimaAtualizacao

}) {

  return (

    <header className="header">

      <div className="header-titulo">

        <h1>
          Painel PPCI
        </h1>

        <p>
          Gestão de infraestrutura
        </p>

      </div>

      <div className="header-indicadores">

        <div className="header-card">

          <span>
            PPCIs Monitorados
          </span>

          <strong>
            {totalFiltrados}
          </strong>

        </div>

        <div className="header-card">

          <span>
            Total Cadastrado
          </span>

          <strong>
            {totalPPCIs}
          </strong>

        </div>

      </div>

      <div className="ultima-atualizacao">

        Última atualização

        <strong>

          {ultimaAtualizacao}

        </strong>

      </div>

    </header>

  );

}
