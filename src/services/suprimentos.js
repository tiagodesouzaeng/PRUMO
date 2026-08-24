import { obterCronogramaProposto } from "../domain/orcamento.js";

function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function dataCompra(dataConsumo, antecedenciaDias) {
  const data = new Date(`${dataConsumo}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() - Math.max(0, Math.round(numero(antecedenciaDias))));
  return data.toISOString().slice(0, 10);
}

export function calcularCoberturaSuprimentos(planoCompras = [], configuracao = {}) {
  const estoquesPorItem = configuracao.estoquesPorItem || {};
  const pedidos = (configuracao.pedidos || []).filter((pedido) => (
    pedido.status !== "Cancelado"
    && numero(pedido.quantidade) > 0
    && pedido.insumoChave
    && pedido.entregaEm
  ));
  const acumulados = new Map();
  return [...planoCompras]
    .sort((a, b) => (
      a.consumoEm.localeCompare(b.consumoEm)
      || a.descricao.localeCompare(b.descricao, "pt-BR")
    ))
    .map((demanda) => {
      const atual = acumulados.get(demanda.insumoChave) || {
        demanda: 0,
        estoqueInicial: Math.max(0, numero(estoquesPorItem[demanda.insumoChave])),
      };
      atual.demanda += numero(demanda.quantidade);
      acumulados.set(demanda.insumoChave, atual);
      const pedidosRecebidos = pedidos
        .filter((pedido) => (
          pedido.insumoChave === demanda.insumoChave
          && pedido.entregaEm <= demanda.consumoEm
        ))
        .reduce((total, pedido) => total + numero(pedido.quantidade), 0);
      const disponivel = atual.estoqueInicial + pedidosRecebidos;
      const saldoProjetado = disponivel - atual.demanda;
      return {
        ...demanda,
        estoqueInicial: atual.estoqueInicial,
        pedidosRecebidos,
        demandaAcumulada: atual.demanda,
        saldoProjetado: Math.max(0, saldoProjetado),
        faltaProjetada: Math.max(0, -saldoProjetado),
        statusCobertura: saldoProjetado < 0 ? "Ruptura" : "Coberto",
      };
    });
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

function normalizarTexto(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function chaveReferencia(item, base) {
  return `${base.basePrecoId || "propria"}:${codigoReferencia(item)}`;
}

function ehMaoObra(item = {}) {
  const tipo = String(
    item.referenciaTipo || item.itemTipo || item.tipo || "",
  ).toLocaleLowerCase("pt-BR");
  const unidade = String(item.unidade || "").toUpperCase();
  return tipo.includes("mao")
    || ["H", "HH", "HORA", "HOMEM-HORA"].includes(unidade);
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
  basesDisponiveis = [],
) {
  const configuracao = orcamento.suprimentosConfig || {};
  const regrasPorItem = configuracao.regrasPorItem || {};
  const composicoesProprias = new Map(
    (orcamento.composicoes || []).map((item) => [String(item.codigo), item]),
  );
  const cache = new Map();
  const insumos = new Map();
  const maoObra = new Map();
  const pendencias = [];
  let composicoesExpandidas = 0;

  function resolverBase(base) {
    if (base.basePrecoId || !basesDisponiveis.length) return base;
    const fonteProcurada = normalizarTexto(base.baseTitulo).split(/\s|·/)[0];
    const candidatas = basesDisponiveis.filter((item) => {
      if (item.status === "excluida") return false;
      const fonte = normalizarTexto(item.fonte || item.titulo).split(/\s|·/)[0];
      return fonte === fonteProcurada;
    });
    const porReferencia = base.baseReferencia
      ? candidatas.filter((item) => item.referencia === base.baseReferencia)
      : candidatas;
    const porEstado = porReferencia.filter((item) => (
      item.uf === "NACIONAL"
      || item.uf === base.baseUf
      || item.ufsDisponiveis?.includes(base.baseUf)
    ));
    const encontrada = porEstado[0] || porReferencia[0] || candidatas[0];
    if (!encontrada) return base;
    return {
      ...base,
      basePrecoId: encontrada.id,
      baseTitulo: encontrada.titulo || base.baseTitulo,
      baseUf: base.baseUf || encontrada.uf,
      baseReferencia: base.baseReferencia || encontrada.referencia,
    };
  }

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

  function consolidarInsumo(item, base, quantidade, contexto) {
    const codigo = codigoReferencia(item);
    if (!codigo) {
      adicionarPendencia(pendencias, {
        tipo: "referencia_incompleta",
        codigo: "",
        base: base.baseTitulo,
        origem: contexto.origem,
        descricao: item.descricao || "Insumo sem código",
      });
      return;
    }
    const unidade = item.unidade || "—";
    const chaveOrigem = `${base.basePrecoId || base.baseTitulo}:${codigo}:${unidade}`;
    const regra = regrasPorItem[chaveOrigem] || {};
    const fatorConversao = Math.max(0.00000001, numero(regra.fatorConversao, 1));
    const perdaPercentual = Math.max(0, numero(regra.perdaPercentual));
    const quantidadeConvertida = quantidade * fatorConversao;
    const quantidadePlanejada = quantidadeConvertida * (1 + (perdaPercentual / 100));
    const codigoPlanejado = String(regra.codigoSubstituto || codigo).trim();
    const descricaoPlanejada = String(
      regra.descricaoSubstituto || item.descricao || codigoPlanejado,
    ).trim();
    const unidadePlanejada = String(regra.unidadeDestino || unidade).trim();
    const basePlanejada = String(regra.baseSubstituta || base.baseTitulo).trim();
    const precoOriginal = numero(item.preco ?? item.unitario);
    const preco = regra.precoSubstituto === "" || regra.precoSubstituto == null
      ? precoOriginal
      : Math.max(0, numero(regra.precoSubstituto));
    const chave = `${basePlanejada}:${codigoPlanejado}:${unidadePlanejada}`;
    const atual = insumos.get(chave) || {
      chave,
      chaveOriginal: chaveOrigem,
      chavesOrigem: new Set(),
      codigo: codigoPlanejado,
      codigoOriginal: codigo,
      descricao: descricaoPlanejada,
      descricaoOriginal: item.descricao || codigo,
      unidade: unidadePlanejada,
      unidadeOriginal: unidade,
      base: basePlanejada,
      baseOriginal: base.baseTitulo,
      uf: base.baseUf,
      referencia: base.baseReferencia,
      quantidadeOriginal: 0,
      quantidadeConvertida: 0,
      quantidade: 0,
      preco,
      valorEstimado: 0,
      fatorConversao,
      perdaPercentual,
      justificativaEquivalencia: regra.justificativa || "",
      regrasAplicadas: [],
      origens: new Set(),
      origensDetalhadas: [],
    };
    atual.chavesOrigem.add(chaveOrigem);
    atual.quantidadeOriginal += quantidade;
    atual.quantidadeConvertida += quantidadeConvertida;
    atual.quantidade += quantidadePlanejada;
    if (!atual.preco && preco) atual.preco = preco;
    atual.valorEstimado = atual.quantidade * atual.preco;
    if (regra.codigoSubstituto || regra.unidadeDestino || perdaPercentual || fatorConversao !== 1) {
      atual.regrasAplicadas.push({
        chaveOrigem,
        codigoOriginal: codigo,
        codigoSubstituto: codigoPlanejado,
        unidadeOriginal: unidade,
        unidadeDestino: unidadePlanejada,
        fatorConversao,
        perdaPercentual,
        justificativa: regra.justificativa || "",
      });
    }
    atual.origens.add(contexto.origem);
    atual.origensDetalhadas.push({
      servicoId: contexto.servicoId,
      servicoCodigo: contexto.servicoCodigo,
      servicoDescricao: contexto.servicoDescricao,
      quantidadeOriginal: quantidade,
      quantidade: quantidadePlanejada,
    });
    insumos.set(chave, atual);
    if (!atual.preco) {
      adicionarPendencia(pendencias, {
        tipo: "sem_preco",
        codigo,
        base: base.baseTitulo,
        origem: contexto.origem,
        descricao: atual.descricao,
      });
    }
  }

  function consolidarMaoObra(item, base, quantidade, contexto) {
    const codigo = codigoReferencia(item);
    const unidade = item.unidade || "H";
    const chave = `${base.basePrecoId || base.baseTitulo}:${codigo || item.descricao}:${unidade}`;
    const atual = maoObra.get(chave) || {
      chave,
      codigo,
      descricao: item.descricao || codigo || "Mão de obra",
      unidade,
      base: base.baseTitulo,
      uf: base.baseUf,
      referencia: base.baseReferencia,
      quantidade: 0,
      origens: new Set(),
      origensDetalhadas: [],
    };
    atual.quantidade += quantidade;
    atual.origens.add(contexto.origem);
    atual.origensDetalhadas.push({
      servicoId: contexto.servicoId,
      servicoCodigo: contexto.servicoCodigo,
      servicoDescricao: contexto.servicoDescricao,
      quantidade,
    });
    maoObra.set(chave, atual);
  }

  async function expandir(referencia, quantidade, contexto, trilha = []) {
    const base = resolverBase(baseReferencia(referencia, contexto.base));
    const codigo = codigoReferencia(referencia);
    if (tipoReferencia(referencia) !== "composicao") {
      if (ehMaoObra(referencia)) {
        consolidarMaoObra(referencia, base, quantidade, contexto);
      } else {
        consolidarInsumo(referencia, base, quantidade, contexto);
      }
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
        servicoId: servico.id,
        servicoCodigo: servico.codigo,
        servicoDescricao: servico.descricao,
        base: baseReferencia(servico),
      },
    );
  }

  const listaInsumos = [...insumos.values()]
    .map((item) => {
      const chavesOrigem = [...item.chavesOrigem].sort();
      return {
        ...item,
        chave: chavesOrigem.join("||"),
        chaveOriginal: chavesOrigem[0],
        chavesOrigem,
        origens: [...item.origens],
      };
    })
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  const listaMaoObra = [...maoObra.values()]
    .map((item) => ({ ...item, origens: [...item.origens] }))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  const cronograma = obterCronogramaProposto(orcamento);
  const servicosPorId = new Map(cronograma.servicos.map((servico) => [servico.item.id, servico]));
  const antecedenciaPadraoDias = Math.max(
    0,
    Math.round(numero(configuracao.antecedenciaPadraoDias, 15)),
  );
  const antecedenciasPorItem = configuracao.antecedenciasPorItem || {};
  const planoCompras = listaInsumos.flatMap((insumo) => {
    const quantidades = new Map(cronograma.periodos.map((periodo) => [periodo.inicio, 0]));
    insumo.origensDetalhadas.forEach((origem) => {
      const servico = servicosPorId.get(origem.servicoId);
      const quantidadeServico = numero(servico?.item.quantidade);
      if (!servico || quantidadeServico <= 0) return;
      cronograma.periodos.forEach((periodo) => {
        const proporcao = numero(servico.quantidades[periodo.inicio]) / quantidadeServico;
        quantidades.set(
          periodo.inicio,
          quantidades.get(periodo.inicio) + numero(origem.quantidade) * proporcao,
        );
      });
    });
    const antecedenciaDias = Math.max(
      0,
      Math.round(numero(antecedenciasPorItem[insumo.chave], antecedenciaPadraoDias)),
    );
    return cronograma.periodos
      .map((periodo) => {
        const quantidade = Math.round(quantidades.get(periodo.inicio) * 100_000_000) / 100_000_000;
        if (quantidade <= 0) return null;
        return {
          chave: `${insumo.chave}:${periodo.inicio}`,
          insumoChave: insumo.chave,
          codigo: insumo.codigo,
          descricao: insumo.descricao,
          unidade: insumo.unidade,
          base: insumo.base,
          uf: insumo.uf,
          periodo: periodo.label,
          periodoInicio: periodo.inicio,
          consumoEm: periodo.inicio,
          comprarAte: dataCompra(periodo.inicio, antecedenciaDias),
          antecedenciaDias,
          quantidade,
          preco: insumo.preco,
          valorEstimado: quantidade * insumo.preco,
          origens: insumo.origens,
        };
      })
      .filter(Boolean);
  }).sort((a, b) => (
    a.comprarAte.localeCompare(b.comprarAte)
    || a.descricao.localeCompare(b.descricao, "pt-BR")
  ));
  const cobertura = calcularCoberturaSuprimentos(planoCompras, configuracao);
  const coberturaPorItem = listaInsumos.map((insumo) => {
    const linhas = cobertura.filter((item) => item.insumoChave === insumo.chave);
    const ultima = linhas.at(-1);
    const pedidos = (configuracao.pedidos || []).filter((pedido) => (
      pedido.insumoChave === insumo.chave && pedido.status !== "Cancelado"
    ));
    return {
      insumo,
      demandaTotal: insumo.quantidade,
      estoqueInicial: Math.max(0, numero(configuracao.estoquesPorItem?.[insumo.chave])),
      pedidos,
      quantidadePedidos: pedidos.reduce((total, pedido) => total + numero(pedido.quantidade), 0),
      saldoProjetado: ultima?.saldoProjetado || 0,
      faltaProjetada: ultima?.faltaProjetada || 0,
      statusCobertura: ultima?.statusCobertura || "Sem demanda",
    };
  });
  return {
    insumos: listaInsumos,
    maoObra: listaMaoObra,
    pendencias,
    servicosProcessados: servicos.length,
    composicoesExpandidas,
    valorEstimado: listaInsumos.reduce((total, item) => total + item.valorEstimado, 0),
    antecedenciaPadraoDias,
    periodos: cronograma.periodos,
    planoCompras,
    cobertura,
    coberturaPorItem,
    rupturas: cobertura.filter((item) => item.statusCobertura === "Ruptura"),
  };
}
