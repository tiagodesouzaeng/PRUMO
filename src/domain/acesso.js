export const PERMISSOES_PRUMO = [
  "sistema.consultar",
  "orcamento.editar",
  "orcamento.importar",
  "orcamento.exportar",
  "orcamento.revisar",
  "orcamento.aprovar",
  "medicao.registrar",
  "medicao.aprovar",
  "bases.importar",
  "bases.administrar",
  "usuarios.administrar",
  "auditoria.consultar",
  "migracao.administrar",
  "trabalho.consultar",
  "trabalho.administrar",
  "repositorio.transicionar",
];

const TODAS_PERMISSOES = [...PERMISSOES_PRUMO];

export const PERFIS_ACESSO_PRUMO = [
  {
    id: "administrador",
    nome: "Administrador",
    descricao: "Configura a plataforma, usuários, bases, auditoria e todos os módulos.",
    permissoes: TODAS_PERMISSOES,
  },
  {
    id: "gestor",
    nome: "Gestor de Engenharia",
    descricao: "Coordena orçamentos, revisões, medições e aprovações técnicas.",
    permissoes: [
      "sistema.consultar", "orcamento.editar", "orcamento.importar",
      "orcamento.exportar", "orcamento.revisar", "orcamento.aprovar",
      "medicao.registrar", "medicao.aprovar", "auditoria.consultar",
    ],
  },
  {
    id: "orcamentista",
    nome: "Orçamentista",
    descricao: "Elabora orçamentos, composições e pacotes de licitação.",
    permissoes: [
      "sistema.consultar", "orcamento.editar", "orcamento.importar",
      "orcamento.exportar", "orcamento.revisar", "bases.importar",
    ],
  },
  {
    id: "fiscal",
    nome: "Fiscal de Obras",
    descricao: "Consulta contratos e registra medições, retenções e documentos.",
    permissoes: [
      "sistema.consultar", "orcamento.exportar", "medicao.registrar",
      "auditoria.consultar",
    ],
  },
  {
    id: "aprovador",
    nome: "Aprovador",
    descricao: "Analisa e aprova orçamentos e medições sem alterar custos.",
    permissoes: [
      "sistema.consultar", "orcamento.exportar", "orcamento.aprovar",
      "medicao.aprovar", "auditoria.consultar",
    ],
  },
  {
    id: "consulta",
    nome: "Consulta",
    descricao: "Acesso somente para leitura e exportações autorizadas.",
    permissoes: ["sistema.consultar", "orcamento.exportar"],
  },
];

export function obterPerfilAcesso(perfilId) {
  return PERFIS_ACESSO_PRUMO.find((perfil) => perfil.id === perfilId) || null;
}

export function possuiPermissao(perfilOuId, permissao) {
  const perfil = typeof perfilOuId === "string"
    ? obterPerfilAcesso(perfilOuId)
    : perfilOuId;
  return Boolean(perfil?.permissoes?.includes(permissao));
}

export function criarSessaoMemoria() {
  let sessao = null;
  const ouvintes = new Set();
  const notificar = () => ouvintes.forEach((ouvinte) => ouvinte(sessao));

  return {
    obter: () => sessao,
    iniciar({
      usuario,
      perfilId,
      vinculos = [],
      tenantId = "",
      teamId = "",
      accessToken = "",
      expiraEm = "",
    }) {
      const vinculosNormalizados = vinculos.length
        ? vinculos.map((vinculo) => ({ ...vinculo }))
        : (tenantId ? [{ tenantId, tenantNome: tenantId, perfilId, equipes: teamId ? [teamId] : [] }] : []);
      const vinculoAtivo = vinculosNormalizados.find((vinculo) => (
        vinculo.tenantId === (tenantId || vinculosNormalizados[0]?.tenantId)
      ));
      const perfil = obterPerfilAcesso(vinculoAtivo?.perfilId || perfilId);
      if (!usuario?.id || !perfil) throw new Error("Usuário ou perfil de acesso inválido.");
      sessao = {
        usuario: {
          id: usuario.id,
          nome: usuario.nome || usuario.id,
          email: usuario.email || "",
        },
        perfil,
        vinculos: vinculosNormalizados,
        tenantId: vinculoAtivo?.tenantId || "",
        tenantNome: vinculoAtivo?.tenantNome || vinculoAtivo?.tenantId || "",
        teamId: teamId || "",
        accessToken,
        expiraEm,
        iniciadaEm: new Date().toISOString(),
      };
      notificar();
      return sessao;
    },
    encerrar() {
      sessao = null;
      notificar();
    },
    pode(permissao) {
      return possuiPermissao(sessao?.perfil, permissao);
    },
    selecionarEmpresa(tenantId, teamId = "") {
      if (!sessao) throw new Error("Não existe sessão ativa.");
      const vinculo = sessao.vinculos.find((item) => (
        item.tenantId === tenantId && item.status !== "inativo"
      ));
      if (!vinculo) throw new Error("O usuário não possui vínculo ativo com a empresa selecionada.");
      if (teamId && !(vinculo.equipes || []).includes(teamId)) {
        throw new Error("A equipe selecionada não pertence ao vínculo ativo do usuário.");
      }
      const perfil = obterPerfilAcesso(vinculo.perfilId);
      if (!perfil) throw new Error("O vínculo selecionado não possui um perfil válido.");
      sessao = {
        ...sessao,
        tenantId: vinculo.tenantId,
        tenantNome: vinculo.tenantNome || vinculo.tenantId,
        teamId,
        perfil,
      };
      notificar();
      return sessao;
    },
    contextoCorporativo() {
      if (!sessao?.tenantId) return null;
      return {
        tenantId: sessao.tenantId,
        tenantNome: sessao.tenantNome,
        teamId: sessao.teamId,
        usuarioId: sessao.usuario.id,
        perfilId: sessao.perfil.id,
        accessToken: sessao.accessToken,
      };
    },
    observar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    serializarIdentidade() {
      if (!sessao) return null;
      return {
        usuario: sessao.usuario,
        perfilId: sessao.perfil.id,
        tenantId: sessao.tenantId,
        tenantNome: sessao.tenantNome,
        teamId: sessao.teamId,
        iniciadaEm: sessao.iniciadaEm,
        expiraEm: sessao.expiraEm,
      };
    },
  };
}
