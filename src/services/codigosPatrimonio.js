export const PREFIXOS_CODIGO_PATRIMONIAL = {
  cliente: "C",
  site: "S",
  predio: "P",
  sala: "SL",
};

export function sugerirCodigoPatrimonial(nivel, parentId, unidades = []) {
  const prefixo = PREFIXOS_CODIGO_PATRIMONIAL[nivel];
  if (!prefixo) return "";

  const expressao = new RegExp(`^${prefixo}-(\\d+)$`, "i");
  const numerosUsados = unidades
    .filter((item) => item.nivel === nivel)
    .filter((item) => nivel === "cliente" || item.parentId === parentId)
    .map((item) => String(item.codigo || "").trim().match(expressao))
    .filter(Boolean)
    .map((resultado) => Number(resultado[1]))
    .filter(Number.isSafeInteger);

  const proximo = Math.max(0, ...numerosUsados) + 1;
  return `${prefixo}-${String(proximo).padStart(2, "0")}`;
}
