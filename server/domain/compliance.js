import { ApiError } from "../errors.js";

export function classificarRequisito(requisito, hoje=new Date()) {
  if (["dispensado","cancelado"].includes(requisito.status)) return requisito.status;
  if (!requisito.dataValidade) return requisito.status || "pendente";
  const dias = Math.ceil((new Date(`${requisito.dataValidade}T12:00:00Z`)-hoje)/86400000);
  if (dias < 0) return "vencido";
  if (dias <= 60) return "a_vencer";
  return requisito.numeroDocumento ? "regular" : "pendente";
}
export function calcularNivelRisco(probabilidade, impacto) {
  const p=Number(probabilidade), i=Number(impacto);
  if (![p,i].every(x=>Number.isInteger(x)&&x>=1&&x<=5)) throw new ApiError(422,"MATRIZ_RISCO_INVALIDA","Probabilidade e impacto devem estar entre 1 e 5.");
  const nivel=p*i;
  return { nivel, faixa: nivel>=20?"critico":nivel>=12?"alto":nivel>=6?"medio":"baixo" };
}

export function sanitizarPublicacao(publicacao) {
  return { codigo:publicacao.codigo,titulo:publicacao.titulo,categoria:publicacao.categoria,descricaoPublica:publicacao.descricaoPublica,periodoReferencia:publicacao.periodoReferencia,conteudo:publicacao.conteudo,publicadoEm:publicacao.publicadoEm };
}
