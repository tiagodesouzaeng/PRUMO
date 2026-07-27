const STORAGE_KEY = "prumo-composicoes-proprias-v1";

function ler() {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function gravar(composicoes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(composicoes));
  globalThis.dispatchEvent?.(new CustomEvent("prumo-composicoes-proprias"));
}

export function listarComposicoesProprias() {
  return ler();
}

export function salvarComposicaoPropria(dados) {
  const atuais = ler();
  const composicao = {
    ...dados,
    id: dados.id || `cpu-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
    atualizadoEm: new Date().toISOString(),
  };
  const indice = atuais.findIndex((item) => item.id === composicao.id);
  if (indice >= 0) atuais[indice] = composicao;
  else atuais.push(composicao);
  gravar(atuais);
  return composicao;
}

export function removerComposicaoPropria(composicaoId) {
  gravar(ler().filter((item) => item.id !== composicaoId));
}
