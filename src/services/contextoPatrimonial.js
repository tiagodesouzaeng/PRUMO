export const CONTEXTO_PATRIMONIAL_VAZIO = { cliente: "", site: "", predio: "", sala: "" };

export function construirSelecaoPatrimonial(unidade, unidades) {
  if (!unidade) return { ...CONTEXTO_PATRIMONIAL_VAZIO };
  const porId = new Map(unidades.map((item) => [item.id, item]));
  const selecao = { ...CONTEXTO_PATRIMONIAL_VAZIO };
  let atual = unidade;
  while (atual) {
    selecao[atual.nivel] = atual.id;
    atual = atual.parentId ? porId.get(atual.parentId) : null;
  }
  return selecao;
}

export function idsNoEscopoPatrimonial(unidades, unidadeId) {
  if (!unidadeId) return new Set(unidades.map((item) => item.id));
  const ids = new Set([unidadeId]);
  let alterou = true;
  while (alterou) {
    alterou = false;
    unidades.forEach((item) => {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        alterou = true;
      }
    });
  }
  return ids;
}
