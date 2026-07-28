function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function tipoReferencia(item = {}) {
  const tipo = String(
    item.referenciaTipo || item.itemTipo || item.tipo || "",
  ).toLocaleLowerCase("pt-BR");
  return tipo.includes("compos") ? "composicao" : "insumo";
}

function codigoReferencia(item = {}) {
  return String(item.referenciaCodigo || item.itemCodigo || item.codigo || "").trim();
}

function baseReferencia(item = {}, herdada = {}) {
  return {
    basePrecoId: item.basePrecoId || herdada.basePrecoId || "",
    baseTitulo: item.baseTitulo || herdada.baseTitulo || item.fonte?.split("·")[0]?.trim() || "Base própria",
    baseUf: item.baseUf || herdada.baseUf || "RS",
    baseReferencia: item.baseReferencia || herdada.baseReferencia || "",
  };
}

function chaveReferencia(item, base) {
  return `${base.basePrecoId || "propria"}:${codigoReferencia(item)}`;
}

function adicionarPendencia(pendencias, dados) {
  const chave = `${dados.tipo}:${dados.base || ""}:${dados.codigo || ""}:${dados.origem || ""}`;
  if (!pendencias.some((item) => item.chave === chave)) {
    pendencias.push({ ...dados, chave });
  }
}

export async function consolidarDemandaSuprimentos(
  orcamento,
  carregarItensComposicao,
) {
  const composicoesProprias = new Map(
    (orcamento.composicoes || []).map((item) => [String(item.codigo), item]),
  );
  const cache = new Map();
  const insumos = new Map();
  const pendencias = [];
  let composicoesExpandidas = 0;

  async function carregarComponentes(referencia, base) {
    const codigo = codigoReferencia(referencia);
    const propria = composicoesProprias.get(codigo);
    if (propria) return propria.componentes || [];
    if (!codigo || !base.basePrecoId || typeof carregarItensComposicao !== "function") {
      return [];
    }
    const chave = `${base.basePrecoId}:${codigo}:${base.baseUf}`;
    if (!cache.has(chave)) {
      cache.set(
        chave,
        Promise.resolve(carregarItensComposicao(base.basePrecoId, codigo, base.baseUf))
          .catch(() => []),
      );
    }
    return (await cache.get(chave)) || [];
  }

  function consolidarInsumo(item, base, quantidade, origem) {
    const codigo = codigoReferencia(item);
    if (!codigo) {
      adicionarPendencia(pendencias, {
        tipo: "referencia_incompleta",
        codigo: "",
        base: base.baseTitulo,
        origem,
        descricao: item.descricao || "Insumo sem código",
      });
      return;
    }
    const unidade = item.unidade || "—";
    const chave = `${base.basePrecoId || base.baseTitulo}:${codigo}:${unidade}`;
    const preco = numero(item.preco ?? item.unitario);
    const atual = insumos.get(chave) || {
      chave,
      codigo,
      descricao: item.descricao || codigo,
      unidade,
      base: base.baseTitulo,
      uf: base.baseUf,
      referencia: base.baseReferencia,
      quantidade: 0,
      preco,
      valorEstimado: 0,
      origens: new Set(),
    };
    atual.quantidade += quantidade;
    if (!atual.preco && preco) atual.preco = preco;
    atual.valorEstimado = atual.quantidade * atual.preco;
    atual.origens.add(origem);
    insumos.set(chave, atual);
    if (!atual.preco) {
      adicionarPendencia(pendencias, {
        tipo: "sem_preco",
        codigo,
        base: base.baseTitulo,
        origem,
        descricao: atual.descricao,
      });
    }
  }

  async function expandir(referencia, quantidade, contexto, trilha = []) {
    const base = baseReferencia(referencia, contexto.base);
    const codigo = codigoReferencia(referencia);
    if (tipoReferencia(referencia) !== "composicao") {
      consolidarInsumo(referencia, base, quantidade, contexto.origem);
      return;
    }
    const chave = chaveReferencia(referencia, base);
    if (trilha.includes(chave)) {
      adicionarPendencia(pendencias, {
        tipo: "ciclo",
        codigo,
        base: base.baseTitulo,
        origem: contexto.origem,
        descricao: referencia.descricao || codigo,
      });
      return;
    }
    const componentes = await carregarComponentes(referencia, base);
    if (!componentes.length) {
      adicionarPendencia(pendencias, {
        tipo: "composicao_sem_memoria",
        codigo,
        base: base.baseTitulo,
        origem: contexto.origem,
        descricao: referencia.descricao || codigo || "Composição sem referência",
      });
      return;
    }
    composicoesExpandidas += 1;
    for (const componente of componentes) {
      const coeficiente = numero(componente.coeficiente, 1);
      await expandir(
        componente,
        quantidade * coeficiente,
        { ...contexto, base },
        [...trilha, chave],
      );
    }
  }

  const servicos = (orcamento.itens || []).filter((item) => item.tipo !== "grupo");
  for (const servico of servicos) {
    await expandir(
      servico,
      numero(servico.quantidade),
      {
        origem: `${servico.codigo || servico.id} · ${servico.descricao}`,
        base: baseReferencia(servico),
      },
    );
  }

  const listaInsumos = [...insumos.values()]
    .map((item) => ({ ...item, origens: [...item.origens] }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  return {
    insumos: listaInsumos,
    pendencias,
    servicosProcessados: servicos.length,
    composicoesExpandidas,
    valorEstimado: listaInsumos.reduce((total, item) => total + item.valorEstimado, 0),
  };
}
