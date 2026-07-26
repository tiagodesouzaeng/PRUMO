export const ORCAMENTO_STORAGE_VERSION = 1;

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
  { id: "rev-3", codigo: "R03", status: "Em elaboração", base: "SINAPI RS · 06/2026", total: 1836000.42, variacao: 3.2, autor: "Tiago Souza", publicada: false, data: "2026-07-26T10:42:00.000Z" },
  { id: "rev-2", codigo: "R02", status: "Aprovada", base: "SINAPI RS · 05/2026", total: 1779096.68, variacao: 1.7, autor: "Marina Alves", publicada: true, data: "2026-06-30T14:10:00.000Z" },
  { id: "rev-1", codigo: "R01", status: "Substituída", base: "SINAPI RS · 04/2026", total: 1749406.77, variacao: 0, autor: "Tiago Souza", publicada: true, data: "2026-05-29T09:15:00.000Z" },
];

export const ORCAMENTOS_INICIAIS = [
  {
    id: "ORC-2026-0042",
    nome: "Centro Administrativo Canoas",
    status: "Em elaboração",
    revisao: "R03",
    base: "SINAPI RS · 06/2026",
    bdi: 24.73,
    area: 5840,
    atualizadoEm: "2026-07-26T10:42:00.000Z",
    itens: itensBase,
    revisoes: revisoesBase,
  },
  {
    id: "ORC-2026-0038",
    nome: "Reforma Bloco C",
    status: "Em elaboração",
    revisao: "R01",
    base: "SINAPI RS · 06/2026",
    bdi: 22.5,
    area: 1920,
    atualizadoEm: "2026-07-18T15:20:00.000Z",
    itens: itensBase.slice(0, 4),
    revisoes: [],
  },
  {
    id: "ORC-2026-0029",
    nome: "Cobertura do Ginásio",
    status: "Aprovado",
    revisao: "R02",
    base: "SINAPI RS · 05/2026",
    bdi: 21.8,
    area: 2460,
    atualizadoEm: "2026-07-10T11:30:00.000Z",
    itens: itensBase.slice(0, 6),
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

export function totalItem(item) {
  if (item.tipo === "grupo") return 0;
  return numeroSeguro(item.quantidade) * numeroSeguro(item.unitario);
}

export function totalGrupo(itens, codigoGrupo) {
  const prefixo = `${codigoGrupo}.`;
  return itens
    .filter((item) => item.tipo !== "grupo" && item.codigo.startsWith(prefixo))
    .reduce((total, item) => total + totalItem(item), 0);
}

export function calcularTotais(orcamento) {
  const custoDireto = orcamento.itens.reduce((total, item) => total + totalItem(item), 0);
  const valorBdi = custoDireto * (numeroSeguro(orcamento.bdi) / 100);
  const precoTotal = custoDireto + valorBdi;
  const pendencias = orcamento.itens.filter(
    (item) => item.tipo !== "grupo" && (!numeroSeguro(item.quantidade) || !numeroSeguro(item.unitario)),
  ).length;

  return {
    custoDireto,
    valorBdi,
    precoTotal,
    pendencias,
    valorPorArea: orcamento.area ? precoTotal / numeroSeguro(orcamento.area) : 0,
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
    area: numeroSeguro(area),
    atualizadoEm: new Date().toISOString(),
    itens: [],
    revisoes: [],
  };
}

