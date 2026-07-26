import { useMemo } from "react";
import { obterDiasParaVencer } from "../../utils/ppciUtils";

export default function useDashboardData(ppcis = []) {
  return useMemo(() => {
    const contar = (campo) => {
      const mapa = {};
      ppcis.forEach((item) => {
        const chave = item[campo] || "Não informado";
        mapa[chave] = (mapa[chave] || 0) + 1;
      });
      return Object.entries(mapa).sort((a,b)=>b[1]-a[1]);
    };

    const statusOrdenados = contar("Status / Situação");
    const categoriasOrdenadas = contar("Categoria");
    const responsaveisOrdenados = contar("Responsável");
    const unidadesOrdenadas = contar("Unidade");

    let vencidos=0,criticos=0,regulares=0,semData=0,soma=0;

    ppcis.forEach((item)=>{
      soma += Number(item["% Conclusão"]||0);
      const dias=obterDiasParaVencer(item["Data limite / vencimento PPCI"]);
      if(dias===null) semData++;
      else if(dias<0) vencidos++;
      else if(dias<=60) criticos++;
      else regulares++;
    });

    return {
      statusOrdenados,
      categoriasOrdenadas,
      responsaveisOrdenados,
      unidadesOrdenadas,
      vencidos,
      criticos,
      regulares,
      semData,
      mediaConclusao: ppcis.length ? Math.round((soma/ppcis.length)*100) : 0,
      maiorStatus: Math.max(1,...statusOrdenados.map(([,q])=>q)),
      maiorSituacao: Math.max(1,vencidos,criticos,regulares,semData)
    };
  },[ppcis]);
}
