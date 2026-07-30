export const EMPRESAS_DEMONSTRACAO = [
  {
    id: "EMP-PRUMO-DEMO",
    nome: "Empresa de demonstração",
    nomeFantasia: "PRUMO Engenharia",
    documento: "",
    status: "ativa",
    plano: "Desenvolvimento",
  },
];

export const EQUIPES_DEMONSTRACAO = [
  {
    id: "EQ-ORCAMENTOS",
    tenantId: "EMP-PRUMO-DEMO",
    nome: "Orçamentos e Custos",
    status: "ativa",
  },
  {
    id: "EQ-OBRAS",
    tenantId: "EMP-PRUMO-DEMO",
    nome: "Planejamento e Obras",
    status: "ativa",
  },
];

export const DOMINIOS_CORPORATIVOS = [
  {
    id: "bases-publicas",
    nome: "Bases públicas homologadas",
    escopo: "global",
    proprietario: "plataforma",
    estrategia: "Uma publicação imutável compartilhada em somente leitura.",
  },
  {
    id: "bases-licenciadas",
    nome: "Bases licenciadas",
    escopo: "empresa",
    proprietario: "tenant",
    estrategia: "Acesso condicionado ao contrato e à licença da empresa.",
  },
  {
    id: "orcamentos",
    nome: "Orçamentos, revisões e medições",
    escopo: "empresa-equipe",
    proprietario: "tenant",
    estrategia: "tenant_id obrigatório; team_id restringe a colaboração interna.",
  },
  {
    id: "composicoes-proprias",
    nome: "Composições e cotações próprias",
    escopo: "empresa",
    proprietario: "tenant",
    estrategia: "Nunca compartilhadas com outra empresa sem ação explícita.",
  },
  {
    id: "documentos",
    nome: "Documentos e arquivos",
    escopo: "empresa-equipe",
    proprietario: "tenant",
    estrategia: "Caminho segregado e acesso temporário autorizado pela API.",
  },
  {
    id: "auditoria",
    nome: "Auditoria",
    escopo: "empresa",
    proprietario: "tenant",
    estrategia: "Trilha imutável, consultável somente por perfis autorizados.",
  },
];

function textoObrigatorio(valor, campo) {
  const texto = String(valor || "").trim();
  if (!texto) throw new Error(`${campo} é obrigatório.`);
  return texto;
}

export function normalizarVinculoEmpresa(vinculo = {}) {
  const tenantId = textoObrigatorio(vinculo.tenantId, "Empresa");
  const perfilId = textoObrigatorio(vinculo.perfilId, "Perfil");
  const equipes = [...new Set((vinculo.equipes || []).map(String).filter(Boolean))];
  return {
    tenantId,
    tenantNome: String(vinculo.tenantNome || tenantId).trim(),
    perfilId,
    equipes,
    status: vinculo.status === "inativo" ? "inativo" : "ativo",
  };
}

export function obterVinculoAtivo(vinculos = [], tenantId) {
  return vinculos
    .map(normalizarVinculoEmpresa)
    .find((vinculo) => vinculo.tenantId === tenantId && vinculo.status === "ativo") || null;
}

export function validarSelecaoEmpresa(vinculos = [], tenantId, teamId = "") {
  const vinculo = obterVinculoAtivo(vinculos, tenantId);
  if (!vinculo) throw new Error("O usuário não possui vínculo ativo com a empresa selecionada.");
  if (teamId && !vinculo.equipes.includes(teamId)) {
    throw new Error("A equipe selecionada não pertence ao vínculo ativo do usuário.");
  }
  return {
    tenantId: vinculo.tenantId,
    tenantNome: vinculo.tenantNome,
    teamId: String(teamId || ""),
    perfilId: vinculo.perfilId,
  };
}

export function criarContextoCorporativo({ vinculos = [], tenantId = "", teamId = "" } = {}) {
  const normalizados = vinculos.map(normalizarVinculoEmpresa);
  if (!normalizados.length) throw new Error("A sessão não possui vínculo com nenhuma empresa.");
  const empresaInicial = tenantId || normalizados.find((item) => item.status === "ativo")?.tenantId;
  return validarSelecaoEmpresa(normalizados, empresaInicial, teamId);
}

export function aplicarPropriedadeCorporativa(registro, contexto, {
  manterIdentificador = true,
  criadoPor = "",
  agora = new Date().toISOString(),
} = {}) {
  if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
    throw new Error("Registro corporativo inválido.");
  }
  const tenantId = textoObrigatorio(contexto?.tenantId, "Empresa");
  return {
    ...(manterIdentificador && registro.id ? { id: registro.id } : {}),
    ...registro,
    tenantId,
    teamId: String(contexto?.teamId || registro.teamId || ""),
    criadoPor: String(registro.criadoPor || criadoPor || ""),
    criadoEm: registro.criadoEm || agora,
    atualizadoEm: agora,
  };
}

export function validarIsolamentoRegistro(registro, contexto) {
  if (!registro?.tenantId) return { permitido: false, motivo: "Registro sem empresa proprietária." };
  if (!contexto?.tenantId) return { permitido: false, motivo: "Contexto corporativo ausente." };
  if (registro.tenantId !== contexto.tenantId) {
    return { permitido: false, motivo: "Registro pertence a outra empresa." };
  }
  if (registro.teamId && contexto.teamId && registro.teamId !== contexto.teamId) {
    return { permitido: false, motivo: "Registro pertence a outra equipe." };
  }
  return { permitido: true, motivo: "" };
}

export function criarChaveObjetoCorporativo(contexto, categoria, nomeArquivo) {
  const tenantId = textoObrigatorio(contexto?.tenantId, "Empresa");
  const categoriaSegura = textoObrigatorio(categoria, "Categoria")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .toLowerCase();
  const nomeSeguro = textoObrigatorio(nomeArquivo, "Nome do arquivo")
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `tenants/${encodeURIComponent(tenantId)}/${categoriaSegura}/${nomeSeguro}`;
}
