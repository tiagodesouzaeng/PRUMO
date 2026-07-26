/* =====================================================
   RELEASE........: v2.2.0 RC1
   ARQUIVO........: src/hooks/usePainelInterface.js
   DESCRIÇÃO......: Centralização dos estados de interface do Painel PPCI
===================================================== */

import { useState } from "react";

export default function usePainelInterface() {
  const [ppciSelecionado, setPpciSelecionado] = useState(null);
  const [mostrarAnalise, setMostrarAnalise] = useState(false);
  const [mostrarResponsabilidades, setMostrarResponsabilidades] = useState(false);

  return {
    ppciSelecionado,
    setPpciSelecionado,

    mostrarAnalise,
    setMostrarAnalise,

    mostrarResponsabilidades,
    setMostrarResponsabilidades,
  };
}
