export const ITENS_PRONTIDAO_PILOTO = [
  { id: "api-https", sprint: 24, grupo: "Infraestrutura", titulo: "API publicada em HTTPS", obrigatorio: true },
  { id: "postgres-rls", sprint: 24, grupo: "Dados", titulo: "PostgreSQL gerenciado com RLS", obrigatorio: true },
  { id: "oidc", sprint: 24, grupo: "Identidade", titulo: "OIDC/JWT e expiração de sessão", obrigatorio: true },
  { id: "storage-ged", sprint: 24, grupo: "Documentos", titulo: "Storage GED privado e versionado", obrigatorio: true },
  { id: "segredos", sprint: 24, grupo: "Segurança", titulo: "Credenciais mantidas em cofre de segredos", obrigatorio: true },
  { id: "backup-restauracao", sprint: 24, grupo: "Continuidade", titulo: "Backup e restauração comprovados", obrigatorio: true },
  { id: "monitoramento", sprint: 24, grupo: "Operação", titulo: "Monitoramento, logs e alertas ativos", obrigatorio: true },
  { id: "origens-seguras", sprint: 24, grupo: "Segurança", titulo: "CORS, CSP e origens públicas revisados", obrigatorio: true },
  { id: "massa-tres-organizacoes", sprint: 25, grupo: "Homologação", titulo: "Massa das três organizações recriada", obrigatorio: true },
  { id: "isolamento-rls", sprint: 25, grupo: "Homologação", titulo: "Isolamento entre organizações e equipes", obrigatorio: true },
  { id: "inventario-local", sprint: 25, grupo: "Migração", titulo: "Inventário de localStorage e IndexedDB", obrigatorio: true },
  { id: "lotes-homologados", sprint: 25, grupo: "Migração", titulo: "Lotes validados e homologados", obrigatorio: true },
  { id: "repositorios-corporativos", sprint: 25, grupo: "Migração", titulo: "Repositórios corporativos ativados", obrigatorio: true },
  { id: "fluxos-criticos", sprint: 25, grupo: "Qualidade", titulo: "Fluxos críticos ponta a ponta aprovados", obrigatorio: true },
  { id: "retorno-testado", sprint: 25, grupo: "Continuidade", titulo: "Retorno ao modo híbrido testado", obrigatorio: true },
  { id: "aceite-usuarios", sprint: 25, grupo: "Piloto", titulo: "Aceite dos responsáveis do piloto", obrigatorio: true },
];

const STATUS_ITEM = new Set(["pendente", "em_validacao", "aprovado", "bloqueado"]);
const ACOES = new Set(["iniciar", "suspender", "retomar", "aprovar", "encerrar"]);

export function criarEstadoPiloto({ tenantId = "", teamId = "", usuarioId = "", agora = new Date().toISOString() } = {}) {
  return {
    contrato: 1,
    tenantId,
    teamId,
    status: "preparacao",
    itens: ITENS_PRONTIDAO_PILOTO.map((item) => ({
      ...item,
      status: "pendente",
      evidencia: "",
      observacao: "",
      atualizadoPor: "",
      atualizadoEm: "",
    })),
    decisoes: [],
    criadoPor: usuarioId,
    criadoEm: agora,
    atualizadoPor: usuarioId,
    atualizadoEm: agora,
  };
}

