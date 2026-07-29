export function chaveComposicao(item = {}) {
  const basePrecoId = item.basePrecoId || "";
  const codigo = item.codigo || item.referenciaCodigo || item.itemCodigo || "";
  return `${basePrecoId}:${codigo}`;
}

export function avaliarComponenteComposicao(componente = {}, trilha = []) {
  const tipo = componente.referenciaTipo || componente.itemTipo || "";
  const codigo = componente.referenciaCodigo || componente.itemCodigo || "";
  const basePrecoId = componente.basePrecoId || trilha.at(-1)?.basePrecoId || "";
  const coeficiente = Number(componente.coeficiente) || 0;
  const preco = Number(componente.preco) || 0;
  const ciclo = tipo === "composicao" && trilha.some(
    (nivel) => chaveComposicao(nivel) === chaveComposicao({ basePrecoId, codigo }),
  );
  const pendencias = [];
  if (!tipo) pendencias.push("Tipo da referência não informado");
  if (!codigo) pendencias.push("Código da referência não informado");
  if (coeficiente <= 0) pendencias.push("Coeficiente inválido ou zerado");
  if (preco <= 0) pendencias.push("Preço básico não localizado");
  if (ciclo) pendencias.push("Ciclo entre composições detectado");
  return {
    tipo,
    codigo,
    basePrecoId,
    coeficiente,
    preco,
    ciclo,
    pendencias,
    valido: pendencias.length === 0,
  };
}

export function resumirQualidadeComposicao(componentes = [], trilha = []) {
  const avaliacoes = componentes.map((item) => avaliarComponenteComposicao(item, trilha));
  return {
    avaliacoes,
    componentes: componentes.length,
    pendencias: avaliacoes.reduce((total, item) => total + item.pendencias.length, 0),
    itensComPendencia: avaliacoes.filter((item) => !item.valido).length,
    ciclos: avaliacoes.filter((item) => item.ciclo).length,
    completa: componentes.length > 0 && avaliacoes.every((item) => item.valido),
  };
}
