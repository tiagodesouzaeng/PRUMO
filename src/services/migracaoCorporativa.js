import { aplicarPropriedadeCorporativa } from "../domain/multiempresa.js";

export const VERSAO_CONTRATO_MIGRACAO = 1;

export const FONTES_LOCAIS_MIGRACAO = [
  {
    id: "orcamentos",
    nome: "Orçamentos, revisões e medições",
    origem: "localStorage",
    destino: "PostgreSQL",
    prioridade: 1,
  },
  {
    id: "composicoes-proprias",
    nome: "Composições próprias",
    origem: "localStorage",
    destino: "PostgreSQL",
    prioridade: 2,
  },
  {
    id: "bases-precos",
    nome: "Publicações e catálogos de preços",
    origem: "IndexedDB",
    destino: "PostgreSQL + armazenamento de objetos",
    prioridade: 3,
  },
  {
    id: "configuracoes",
    nome: "Configurações e integrações locais",
    origem: "localStorage",
    destino: "PostgreSQL + cofre de segredos",
    prioridade: 4,
  },
];

function ordenarValor(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarValor);
  if (!valor || typeof valor !== "object") return valor;
  return Object.keys(valor).sort().reduce((resultado, chave) => {
    resultado[chave] = ordenarValor(valor[chave]);
    return resultado;
  }, {});
}
export function serializarDeterministico(valor) {
  return JSON.stringify(ordenarValor(valor));
}

export async function calcularHashConteudo(valor, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) throw new Error("O ambiente não oferece cálculo criptográfico de hash.");
  const bytes = new TextEncoder().encode(serializarDeterministico(valor));
  const hash = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function inventariarDadosLocais({
  orcamentos = [],
  composicoesProprias = [],
  bases = [],
  configuracoes = [],
} = {}) {
  const contagens = {
    orcamentos: orcamentos.length,
    "composicoes-proprias": composicoesProprias.length,
    "bases-precos": bases.length,
    configuracoes: configuracoes.length,
  };
  return FONTES_LOCAIS_MIGRACAO.map((fonte) => ({
    ...fonte,
    total: contagens[fonte.id] || 0,
    status: (contagens[fonte.id] || 0) > 0 ? "pronto-para-validacao" : "sem-dados",
  }));
}

function obterRegistrosPorDominio(dados, dominioId) {
  const mapa = {
    orcamentos: dados.orcamentos || [],
    "composicoes-proprias": dados.composicoesProprias || [],
    "bases-precos": dados.bases || [],
    configuracoes: dados.configuracoes || [],
  };
  return mapa[dominioId] || [];
}

export async function criarPacoteMigracao({
  contexto,
  dados = {},
  usuarioId = contexto?.usuarioId || "",
  criadoEm = new Date().toISOString(),
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!contexto?.tenantId) throw new Error("A migração exige uma empresa de destino.");
  if (!usuarioId) throw new Error("A migração exige um usuário responsável.");

  const dominios = FONTES_LOCAIS_MIGRACAO.map((fonte) => {
    const registros = obterRegistrosPorDominio(dados, fonte.id).map((registro) => (
      aplicarPropriedadeCorporativa(registro, contexto, { criadoPor: usuarioId, agora: criadoEm })
    ));
    return {
      id: fonte.id,
      total: registros.length,
      registros,
    };
  });

  const conteudo = {
    contrato: VERSAO_CONTRATO_MIGRACAO,
    tenantId: contexto.tenantId,
    teamId: contexto.teamId || "",
    usuarioId,
    criadoEm,
    dominios,
  };
  const hash = await calcularHashConteudo(conteudo, cryptoImpl);
  return {
    ...conteudo,
    hash,
    idempotencyKey: `migracao:${contexto.tenantId}:${hash}`,
  };
}

export function validarPacoteMigracao(pacote) {
  const erros = [];
  if (pacote?.contrato !== VERSAO_CONTRATO_MIGRACAO) erros.push("Versão do contrato incompatível.");
  if (!pacote?.tenantId) erros.push("Empresa de destino não informada.");
  if (!pacote?.usuarioId) erros.push("Usuário responsável não informado.");
  if (!pacote?.hash || !pacote?.idempotencyKey) erros.push("Memória de integridade ausente.");

  (pacote?.dominios || []).forEach((dominio) => {
    if (dominio.total !== dominio.registros?.length) {
      erros.push(`${dominio.id}: contagem de registros divergente.`);
    }
    (dominio.registros || []).forEach((registro) => {
      if (registro.tenantId !== pacote.tenantId) {
        erros.push(`${dominio.id}: registro destinado a outra empresa.`);
      }
    });
  });

  return { valido: erros.length === 0, erros };
}

export function criarPlanoMigracao(inventario = []) {
  return [...inventario]
    .sort((a, b) => a.prioridade - b.prioridade)
    .map((dominio) => ({
      dominioId: dominio.id,
      titulo: dominio.nome,
      total: dominio.total,
      etapas: [
        "Inventariar e validar dados locais",
        "Gerar pacote com hash e chave de idempotência",
        "Enviar para área temporária corporativa",
        "Validar propriedade, referências e contagens",
        "Publicar e conferir o resultado",
      ],
      permiteRetorno: true,
      situacao: dominio.total ? "Aguardando API corporativa" : "Sem dados locais",
    }));
}
