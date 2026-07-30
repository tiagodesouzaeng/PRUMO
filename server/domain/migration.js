import { createHash } from "node:crypto";

export const MIGRATION_CONTRACT_VERSION = 1;
export const MIGRATION_DOMAINS = new Set([
  "orcamentos",
  "composicoes-proprias",
  "bases-precos",
  "configuracoes",
]);

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

export function calcularHashPacote(conteudo) {
  return createHash("sha256").update(serializarDeterministico(conteudo)).digest("hex");
}

export function obterConteudoAssinado(pacote = {}) {
  return {
    contrato: pacote.contrato,
    tenantId: pacote.tenantId,
    teamId: pacote.teamId || "",
    usuarioId: pacote.usuarioId,
    criadoEm: pacote.criadoEm,
    dominios: pacote.dominios || [],
  };
}

export function validarPacoteNoServidor(pacote = {}, contexto = {}) {
  const erros = [];
  const conteudo = obterConteudoAssinado(pacote);
  if (conteudo.contrato !== MIGRATION_CONTRACT_VERSION) {
    erros.push("Versão do contrato incompatível.");
  }
  if (!conteudo.tenantId || conteudo.tenantId !== contexto.tenantId) {
    erros.push("A empresa do pacote diverge da empresa autenticada.");
  }
  if ((conteudo.teamId || "") !== (contexto.teamId || "")) {
    erros.push("A equipe do pacote diverge da equipe autenticada.");
  }
  if (!conteudo.usuarioId || conteudo.usuarioId !== contexto.identity?.subject) {
    erros.push("O responsável pelo pacote diverge do usuário autenticado.");
  }
  if (!conteudo.criadoEm || Number.isNaN(Date.parse(conteudo.criadoEm))) {
    erros.push("Data de criação inválida.");
  }

  const dominiosVistos = new Set();
  const contagens = {};
  conteudo.dominios.forEach((dominio) => {
    if (!MIGRATION_DOMAINS.has(dominio?.id)) {
      erros.push(`Domínio não suportado: ${dominio?.id || "não informado"}.`);
      return;
    }
    if (dominiosVistos.has(dominio.id)) erros.push(`Domínio duplicado: ${dominio.id}.`);
    dominiosVistos.add(dominio.id);
    const registros = Array.isArray(dominio.registros) ? dominio.registros : [];
    contagens[dominio.id] = registros.length;
    if (dominio.total !== registros.length) {
      erros.push(`${dominio.id}: contagem de registros divergente.`);
    }
    const ids = new Set();
    registros.forEach((registro, indice) => {
      if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
        erros.push(`${dominio.id}[${indice}]: registro inválido.`);
        return;
      }
      if (registro.tenantId !== contexto.tenantId) {
        erros.push(`${dominio.id}[${indice}]: registro destinado a outra empresa.`);
      }
      const origemId = String(registro.id || registro.codigo || "").trim();
      if (origemId && ids.has(origemId)) {
        erros.push(`${dominio.id}: identificador duplicado ${origemId}.`);
      }
      if (origemId) ids.add(origemId);
    });
  });

  const hashCalculado = calcularHashPacote(conteudo);
  if (pacote.hash !== hashCalculado) erros.push("O hash do conteúdo não confere.");
  const chaveEsperada = `migracao:${contexto.tenantId}:${hashCalculado}`;
  if (pacote.idempotencyKey !== chaveEsperada) {
    erros.push("A chave de idempotência não corresponde ao pacote.");
  }
  return {
    valido: erros.length === 0,
    erros,
    contagens,
    hashCalculado,
    conteudo,
  };
}
