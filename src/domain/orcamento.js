export const ORCAMENTO_STORAGE_VERSION = 3;
export const REGRA_CALCULO_ATUAL = "9.4-truncamento-2-casas";

export const UNIDADES_ORCAMENTARIAS = [
  "UN", "M", "M²", "M³", "KG", "T", "H", "DIA", "MÊS", "VB",
];

export const BDI_COMPONENTES_PADRAO = {
  administracaoCentral: 4,
  segurosGarantias: 0.8,
  riscos: 1.27,
  despesasFinanceiras: 1.23,
  lucro: 7.4,
  tributos: 8.65,
};

const itensBase = [
  { id: "grp-1", codigo: "1", descricao: "SERVIÇOS PRELIMINARES", tipo: "grupo" },
  { id: "item-1-1", codigo: "1.1", descricao: "Administração local da obra", fonte: "Própria · CPU-014", quantidade: 8, unidade: "MÊS", unitario: 35420.88 },
  { id: "item-1-2", codigo: "1.2", descricao: "Placa de obra em chapa de aço galvanizado", fonte: "SINAPI · 103689", quantidade: 6, unidade: "M²", unitario: 207.23 },
  { id: "grp-2", codigo: "2", descricao: "FUNDAÇÕES E ESTRUTURAS", tipo: "grupo" },
  { id: "item-2-1", codigo: "2.1", descricao: "Concreto armado para fundações, fck = 30 MPa", fonte: "SINAPI · 96557", quantidade: 428.5, unidade: "M³", unitario: 1268.44 },
  { id: "item-2-2", codigo: "2.2", descricao: "Forma para estruturas de concreto em chapa compensada", fonte: "SINAPI · 92431", quantidade: 3842.2, unidade: "M²", unitario: 154.17 },
  { id: "grp-3", codigo: "3", descricao: "INSTALAÇÕES ELÉTRICAS", tipo: "grupo" },
  { id: "item-3-1", codigo: "3.1", descricao: "Quadro de distribuição de energia em chapa de aço", fonte: "SINAPI · 101875", quantidade: 18, unidade: "UN", unitario: 2867.41 },
];

const revisoesBase = [
  { id: "rev-3", codigo: "R03", status: "Em elaboração", base: "SINAPI RS · 06/2026", total: 1836000.42, variacao: 3.2, autor: "Tiago Souza", publicada: false, data: "2026-07-26T10:42:00.000Z", snapshot: itensBase },
  { id: "rev-2", codigo: "R02", status: "Aprovada", base: "SINAPI RS · 05/2026", total: 1779096.68, variacao: 1.7, autor: "Marina Alves", publicada: true, data: "2026-06-30T14:10:00.000Z", snapshot: itensBase.map((item) => item.tipo === "grupo" ? item : { ...item, unitario: item.unitario * 0.968 }) },
  { id: "rev-1", codigo: "R01", status: "Substituída", base: "SINAPI RS · 04/2026", total: 1749406.77, variacao: 0, autor: "Tiago Souza", publicada: true, data: "2026-05-29T09:15:00.000Z", snapshot: itensBase.slice(0, -1).map((item) => item.tipo === "grupo" ? item : { ...item, unitario: item.unitario * 0.951 }) },
];

export const ORCAMENTOS_INICIAIS = [
  {
    id: "ORC-2026-0042",
    nome: "Centro Administrativo Canoas",
    status: "Em elaboração",
    revisao: "R03",
    base: "SINAPI RS · 06/2026",
    bdi: 24.73,
    bdiComponentes: BDI_COMPONENTES_PADRAO,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 5840,
    atualizadoEm: "2026-07-26T10:42:00.000Z",
    itens: itensBase,
    composicoes: [
      { id: "comp-1", codigo: "CPU-014", descricao: "Administração local da obra", unidade: "MÊS", custoUnitario: 35420.88 },
    ],
    revisoes: revisoesBase,
  },
  {
    id: "ORC-2026-0038",
    nome: "Reforma Bloco C",
    status: "Em elaboração",
    revisao: "R01",
    base: "SINAPI RS · 06/2026",
    bdi: 22.5,
    bdiComponentes: null,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 1920,
    atualizadoEm: "2026-07-18T15:20:00.000Z",
    itens: itensBase.slice(0, 4),
    composicoes: [],
    revisoes: [],
  },
  {
    id: "ORC-2026-0029",
    nome: "Cobertura do Ginásio",
    status: "Aprovado",
    revisao: "R02",
    base: "SINAPI RS · 05/2026",
    bdi: 21.8,
    bdiComponentes: null,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 2460,
    atualizadoEm: "2026-07-10T11:30:00.000Z",
    itens: itensBase.slice(0, 6),
    composicoes: [],
    revisoes: [],
  },
];

