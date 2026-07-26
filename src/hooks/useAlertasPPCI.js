/* =====================================================
   RELEASE........: v6.0.0 RC1
   ARQUIVO........: src/hooks/useAlertasPPCI.js
   DESCRIÇÃO......: Hook para análise dos alertas operacionais PPCI
===================================================== */

import { useMemo } from "react";
import { calcularResumoAlertasPPCI } from "../domain/ppciAlertas";

export default function useAlertasPPCI(ppcis = []) {
  return useMemo(() => calcularResumoAlertasPPCI(ppcis), [ppcis]);
}
