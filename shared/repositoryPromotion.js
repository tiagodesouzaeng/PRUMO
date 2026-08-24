const CAMPOS_TECNICOS = new Set([
  "_corporativo", "tenantId", "teamId", "criadoPor", "criadoEm", "atualizadoPor",
  "atualizadoEm", "idOrigemMigracao", "loteMigracaoId", "versao",
]);

function limparTecnicos(valor) {
  if (Array.isArray(valor)) return valor.map(limparTecnicos);
  if (!valor || typeof valor !== "object") return valor;
  return Object.keys(valor).sort().reduce((resultado, chave) => {
    if (!CAMPOS_TECNICOS.has(chave)) resultado[chave] = limparTecnicos(valor[chave]);
    return resultado;
  }, {});
}

export function normalizarOrcamentoParaParidade(item = {}) {
  const dados = item.dados && typeof item.dados === "object" ? item.dados : item;
  return limparTecnicos({ nome: item.nome || dados.nome || "", dados });
}

export function ordenarManifestoRepositorio(registros = []) {
  return [...registros]
    .map((item) => ({ id: String(item.id || ""), hash: String(item.hash || "") }))
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
}

export function compararManifestosRepositorio(local = {}, corporativo = {}) {
  const mapaLocal = new Map((local.registros || []).map((item) => [String(item.id), item.hash]));
  const mapaCorporativo = new Map((corporativo.registros || []).map((item) => [String(item.id), item.hash]));
  const ausentes = [...mapaLocal.keys()].filter((id) => !mapaCorporativo.has(id));
  const excedentes = [...mapaCorporativo.keys()].filter((id) => !mapaLocal.has(id));
  const divergentes = [...mapaLocal.keys()].filter((id) => mapaCorporativo.has(id) && mapaLocal.get(id) !== mapaCorporativo.get(id));
  return {
    conforme: local.total === corporativo.total && local.hash === corporativo.hash && !ausentes.length && !excedentes.length && !divergentes.length,
    ausentes, excedentes, divergentes,
  };
}