export function avaliarEstadoPiloto(estado) {
  const itens = estado?.itens || [];
  const obrigatorios = itens.filter((item) => item.obrigatorio !== false);
  const aprovados = obrigatorios.filter((item) => item.status === "aprovado");
  const bloqueados = obrigatorios.filter((item) => item.status === "bloqueado");
  const sprint24 = obrigatorios.filter((item) => item.sprint === 24);
  const sprint25 = obrigatorios.filter((item) => item.sprint === 25);
  const sprint24Aprovada = sprint24.length > 0 && sprint24.every((item) => item.status === "aprovado");
  const sprint25Aprovada = sprint25.length > 0 && sprint25.every((item) => item.status === "aprovado");
  return {
    total: obrigatorios.length,
    aprovados: aprovados.length,
    pendentes: obrigatorios.length - aprovados.length,
    bloqueados: bloqueados.length,
    progresso: obrigatorios.length ? Math.round((aprovados.length / obrigatorios.length) * 100) : 0,
    sprint24: { total: sprint24.length, aprovados: sprint24.filter((item) => item.status === "aprovado").length, pronta: sprint24Aprovada },
    sprint25: { total: sprint25.length, aprovados: sprint25.filter((item) => item.status === "aprovado").length, pronta: sprint25Aprovada },
    podeIniciarPiloto: sprint24Aprovada && bloqueados.length === 0,
    podePromover: sprint24Aprovada && sprint25Aprovada && bloqueados.length === 0,
  };
}

export function atualizarItemPiloto(estado, itemId, dados, { usuarioId, agora = new Date().toISOString() } = {}) {
  const item = ITENS_PRONTIDAO_PILOTO.find((candidato) => candidato.id === itemId);
  if (!item) throw new Error("O requisito informado não pertence ao plano do piloto.");
  const status = String(dados?.status || "").trim();
  if (!STATUS_ITEM.has(status)) throw new Error("O status do requisito é inválido.");
  const evidencia = String(dados?.evidencia || "").trim();
  const observacao = String(dados?.observacao || "").trim();
  if (status === "aprovado" && evidencia.length < 3) {
    throw new Error("Informe a evidência utilizada para aprovar o requisito.");
  }
  if (evidencia.length > 2000 || observacao.length > 4000) {
    throw new Error("A evidência ou observação excede o limite permitido.");
  }
  const base = estado || criarEstadoPiloto({ usuarioId, agora });
  return {
    ...base,
    itens: base.itens.map((atual) => atual.id === itemId ? {
      ...atual,
      status,
      evidencia,
      observacao,
      atualizadoPor: usuarioId,
      atualizadoEm: agora,
    } : atual),
    atualizadoPor: usuarioId,
    atualizadoEm: agora,
  };
}

export function decidirPiloto(estado, dados, { usuarioId, agora = new Date().toISOString() } = {}) {
  const acao = String(dados?.acao || "").trim();
  const justificativa = String(dados?.justificativa || "").trim();
  if (!ACOES.has(acao)) throw new Error("A decisão do piloto é inválida.");
  if (justificativa.length < 5) throw new Error("Informe uma justificativa para a decisão.");
  const base = estado || criarEstadoPiloto({ usuarioId, agora });
  const avaliacao = avaliarEstadoPiloto(base);
  const transicoes = {
    preparacao: { iniciar: "em_execucao", suspender: "suspenso" },
    em_execucao: { suspender: "suspenso", aprovar: "aprovado" },
    suspenso: { retomar: "em_execucao" },
    aprovado: { encerrar: "encerrado", suspender: "suspenso" },
    encerrado: {},
  };
  const novoStatus = transicoes[base.status]?.[acao];
  if (!novoStatus) throw new Error("A decisão não é permitida no estado atual do piloto.");
  if (acao === "iniciar" && !avaliacao.podeIniciarPiloto) {
    throw new Error("Conclua os requisitos obrigatórios da Sprint 24 antes de iniciar o piloto.");
  }
  if ((acao === "aprovar" || acao === "encerrar") && !avaliacao.podePromover) {
    throw new Error("A promoção exige todos os requisitos das Sprints 24 e 25 aprovados.");
  }
  const decisao = { id: `${agora}:${acao}`, acao, justificativa, statusAnterior: base.status, statusNovo: novoStatus, usuarioId, criadoEm: agora };
  return {
    ...base,
    status: novoStatus,
    decisoes: [...(base.decisoes || []), decisao],
    atualizadoPor: usuarioId,
    atualizadoEm: agora,
  };
}
