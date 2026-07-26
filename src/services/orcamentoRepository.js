import {
  normalizarOrcamento,
  ORCAMENTOS_INICIAIS,
  ORCAMENTO_STORAGE_VERSION,
} from "../domain/orcamento";

const STORAGE_KEY = "prumo.orcamentos";
const ACTIVE_STORAGE_KEY = "prumo.orcamentos.ativo";

function copiarIniciais() {
  return structuredClone(ORCAMENTOS_INICIAIS).map(normalizarOrcamento);
}

export function carregarOrcamentos() {
  try {
    const conteudo = localStorage.getItem(STORAGE_KEY);
    if (!conteudo) return copiarIniciais();

    const registro = JSON.parse(conteudo);
    if (!Array.isArray(registro.orcamentos)) {
      return copiarIniciais();
    }

    return registro.orcamentos.map(normalizarOrcamento);
  } catch (error) {
    console.warn("Não foi possível restaurar os orçamentos locais.", error);
    return copiarIniciais();
  }
}

export function salvarOrcamentos(orcamentos) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: ORCAMENTO_STORAGE_VERSION,
        atualizadoEm: new Date().toISOString(),
        orcamentos,
      }),
    );
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os orçamentos locais.", error);
    return false;
  }
}

export function carregarOrcamentoAtivo() {
  return localStorage.getItem(ACTIVE_STORAGE_KEY) || "";
}

export function salvarOrcamentoAtivo(orcamentoId) {
  if (orcamentoId) localStorage.setItem(ACTIVE_STORAGE_KEY, orcamentoId);
}

export function restaurarOrcamentos() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_STORAGE_KEY);
  return copiarIniciais();
}
