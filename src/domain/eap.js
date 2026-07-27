export const EAP_NIVEIS = [
  { id: "site", label: "Site", nivel: 1, exemplo: "1, 2, 3..." },
  { id: "predio", label: "Prédio", nivel: 2, exemplo: "1.1, 1.2, 2.1..." },
  { id: "andar", label: "Andar", nivel: 3, exemplo: "1.1.1, 1.1.2, 3.2.1..." },
  { id: "sala", label: "Sala", nivel: 4, exemplo: "1.1.1.1, 1.1.1.2, 2.1.2.1..." },
  { id: "disciplina", label: "Disciplina", nivel: 5, exemplo: "1.1.1.1.1..." },
];

export function nivelEapPorProfundidade(profundidade = 1) {
  return EAP_NIVEIS[Math.max(0, Math.min(EAP_NIVEIS.length - 1, profundidade - 1))];
}

export function nivelEapAnterior(nivel) {
  const indice = EAP_NIVEIS.findIndex((item) => item.id === nivel);
  return indice > 0 ? EAP_NIVEIS[indice - 1].id : "";
}

function prepararItens(itens) {
  const grupos = itens.filter((item) => item.tipo === "grupo");
  const gruposPorCodigo = [...grupos].sort(
    (a, b) => String(b.codigo).length - String(a.codigo).length,
  );
  const idsGrupos = new Set(grupos.map((item) => item.id));

  return itens.map((item, indice) => {
    let parentId = idsGrupos.has(item.parentId) ? item.parentId : "";
    if (!parentId && item.tipo !== "grupo") {
      parentId = gruposPorCodigo.find(
        (grupo) => String(item.codigo).startsWith(`${grupo.codigo}.`),
      )?.id || "";
    }
    return {
      ...item,
      parentId,
      nivelEap: item.tipo === "grupo"
        ? (item.nivelEap || nivelEapPorProfundidade(String(item.codigo || "1").split(".").length).id)
        : "",
      __indice: indice,
    };
  });
}

export function reclassificarEap(itens = []) {
  const preparados = prepararItens(itens);
  const ids = new Set(preparados.map((item) => item.id));
  const filhos = new Map();

  preparados.forEach((item) => {
    const parentId = ids.has(item.parentId) ? item.parentId : "";
    const grupo = filhos.get(parentId) || [];
    grupo.push({ ...item, parentId });
    filhos.set(parentId, grupo);
  });

  filhos.forEach((grupo) => grupo.sort((a, b) => {
    const ordemA = Number.isFinite(a.ordemEap) ? a.ordemEap : a.__indice;
    const ordemB = Number.isFinite(b.ordemEap) ? b.ordemEap : b.__indice;
    return ordemA - ordemB;
  }));

  const resultado = [];
  const visitados = new Set();
  function visitar(parentId = "", prefixo = "", profundidade = 1) {
    (filhos.get(parentId) || []).forEach((item, indice) => {
      if (visitados.has(item.id)) return;
      visitados.add(item.id);
      const codigo = prefixo ? `${prefixo}.${indice + 1}` : String(indice + 1);
      const { __indice, ...limpo } = item;
      const nivelEap = item.tipo === "grupo"
        ? nivelEapPorProfundidade(profundidade).id
        : "";
      resultado.push({ ...limpo, codigo, ordemEap: indice, nivelEap });
      visitar(item.id, codigo, profundidade + 1);
    });
  }
  visitar();

  preparados
    .filter((item) => !visitados.has(item.id))
    .forEach((item) => {
      const { __indice, ...limpo } = item;
      resultado.push({
        ...limpo,
        parentId: "",
        codigo: String(resultado.length + 1),
        nivelEap: item.tipo === "grupo" ? "site" : "",
      });
    });
  return resultado;
}

export function moverItemEap(itens, itemId, direcao) {
  const normalizados = reclassificarEap(itens);
  const atual = normalizados.find((item) => item.id === itemId);
  if (!atual) return normalizados;
  const irmaos = normalizados.filter((item) => item.parentId === atual.parentId);
  const indice = irmaos.findIndex((item) => item.id === itemId);
  const destino = indice + direcao;
  if (destino < 0 || destino >= irmaos.length) return normalizados;

  const ordem = irmaos.map((item) => item.id);
  [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
  const posicoes = new Map(ordem.map((id, itemIndex) => [id, itemIndex]));
  return reclassificarEap(normalizados.map((item) => (
    item.parentId === atual.parentId
      ? { ...item, ordemEap: posicoes.get(item.id) }
      : item
  )));
}

export function descendentesEap(itens, itemId) {
  const ids = new Set([itemId]);
  let encontrou = true;
  while (encontrou) {
    encontrou = false;
    itens.forEach((item) => {
      if (!ids.has(item.id) && ids.has(item.parentId)) {
        ids.add(item.id);
        encontrou = true;
      }
    });
  }
  ids.delete(itemId);
  return ids;
}
