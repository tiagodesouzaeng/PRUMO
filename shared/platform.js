export const MODULOS_PLATAFORMA = [
  { id: "visao-geral", nome: "Visão Geral", ordem: 10 },
  { id: "obras", nome: "Obras e Contratos", ordem: 20 },
  { id: "orcamentos", nome: "Orçamentos e Composições", ordem: 30 },
  { id: "bases-precos", nome: "Bases de Preços", ordem: 40 },
  { id: "suprimentos", nome: "Suprimentos e Aquisições", ordem: 50 },
  { id: "medicoes", nome: "Medições e Fiscalização", ordem: 60 },
  { id: "manutencao", nome: "Manutenção", ordem: 70 },
  { id: "ppci", nome: "PPCI", ordem: 80 },
  { id: "utilidades", nome: "Consumos e Utilidades", ordem: 90 },
  { id: "documentos", nome: "Documentos e GED", ordem: 100 },
  { id: "relatorios", nome: "Relatórios", ordem: 110 },
  { id: "administracao", nome: "Administração", ordem: 120 },
];

export const PERMISSOES_PLATAFORMA = [
  { id: "plataforma.consultar", moduloId: "visao-geral" },
  { id: "empreendimento.consultar", moduloId: "obras" },
  { id: "empreendimento.editar", moduloId: "obras" },
  { id: "orcamento.consultar", moduloId: "orcamentos" },
  { id: "orcamento.editar", moduloId: "orcamentos" },
  { id: "orcamento.revisar", moduloId: "orcamentos" },
  { id: "orcamento.aprovar", moduloId: "orcamentos" },
  { id: "bases.consultar", moduloId: "bases-precos" },
  { id: "bases.administrar", moduloId: "bases-precos" },
  { id: "suprimentos.consultar", moduloId: "suprimentos" },
  { id: "suprimentos.editar", moduloId: "suprimentos" },
  { id: "medicao.consultar", moduloId: "medicoes" },
  { id: "medicao.registrar", moduloId: "medicoes" },
  { id: "medicao.aprovar", moduloId: "medicoes" },
  { id: "manutencao.consultar", moduloId: "manutencao" },
  { id: "manutencao.editar", moduloId: "manutencao" },
  { id: "ppci.consultar", moduloId: "ppci" },
  { id: "ppci.editar", moduloId: "ppci" },
  { id: "utilidades.consultar", moduloId: "utilidades" },
  { id: "documentos.consultar", moduloId: "documentos" },
  { id: "documentos.editar", moduloId: "documentos" },
  { id: "relatorios.consultar", moduloId: "relatorios" },
  { id: "administracao.acessar", moduloId: "administracao" },
  { id: "auditoria.consultar", moduloId: "administracao" },
  { id: "migracao.administrar", moduloId: "administracao" },
  { id: "trabalho.consultar", moduloId: "administracao" },
  { id: "trabalho.administrar", moduloId: "administracao" },
  { id: "repositorio.transicionar", moduloId: "administracao" },
];

const LEITURA = PERMISSOES_PLATAFORMA
  .filter((item) => item.id.endsWith(".consultar") || item.id === "plataforma.consultar")
  .map((item) => item.id);

export const PERMISSOES_PADRAO_POR_PERFIL = {
  administrador: PERMISSOES_PLATAFORMA.map((item) => item.id),
  gestor: [
    ...LEITURA,
    "empreendimento.editar",
    "orcamento.editar",
    "orcamento.revisar",
    "orcamento.aprovar",
    "suprimentos.editar",
    "medicao.registrar",
    "medicao.aprovar",
    "documentos.editar",
    "auditoria.consultar",
  ],
  orcamentista: [
    "plataforma.consultar",
    "empreendimento.consultar",
    "orcamento.consultar",
    "orcamento.editar",
    "orcamento.revisar",
    "bases.consultar",
    "suprimentos.consultar",
    "documentos.consultar",
  ],
  fiscal: [
    "plataforma.consultar",
    "empreendimento.consultar",
    "orcamento.consultar",
    "medicao.consultar",
    "medicao.registrar",
    "documentos.consultar",
    "documentos.editar",
  ],
  aprovador: [
    "plataforma.consultar",
    "empreendimento.consultar",
    "orcamento.consultar",
    "orcamento.aprovar",
    "medicao.consultar",
    "medicao.aprovar",
    "documentos.consultar",
    "auditoria.consultar",
  ],
  consulta: LEITURA,
};

export function obterPermissoesPerfil(perfilId) {
  return [...(PERMISSOES_PADRAO_POR_PERFIL[perfilId] || [])];
}

export function obterModulosPermitidos(permissoes = [], modulosAtivos = MODULOS_PLATAFORMA) {
  const ids = new Set(
    PERMISSOES_PLATAFORMA
      .filter((permissao) => permissoes.includes(permissao.id))
      .map((permissao) => permissao.moduloId),
  );
  return modulosAtivos.filter((modulo) => ids.has(modulo.id));
}