export function criarId(prefixo) {
  const sufixo = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefixo}-${sufixo}`;
}

export function numeroSeguro(valor) {
  const numero = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function truncarMoeda(valor) {
  const numero = numeroSeguro(valor);
  const sinal = numero < 0 ? -1 : 1;
  const absoluto = Math.abs(numero);
  const toleranciaBinaria = Number.EPSILON * Math.max(1, absoluto) * 8;
  return sinal * (Math.floor((absoluto + toleranciaBinaria) * 100) / 100);
}

function paraCentavos(valor) {
  return Math.round(truncarMoeda(valor) * 100);
}

export function calcularBdiDetalhado(componentes) {
  if (!componentes) return 0;
  const ac = numeroSeguro(componentes.administracaoCentral) / 100;
  const sg = numeroSeguro(componentes.segurosGarantias) / 100;
  const r = numeroSeguro(componentes.riscos) / 100;
  const df = numeroSeguro(componentes.despesasFinanceiras) / 100;
  const l = numeroSeguro(componentes.lucro) / 100;
  const i = Math.min(numeroSeguro(componentes.tributos) / 100, 0.99);
  return ((((1 + ac + sg + r) * (1 + df) * (1 + l)) / (1 - i)) - 1) * 100;
}

export function obterBdi(orcamento) {
  return orcamento.bdiComponentes
    ? calcularBdiDetalhado(orcamento.bdiComponentes)
    : numeroSeguro(orcamento.bdi);
}

export function totalItem(item) {
  if (item.tipo === "grupo") return 0;
  return truncarMoeda(numeroSeguro(item.quantidade) * numeroSeguro(item.unitario));
}

export function totalGrupo(itens, codigoGrupo, descontos = new Map()) {
  const prefixo = `${codigoGrupo}.`;
  const centavos = itens
    .filter((item) => item.tipo !== "grupo" && item.codigo.startsWith(prefixo))
    .reduce((total, item) => (
      total + paraCentavos(totalItem(item)) - paraCentavos(descontos.get(item.id) || 0)
    ), 0);
  return centavos / 100;
}

export function calcularDistribuicaoDesconto(orcamento) {
  const servicos = (orcamento.itens || [])
    .filter((item) => item.tipo !== "grupo")
    .map((item) => ({ item, centavos: Math.max(0, paraCentavos(totalItem(item))) }))
    .filter(({ centavos }) => centavos > 0);
  const subtotalCentavos = servicos.reduce((total, item) => total + item.centavos, 0);
  const desconto = orcamento.descontoGlobal;
  const porItem = new Map();

  if (!desconto || subtotalCentavos <= 0) {
    return {
      porItem,
      subtotalBruto: subtotalCentavos / 100,
      valorDesconto: 0,
      percentual: 0,
    };
  }

  const tipo = desconto.tipo === "valor" ? "valor" : "percentual";
  const informado = Math.max(0, numeroSeguro(desconto.valor));
  const descontoCentavos = tipo === "valor"
    ? Math.min(subtotalCentavos, Math.max(0, paraCentavos(informado)))
    : Math.min(
      subtotalCentavos,
      Math.floor((subtotalCentavos * Math.min(informado, 100)) / 100),
    );
  const percentual = subtotalCentavos
    ? (descontoCentavos / subtotalCentavos) * 100
    : 0;

  const parcelas = servicos.map(({ item, centavos }) => {
    const valorExato = (centavos * descontoCentavos) / subtotalCentavos;
    const valorBase = Math.floor(valorExato);
    return {
      item,
      centavos,
      descontoCentavos: valorBase,
      residuo: valorExato - valorBase,
    };
  });

  let restante = descontoCentavos - parcelas.reduce(
    (total, parcela) => total + parcela.descontoCentavos,
    0,
  );
  const ordemDistribuicao = [...parcelas].sort(
    (a, b) => b.residuo - a.residuo || a.item.codigo.localeCompare(b.item.codigo),
  );
  let indice = 0;
  while (restante > 0 && ordemDistribuicao.length) {
    const parcela = ordemDistribuicao[indice % ordemDistribuicao.length];
    if (parcela.descontoCentavos < parcela.centavos) {
      parcela.descontoCentavos += 1;
      restante -= 1;
    }
    indice += 1;
  }

  parcelas.forEach(({ item, descontoCentavos: valor }) => {
    porItem.set(item.id, valor / 100);
  });

  return {
    porItem,
    subtotalBruto: subtotalCentavos / 100,
    valorDesconto: descontoCentavos / 100,
    percentual,
  };
}

export function proximoCodigoServico(itens, codigoGrupo, itemIgnoradoId = "") {
  const expressao = new RegExp(`^${codigoGrupo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)$`);
  const maiorSequencial = itens.reduce((maior, item) => {
    if (item.id === itemIgnoradoId) return maior;
    const resultado = item.codigo.match(expressao);
    return resultado ? Math.max(maior, Number(resultado[1])) : maior;
  }, 0);
  return `${codigoGrupo}.${maiorSequencial + 1}`;
}

export function proximoCodigoGrupo(itens) {
  const maiorGrupo = itens
    .filter((item) => item.tipo === "grupo" && /^\d+$/.test(item.codigo))
    .reduce((maior, item) => Math.max(maior, Number(item.codigo)), 0);
  return String(maiorGrupo + 1);
}

export function calcularTotais(orcamento) {
  const distribuicao = calcularDistribuicaoDesconto(orcamento);
  const subtotalBruto = distribuicao.subtotalBruto;
  const valorDesconto = distribuicao.valorDesconto;
  const custoDireto = truncarMoeda(subtotalBruto - valorDesconto);
  const bdi = obterBdi(orcamento);
  const valorBdi = truncarMoeda(custoDireto * (bdi / 100));
  const precoTotal = truncarMoeda(custoDireto + valorBdi);
  const pendencias = orcamento.itens.filter(
    (item) => item.tipo !== "grupo" && (!numeroSeguro(item.quantidade) || !numeroSeguro(item.unitario)),
  ).length;

  return {
    subtotalBruto,
    valorDesconto,
    descontoPercentual: distribuicao.percentual,
    custoDireto,
    bdi,
    valorBdi,
    precoTotal,
    pendencias,
    valorPorArea: orcamento.area
      ? truncarMoeda(precoTotal / numeroSeguro(orcamento.area))
      : 0,
  };
}

export function validarOrcamento(orcamento) {
  const ocorrencias = new Map();
  orcamento.itens.forEach((item) => {
    const codigo = item.codigo.trim();
    ocorrencias.set(codigo, (ocorrencias.get(codigo) || 0) + 1);
  });

  return orcamento.itens.flatMap((item) => {
    const problemas = [];
    if (ocorrencias.get(item.codigo.trim()) > 1) problemas.push({ tipo: "erro", mensagem: `Código ${item.codigo} duplicado.` });
    if (!item.descricao.trim()) problemas.push({ tipo: "erro", mensagem: `Item ${item.codigo} sem descrição.` });
    if (item.tipo !== "grupo") {
      if (!numeroSeguro(item.quantidade)) problemas.push({ tipo: "alerta", mensagem: `Item ${item.codigo} sem quantidade.` });
      if (!numeroSeguro(item.unitario)) problemas.push({ tipo: "alerta", mensagem: `Item ${item.codigo} sem preço unitário.` });
      if (!UNIDADES_ORCAMENTARIAS.includes(item.unidade?.toUpperCase())) problemas.push({ tipo: "erro", mensagem: `Unidade inválida no item ${item.codigo}.` });
    }
    return problemas.map((problema) => ({ ...problema, itemId: item.id }));
  });
}

export function compararSnapshots(revisaoBase, revisaoComparada) {
  if (!Array.isArray(revisaoBase?.snapshot) || !Array.isArray(revisaoComparada?.snapshot)) {
    return { adicionados: [], removidos: [], alterados: [], disponivel: false };
  }
  const base = new Map((revisaoBase?.snapshot || []).map((item) => [item.codigo, item]));
  const comparada = new Map((revisaoComparada?.snapshot || []).map((item) => [item.codigo, item]));
  const adicionados = [...comparada.keys()].filter((codigo) => !base.has(codigo));
  const removidos = [...base.keys()].filter((codigo) => !comparada.has(codigo));
  const alterados = [...comparada.keys()].filter((codigo) => {
    const anterior = base.get(codigo);
    const atual = comparada.get(codigo);
    return anterior && (
      anterior.descricao !== atual.descricao
      || numeroSeguro(anterior.quantidade) !== numeroSeguro(atual.quantidade)
      || numeroSeguro(anterior.unitario) !== numeroSeguro(atual.unitario)
    );
  });
  return { adicionados, removidos, alterados, disponivel: true };
}

export function normalizarOrcamento(orcamento) {
  return {
    ...orcamento,
    bdiComponentes: orcamento.bdiComponentes ?? null,
    descontoGlobal: orcamento.descontoGlobal ?? null,
    historicoCalculo: orcamento.historicoCalculo || [],
    itens: (orcamento.itens || []).map((item) => ({
      ...item,
      id: item.id || criarId(item.tipo === "grupo" ? "grp" : "item"),
      tipo: item.tipo || "servico",
      unidade: item.tipo === "grupo" ? "" : (item.unidade || "").toUpperCase(),
    })),
    composicoes: orcamento.composicoes || [],
    revisoes: orcamento.revisoes || [],
  };
}

export function criarOrcamento({ id, nome, base, bdi, area }) {
  return {
    id,
    nome,
    status: "Em elaboração",
    revisao: "R01",
    base,
    bdi: numeroSeguro(bdi),
    bdiComponentes: null,
    descontoGlobal: null,
    historicoCalculo: [],
    area: numeroSeguro(area),
    atualizadoEm: new Date().toISOString(),
    itens: [],
    composicoes: [],
    revisoes: [],
  };
}
