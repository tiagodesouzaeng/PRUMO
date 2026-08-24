import { ApiError } from "../errors.js";

export const HORAS_SLA = Object.freeze({ critica: 4, alta: 12, media: 48, baixa: 120 });

export function calcularVencimentoSla(prioridade, abertoEm = new Date().toISOString()) {
  const horas = HORAS_SLA[prioridade];
  const base = new Date(abertoEm);
  if (!horas || Number.isNaN(base.getTime())) throw new ApiError(422, "SLA_INVALIDO", "Prioridade ou data de abertura inválida.");
  return new Date(base.getTime() + horas * 60 * 60 * 1000).toISOString();
}
export function avaliarSla(chamado, agora = new Date()) {
  if (["resolvido", "fechado", "cancelado"].includes(chamado.status)) return "encerrado";
  const vencimento = new Date(chamado.slaVencimento);
  if (Number.isNaN(vencimento.getTime())) return "nao_configurado";
  const restante = vencimento.getTime() - agora.getTime();
  if (restante < 0) return "violado";
  if (restante <= 2 * 60 * 60 * 1000) return "em_risco";
  return "no_prazo";
}

const TRANSICOES_CHAMADO = {
  triar: { de: ["aberto"], para: "triado", permissao: "manutencao.atender" },
  programar: { de: ["aberto", "triado"], para: "programado", permissao: "manutencao.atender" },
  iniciar: { de: ["triado", "programado"], para: "em_atendimento", permissao: "manutencao.atender" },
  resolver: { de: ["em_atendimento"], para: "resolvido", permissao: "manutencao.atender" },
  reabrir: { de: ["resolvido"], para: "em_atendimento", permissao: "manutencao.atender" },
  fechar: { de: ["resolvido"], para: "fechado", permissao: "manutencao.encerrar" },
  cancelar: { de: ["aberto", "triado", "programado"], para: "cancelado", permissao: "manutencao.encerrar" },
};

export function resolverTransicaoChamado(statusAtual, acao) {
  const regra = TRANSICOES_CHAMADO[acao];
  if (!regra) throw new ApiError(422, "ACAO_CHAMADO_INVALIDA", "A ação não pertence ao fluxo de manutenção.");
  if (!regra.de.includes(statusAtual)) throw new ApiError(422, "TRANSICAO_CHAMADO_INVALIDA", `A ação ${acao} não é permitida no status ${statusAtual}.`);
  return regra;
}

export function calcularCustoOrdem(recursos = []) {
  return Math.trunc((recursos.reduce((total, item) => total + Number(item.quantidade || 0) * Number(item.valorUnitario || 0), 0) + Number.EPSILON) * 100) / 100;
}
