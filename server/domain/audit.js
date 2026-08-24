import { createHash } from "node:crypto";

const CAMPOS_SENSIVEIS = /(^|_)(authorization|cookie|credential|credencial|password|senha|secret|segredo|token|privatekey|chaveprivada)($|_)/i;
const VALOR_PROTEGIDO = "[PROTEGIDO]";

function chaveCanonica(valor) {
  if (Array.isArray(valor)) return valor.map(chaveCanonica);
  if (!valor || typeof valor !== "object") return valor;
  return Object.fromEntries(
    Object.keys(valor)
      .sort()
      .map((chave) => [chave, chaveCanonica(valor[chave])]),
  );
}

export function sanitizarDadosAuditoria(valor, profundidade = 0) {
  if (valor == null || typeof valor === "boolean" || typeof valor === "number") return valor;
  if (typeof valor === "string") return valor.length > 4000 ? `${valor.slice(0, 4000)}…` : valor;
  if (profundidade >= 8) return "[LIMITE_DE_PROFUNDIDADE]";
  if (Array.isArray(valor)) {
    return valor.slice(0, 200).map((item) => sanitizarDadosAuditoria(item, profundidade + 1));
  }
  if (typeof valor !== "object") return String(valor);
  return Object.fromEntries(
    Object.entries(valor).map(([chave, conteudo]) => [
      chave,
      CAMPOS_SENSIVEIS.test(chave)
        ? VALOR_PROTEGIDO
        : sanitizarDadosAuditoria(conteudo, profundidade + 1),
    ]),
  );
}

export function criarHashAuditoria(evento, hashAnterior = "") {
  const conteudo = JSON.stringify(chaveCanonica({
    hashAnterior,
    tenantId: evento.tenantId,
    teamId: evento.teamId || "",
    moduleId: evento.moduleId,
    action: evento.action,
    entityType: evento.entityType,
    entityId: evento.entityId,
    actorId: evento.actorId,
    result: evento.result || "sucesso",
    before: evento.before ?? null,
    after: evento.after ?? null,
    metadata: evento.metadata || {},
    createdAt: evento.createdAt,
  }));
  return createHash("sha256").update(conteudo).digest("hex");
}

export function normalizarFiltrosAuditoria(filtros = {}) {
  const limite = Math.min(Math.max(Number(filtros.limite) || 50, 1), 200);
  const deslocamento = Math.max(Number(filtros.deslocamento) || 0, 0);
  const dataInicial = String(filtros.dataInicial || "").trim();
  const dataFinal = String(filtros.dataFinal || "").trim();
  return {
    moduleId: String(filtros.moduleId || "").trim(),
    action: String(filtros.action || "").trim(),
    actorId: String(filtros.actorId || "").trim(),
    entityType: String(filtros.entityType || "").trim(),
    entityId: String(filtros.entityId || "").trim(),
    dataInicial: Number.isNaN(Date.parse(dataInicial)) ? "" : dataInicial,
    dataFinal: Number.isNaN(Date.parse(dataFinal)) ? "" : dataFinal,
    limite,
    deslocamento,
  };
}

function campoCsv(valor) {
  const texto = valor == null
    ? ""
    : typeof valor === "object"
      ? JSON.stringify(valor)
      : String(valor);
  return `"${texto.replaceAll('"', '""')}"`;
}

export function exportarAuditoriaCsv(eventos = []) {
  const cabecalho = [
    "sequencia",
    "data",
    "modulo",
    "acao",
    "entidade",
    "identificador",
    "usuario",
    "resultado",
    "antes",
    "depois",
    "hash_anterior",
    "hash",
  ];
  const linhas = eventos.map((evento) => [
    evento.sequencia,
    evento.criadoEm,
    evento.moduleId,
    evento.acao,
    evento.entidadeTipo,
    evento.entidadeId,
    evento.usuarioId,
    evento.resultado,
    evento.antes,
    evento.depois,
    evento.hashAnterior,
    evento.hash,
  ].map(campoCsv).join(";"));
  return `\uFEFF${[cabecalho.map(campoCsv).join(";"), ...linhas].join("\r\n")}`;
}
