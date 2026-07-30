export const TIPOS_TRABALHO_CORPORATIVO = {
  IMPORTAR_BASE: "importar-base-precos",
  MIGRAR_DADOS: "migrar-dados-locais",
  ATUALIZAR_PRECOS_ORCAMENTO: "atualizar-precos-orcamento",
  EXPORTAR_LICITACAO: "exportar-pacote-licitacao",
};

export const STATUS_TRABALHO_CORPORATIVO = [
  "aguardando",
  "processando",
  "aguardando-confirmacao",
  "concluido",
  "falhou",
  "cancelado",
];

export function criarSolicitacaoTrabalho({
  tipo,
  contexto,
  parametros = {},
  solicitadoEm = new Date().toISOString(),
  idempotencyKey = "",
} = {}) {
  if (!Object.values(TIPOS_TRABALHO_CORPORATIVO).includes(tipo)) {
    throw new Error("Tipo de trabalho corporativo inválido.");
  }
  if (!contexto?.tenantId || !contexto?.usuarioId) {
    throw new Error("Empresa e usuário são obrigatórios para iniciar o processamento.");
  }
  return {
    tipo,
    tenantId: contexto.tenantId,
    teamId: contexto.teamId || "",
    solicitadoPor: contexto.usuarioId,
    solicitadoEm,
    parametros,
    idempotencyKey,
    status: "aguardando",
  };
}
export function criarSolicitacaoAtualizacaoPrecos({
  contexto,
  orcamentoId,
  revisaoOrigem,
  publicacoesDestino,
  somenteSimulacao = true,
  solicitadoEm,
} = {}) {
  if (!orcamentoId) throw new Error("Informe o orçamento que terá os preços avaliados.");
  if (!Array.isArray(publicacoesDestino) || !publicacoesDestino.length) {
    throw new Error("Selecione ao menos uma publicação de destino.");
  }
  return criarSolicitacaoTrabalho({
    tipo: TIPOS_TRABALHO_CORPORATIVO.ATUALIZAR_PRECOS_ORCAMENTO,
    contexto,
    solicitadoEm,
    idempotencyKey: [
      "atualizar-precos",
      contexto.tenantId,
      orcamentoId,
      revisaoOrigem || "atual",
      publicacoesDestino.map((item) => `${item.baseId}:${item.publicacaoId}`).sort().join(","),
    ].join(":"),
    parametros: {
      orcamentoId,
      revisaoOrigem: revisaoOrigem || "",
      publicacoesDestino,
      somenteSimulacao,
      atualizarComposicoesPropriasRecursivamente: true,
      criarNovaRevisaoAoAplicar: true,
      preservarItensManuais: true,
    },
  });
}
