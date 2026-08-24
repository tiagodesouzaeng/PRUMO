export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export function resolverPrecoPorUf(precosPorUf = {}, ufPreferida = "RS") {
  const uf = UFS_BRASIL.includes(ufPreferida) ? ufPreferida : "RS";
  const precoUf = Number(precosPorUf[uf]) || 0;
  const precoSp = Number(precosPorUf.SP) || 0;
  return {
    preco: precoUf > 0 ? precoUf : precoSp,
    semPreco: precoUf <= 0 && precoSp <= 0,
    ufPrecoEfetivo: precoUf > 0 ? uf : (precoSp > 0 ? "SP" : uf),
    precoSubstituidoSp: precoUf <= 0 && precoSp > 0 && uf !== "SP",
  };
}

export function aplicarPrecoPorUf(referencia, ufPreferida = "RS") {
  if (!referencia?.precosPorUf) return referencia;
  const precoResolvido = resolverPrecoPorUf(referencia.precosPorUf, ufPreferida);
  const percentualMaoObra = Number(
    referencia.percentuaisMaoObraPorUf?.[precoResolvido.ufPrecoEfetivo]
      ?? referencia.percentualMaoObra,
  ) || 0;
  const custoMaoObra = precoResolvido.preco * percentualMaoObra;
  return {
    ...referencia,
    ...precoResolvido,
    percentualMaoObra,
    custoMaoObra,
    custoMaterial: precoResolvido.preco - custoMaoObra,
  };
}

export function gerarRelatorioPrecosPorUf(precosPorUf = {}, ufs = UFS_BRASIL) {
  const precoSp = Number(precosPorUf.SP) || 0;
  const linhas = ufs.map((uf) => {
    const precoPublicado = Number(precosPorUf[uf]) || 0;
    const usaReferenciaSp = precoPublicado <= 0 && precoSp > 0 && uf !== "SP";
    return {
      uf,
      precoPublicado,
      precoUtilizado: precoPublicado > 0 ? precoPublicado : (usaReferenciaSp ? precoSp : 0),
      situacao: precoPublicado > 0 ? "publicado" : (usaReferenciaSp ? "referencia_sp" : "sem_preco"),
      observacao: precoPublicado > 0
        ? "Preço oficial publicado para o estado."
        : usaReferenciaSp
          ? "Preço de SP utilizado como referência por ausência de publicação estadual."
          : "Nenhum preço disponível para o estado.",
    };
  });
  return {
    linhas,
    publicados: linhas.filter((linha) => linha.situacao === "publicado").length,
    referenciasSp: linhas.filter((linha) => linha.situacao === "referencia_sp").length,
    semPreco: linhas.filter((linha) => linha.situacao === "sem_preco").length,
  };
}

export function mesclarReferenciasSinapi(pacotes = []) {
  const catalogo = new Map();
  pacotes.forEach(({ base = {}, referencias = [] }) => {
    referencias.forEach((referencia) => {
      const chave = `${referencia.tipo}:${referencia.codigo}`;
      const atual = catalogo.get(chave);
      const precosPorUf = {
        ...(atual?.precosPorUf || {}),
        ...(referencia.precosPorUf || {}),
      };
      const percentuaisMaoObraPorUf = {
        ...(atual?.percentuaisMaoObraPorUf || {}),
        ...(referencia.percentuaisMaoObraPorUf || {}),
      };
      if (
        base.uf
        && !["NACIONAL", "GERAL"].includes(base.uf)
        && Number(referencia.preco) > 0
        && !Number(precosPorUf[base.uf])
      ) {
        precosPorUf[base.uf] = referencia.preco;
      }
      catalogo.set(chave, {
        ...(atual || referencia),
        ...referencia,
        precosPorUf,
        percentuaisMaoObraPorUf,
      });
    });
  });
  return [...catalogo.values()];
}
