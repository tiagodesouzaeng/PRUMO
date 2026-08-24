import { ApiError } from "../errors.js";

const FLUXO = {
  rascunho: { ativar: "vigente", cancelar: "cancelado" },
  vigente: { iniciar_execucao: "em_execucao", cancelar: "cancelado" },
  em_execucao: { prestar_contas: "prestacao_contas" },
  prestacao_contas: { encerrar: "encerrado", reabrir_execucao: "em_execucao" },
};
const PERMISSAO = { ativar: "convenios.editar", cancelar: "convenios.editar", iniciar_execucao: "convenios.executar", prestar_contas: "convenios.prestar-contas", encerrar: "convenios.prestar-contas", reabrir_execucao: "convenios.prestar-contas" };

export function resolverTransicaoConvenio(status, acao) {
  const para = FLUXO[status]?.[acao];
  if (!para) throw new ApiError(422,"TRANSICAO_CONVENIO_INVALIDA","A transição não é permitida para o convênio neste estágio.");
  return { para, permissao: PERMISSAO[acao] };
}
export function calcularResumoConvenio(convenio, metas=[], repasses=[], execucoes=[], diligencias=[]) {
  const recebido = repasses.filter(x=>["recebido","devolvido"].includes(x.status)).reduce((s,x)=>s+(x.tipo==="devolucao"?-1:Number(x.valor||0)),0);
  const executado = execucoes.reduce((s,x)=>s+Number(x.valorExecutado||0),0);
  const valorTotal = Number(convenio.valorRepasse||0)+Number(convenio.valorContrapartida||0);
  return { valorTotal, recebido, executado, saldoExecutar: Math.max(0,valorTotal-executado), metasTotal: metas.length, metasConcluidas: metas.filter(x=>x.status==="concluida").length, diligenciasAbertas: diligencias.filter(x=>["aberta","vencida"].includes(x.status)).length };
}
