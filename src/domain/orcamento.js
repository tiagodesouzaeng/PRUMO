import { reclassificarEap } from "./eap.js";

export const ORCAMENTO_STORAGE_VERSION = 9;
export const REGRA_CALCULO_ATUAL = "10.2-bdi-diferenciado-tcu";

export const UNIDADES_ORCAMENTARIAS = [
  "UN", "M", "M²", "M³", "KG", "T", "H", "DIA", "MÊS", "VB",
];

function dataIsoValida(valor) {
  const texto = String(valor || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T12:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

function dataUtc(valor) {
  return new Date(`${valor}T12:00:00.000Z`);
}

function dataIso(data) {
  return data.toISOString().slice(0, 10);
}

export function calcularPrazoDias(inicioObra, fimObra) {
  if (!dataIsoValida(inicioObra) || !dataIsoValida(fimObra)) return 0;
  const diferenca = dataUtc(fimObra).getTime() - dataUtc(inicioObra).getTime();
  return Math.max(0, Math.round(diferenca / 86_400_000));
}

export function calcularDataFimPorPrazo(inicioObra, prazoDias) {
  if (!dataIsoValida(inicioObra)) return "";
  const dias = Math.max(1, Math.round(numeroSeguro(prazoDias) || 1));
  const fim = dataUtc(inicioObra);
  fim.setUTCDate(fim.getUTCDate() + dias);
  return dataIso(fim);
}

export function normalizarPlanejamentoObra(planejamento = {}) {
  const referencia = dataIsoValida(planejamento.inicioObra)
    ? planejamento.inicioObra
    : dataIsoValida(String(planejamento.atualizadoEm || "").slice(0, 10))
      ? String(planejamento.atualizadoEm).slice(0, 10)
      : dataIso(new Date());
  const inicio = dataUtc(referencia);
  const fimPadrao = new Date(inicio);
  fimPadrao.setUTCFullYear(fimPadrao.getUTCFullYear() + 1);
  fimPadrao.setUTCDate(fimPadrao.getUTCDate() - 1);
  const fimInformado = dataIsoValida(planejamento.fimObra)
    ? dataUtc(planejamento.fimObra)
    : fimPadrao;
  const fim = fimInformado >= inicio ? fimInformado : fimPadrao;
  const intervalo = Math.min(
    365,
    Math.max(1, Math.round(numeroSeguro(planejamento.intervaloMedicaoDias) || 30)),
  );
  return {
    inicioObra: dataIso(inicio),
    fimObra: dataIso(fim),
    prazoDias: calcularPrazoDias(dataIso(inicio), dataIso(fim)),
    intervaloMedicaoDias: intervalo,
  };
}

export function criarPeriodosMedicao(planejamento = {}) {
  const possuiDataInicioDefinida = dataIsoValida(planejamento.inicioObra);
  const normalizado = normalizarPlanejamentoObra(planejamento);
  const fimObra = dataUtc(normalizado.fimObra);
  const diasTotais = calcularPrazoDias(normalizado.inicioObra, normalizado.fimObra) + 1;
  const periodos = [];
  let inicio = dataUtc(normalizado.inicioObra);
  let indice = 1;
  while (inicio <= fimObra) {
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + normalizado.intervaloMedicaoDias - 1);
    if (fim > fimObra) fim.setTime(fimObra.getTime());
    const rotuloData = (data) => data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      timeZone: "UTC",
    });
    const nomeMes = (data) => data.toLocaleDateString("pt-BR", {
      month: "long",
      timeZone: "UTC",
    });
    const meses = nomeMes(inicio) === nomeMes(fim)
      ? nomeMes(inicio)
      : `${nomeMes(inicio)} – ${nomeMes(fim)}`;
    const diasAcumulados = Math.min(
      indice * normalizado.intervaloMedicaoDias,
      diasTotais,
    );
    periodos.push({
      indice,
      inicio: dataIso(inicio),
      fim: dataIso(fim),
      diasAcumulados,
      label: possuiDataInicioDefinida
        ? `Mês ${indice} · ${meses} (${diasAcumulados}d)`
        : `Mês ${indice} (${diasAcumulados}d)`,
      subLabel: possuiDataInicioDefinida
        ? `${rotuloData(inicio)} a ${rotuloData(fim)}`
        : `Período ${indice}`,
    });
    inicio = new Date(fim);
    inicio.setUTCDate(inicio.getUTCDate() + 1);
    indice += 1;
  }
  return periodos;
}

function diasNoPeriodo(periodo) {
  return calcularPrazoDias(periodo.inicio, periodo.fim) + 1;
}

function valorVazioCronograma(valor) {
  return valor === "" || valor == null;
}

export function distribuirSaldoNosVazios(totalInformado, periodos = [], valores = {}) {
  const total = Math.max(0, numeroSeguro(totalInformado));
  const vazios = periodos.filter((periodo) => (
    !Object.prototype.hasOwnProperty.call(valores, periodo.inicio)
    || valorVazioCronograma(valores[periodo.inicio])
  ));
  const preenchido = periodos
    .filter((periodo) => !vazios.includes(periodo))
    .reduce((soma, periodo) => soma + Math.max(0, numeroSeguro(valores[periodo.inicio])), 0);
  const saldo = Math.max(0, total - preenchido);
  if (!vazios.length) {
    return Object.fromEntries(periodos.map((periodo) => [
      periodo.inicio,
      Math.max(0, numeroSeguro(valores[periodo.inicio])),
    ]));
  }
  const base = saldo / vazios.length;
  let distribuido = 0;
  return Object.fromEntries(periodos.map((periodo) => {
    if (!vazios.includes(periodo)) {
      return [periodo.inicio, Math.max(0, numeroSeguro(valores[periodo.inicio]))];
    }
    const indiceVazio = vazios.indexOf(periodo);
    const valor = indiceVazio === vazios.length - 1
      ? Math.max(0, saldo - distribuido)
      : base;
    const normalizado = Math.round(valor * 100_000_000) / 100_000_000;
    distribuido += normalizado;
    return [periodo.inicio, normalizado];
  }));
}

export function distribuirSaldoInteiroNosVazios(totalInformado, periodos = [], valores = {}) {
  const total = Math.max(0, Math.round(numeroSeguro(totalInformado)));
  const vazios = periodos.filter((periodo) => (
    !Object.prototype.hasOwnProperty.call(valores, periodo.inicio)
    || valorVazioCronograma(valores[periodo.inicio])
  ));
  const preenchido = periodos
    .filter((periodo) => !vazios.includes(periodo))
    .reduce((soma, periodo) => (
      soma + Math.max(0, Math.trunc(numeroSeguro(valores[periodo.inicio])))
    ), 0);
  const saldo = Math.max(0, total - preenchido);
  if (!vazios.length) {
    return Object.fromEntries(periodos.map((periodo) => [
      periodo.inicio,
      Math.max(0, Math.trunc(numeroSeguro(valores[periodo.inicio]))),
    ]));
  }
  const base = Math.floor(saldo / vazios.length);
  const restante = saldo - base * vazios.length;
  return Object.fromEntries(periodos.map((periodo) => {
    if (!vazios.includes(periodo)) {
      return [
        periodo.inicio,
        Math.max(0, Math.trunc(numeroSeguro(valores[periodo.inicio]))),
      ];
    }
    const indiceVazio = vazios.indexOf(periodo);
    return [periodo.inicio, base + (indiceVazio < restante ? 1 : 0)];
  }));
}

export function calcularSaldosMedicao(orcamento, medicaoAtualId = "") {
  const servicos = (orcamento?.itens || []).filter((item) => item.tipo !== "grupo");
  const itensPorId = new Map(servicos.map((item) => [item.id, item]));
  const acumulados = new Map(servicos.map((item) => [item.id, {
    quantidade: 0,
    valor: 0,
  }]));

  (orcamento?.medicoes || [])
    .filter((medicao) => (
      medicao.id !== medicaoAtualId
      && medicao.status !== "Rejeitada"
      && !medicao.proposta
    ))
    .forEach((medicao) => {
      (medicao.itens || []).forEach((linha) => {
        const item = itensPorId.get(linha.itemId);
        if (!item) return;
        const quantidade = Math.max(0, numeroSeguro(linha.quantidadePeriodo));
        const precoMedido = Math.max(0, numeroSeguro(linha.precoUnitario ?? item.unitario));
        const acumulado = acumulados.get(item.id);
        acumulado.quantidade += quantidade;
        acumulado.valor += quantidade * precoMedido;
      });
    });

  return new Map(servicos.map((item) => {
    const quantidadeContratada = Math.max(0, numeroSeguro(item.quantidade));
    const precoUnitario = Math.max(0, numeroSeguro(item.unitario));
    const valorContratado = quantidadeContratada * precoUnitario;
    const acumulado = acumulados.get(item.id);
    return [item.id, {
      itemId: item.id,
      quantidadeContratada,
      precoUnitario,
      valorContratado,
      quantidadeMedidaAnterior: acumulado.quantidade,
      valorMedidoAnterior: acumulado.valor,
      saldoQuantidade: Math.max(0, quantidadeContratada - acumulado.quantidade),
      saldoValor: Math.max(0, valorContratado - acumulado.valor),
      percentualMedido: quantidadeContratada
        ? acumulado.quantidade / quantidadeContratada * 100
        : 0,
    }];
  }));
}

export function validarMedicaoAcumulada(orcamento, medicao) {
  const saldos = calcularSaldosMedicao(orcamento, medicao?.id);
  const erros = [];
  const quantidadesAtuais = new Map();
  const valoresAtuais = new Map();
  const tolerancia = 0.000001;

  (medicao?.itens || []).forEach((linha) => {
    const saldo = saldos.get(linha.itemId);
    if (!saldo) return;
    const quantidade = Math.max(0, numeroSeguro(linha.quantidadePeriodo));
    const valor = quantidade * Math.max(0, numeroSeguro(linha.precoUnitario ?? saldo.precoUnitario));
    quantidadesAtuais.set(linha.itemId, (quantidadesAtuais.get(linha.itemId) || 0) + quantidade);
    valoresAtuais.set(linha.itemId, (valoresAtuais.get(linha.itemId) || 0) + valor);
  });

  quantidadesAtuais.forEach((quantidade, itemId) => {
    const saldo = saldos.get(itemId);
    const valor = valoresAtuais.get(itemId) || 0;
    if (quantidade > saldo.saldoQuantidade + tolerancia) {
      erros.push(`A quantidade do item ${itemId} ultrapassa o saldo contratual disponível.`);
    }
    if (valor > saldo.saldoValor + tolerancia) {
      erros.push(`O valor do item ${itemId} ultrapassa o saldo contratual disponível.`);
    }
  });

  return {
    valida: erros.length === 0,
    erros,
    saldos,
  };
}

export function distribuirQuantidadePeriodos(quantidade, periodos = [], inteiros = false) {
  const total = Math.max(0, numeroSeguro(quantidade));
  if (!periodos.length) return {};
  if (inteiros && Number.isInteger(total)) {
    const base = Math.floor(total / periodos.length);
    const restante = total - base * periodos.length;
    return Object.fromEntries(periodos.map((periodo, indice) => [
      periodo.inicio,
      base + (indice < restante ? 1 : 0),
    ]));
  }
  const base = total / periodos.length;
  let acumulado = 0;
  return Object.fromEntries(periodos.map((periodo, indice) => {
    const valor = indice === periodos.length - 1
      ? Math.round(Math.max(0, total - acumulado) * 1_000_000) / 1_000_000
      : Math.round(base * 1_000_000) / 1_000_000;
    acumulado += valor;
    return [periodo.inicio, valor];
  }));
}

export function obterCronogramaProposto(orcamento) {
  const periodos = criarPeriodosMedicao(orcamento);
  const salvo = orcamento.cronogramaQuantidades || {};
  const servicos = (orcamento.itens || []).filter((item) => item.tipo !== "grupo");
  return {
    periodos,
    servicos: servicos.map((item) => {
      const sugerido = distribuirQuantidadePeriodos(
        item.quantidade,
        periodos,
        String(item.unidade || "").toUpperCase() === "MÊS",
      );
      return {
        item,
        quantidades: Object.fromEntries(periodos.map((periodo) => [
          periodo.inicio,
          salvo[item.id]?.[periodo.inicio] ?? sugerido[periodo.inicio] ?? 0,
        ])),
      };
    }),
  };
}

const FUNCOES_OBRA = [
  ["Engenheiro", /engenheir/i],
  ["Arquiteto", /arquitet/i],
  ["Mestre de obras", /mestre de obra/i],
  ["Encarregado", /encarregad/i],
  ["Pedreiro", /pedreir/i],
  ["Servente", /servente|ajudante/i],
  ["Eletricista", /eletricist/i],
  ["Encanador", /encanador|bombeiro hidr/i],
  ["Pintor", /pintor/i],
  ["Carpinteiro", /carpinteir/i],
  ["Armador", /armador/i],
];

function identificarFuncao(descricao = "") {
  return FUNCOES_OBRA.find(([, expressao]) => expressao.test(descricao))?.[0]
    || String(descricao || "").trim()
    || "Mão de obra";
}

export function obterHistogramaInteligente(orcamento) {
  const cronograma = obterCronogramaProposto(orcamento);
  const composicoes = new Map(
    (orcamento.composicoes || []).map((composicao) => [composicao.codigo, composicao]),
  );
  const horas = new Map();
  const pessoaMes = new Map();
  const garantir = (mapa, funcao) => {
    if (!mapa.has(funcao)) {
      mapa.set(funcao, Object.fromEntries(cronograma.periodos.map((periodo) => [periodo.inicio, 0])));
    }
    return mapa.get(funcao);
  };

  cronograma.servicos.forEach(({ item, quantidades }) => {
    const composicao = composicoes.get(item.referenciaCodigo);
    const componentesMaoObra = (composicao?.componentes || []).filter((componente) => (
      ["H", "HORA", "HH"].includes(String(componente.unidade || "").toUpperCase())
      || String(componente.referenciaTipo || "").toLocaleLowerCase("pt-BR").includes("mao")
    ));
    componentesMaoObra.forEach((componente) => {
      const funcao = identificarFuncao(componente.descricao || componente.referenciaCodigo);
      const porPeriodo = garantir(horas, funcao);
      cronograma.periodos.forEach((periodo) => {
        porPeriodo[periodo.inicio] += numeroSeguro(quantidades[periodo.inicio])
          * numeroSeguro(componente.coeficiente);
      });
    });
    if (
      String(item.unidade || "").toUpperCase() === "MÊS"
      && FUNCOES_OBRA.some(([, expressao]) => expressao.test(item.descricao || ""))
    ) {
      const funcao = identificarFuncao(item.descricao);
      const porPeriodo = garantir(pessoaMes, funcao);
      cronograma.periodos.forEach((periodo) => {
        porPeriodo[periodo.inicio] += numeroSeguro(quantidades[periodo.inicio]);
      });
    }
  });

  const funcoes = [...new Set([...horas.keys(), ...pessoaMes.keys()])];
  const sugestoes = Object.fromEntries(funcoes.map((funcao) => [
    funcao,
    Object.fromEntries(cronograma.periodos.map((periodo) => {
      const porHoras = Math.ceil(
        numeroSeguro(horas.get(funcao)?.[periodo.inicio])
          / Math.max(1, diasNoPeriodo(periodo) * 8),
      );
      const porMes = Math.ceil(numeroSeguro(pessoaMes.get(funcao)?.[periodo.inicio]));
      return [periodo.inicio, Math.max(porHoras, porMes)];
    })),
  ]));
  const ajustes = orcamento.histogramaEquipes || {};
  return {
    ...cronograma,
    funcoes: funcoes.map((funcao) => ({
      funcao,
      totalHoras: cronograma.periodos.reduce((total, periodo) => (
        total
        + numeroSeguro(horas.get(funcao)?.[periodo.inicio])
        + numeroSeguro(pessoaMes.get(funcao)?.[periodo.inicio])
          * diasNoPeriodo(periodo)
          * 8
      ), 0),
      sugerido: sugestoes[funcao],
      quantidades: Object.fromEntries(cronograma.periodos.map((periodo) => [
        periodo.inicio,
        ajustes[funcao]?.[periodo.inicio] ?? sugestoes[funcao][periodo.inicio],
      ])),
    })),
  };
}

export function criarMedicoesPropostas(orcamento) {
  const cronograma = obterCronogramaProposto(orcamento);
  return cronograma.periodos.map((periodo, indice) => {
    const valorPrevisto = cronograma.servicos.reduce((total, { item, quantidades }) => {
      const quantidade = numeroSeguro(item.quantidade);
      const fracao = quantidade > 0
        ? numeroSeguro(quantidades[periodo.inicio]) / quantidade
        : 0;
      const bdiItem = obterBdiItem(orcamento, item) / 100;
      return total + totalItem(item) * (1 + bdiItem) * fracao;
    }, 0);
    return {
      id: `MED-PROP-${String(indice + 1).padStart(3, "0")}`,
      periodo: periodo.label,
      inicio: periodo.inicio,
      fim: periodo.fim,
      status: "Proposta",
      valorPrevisto: truncarMoeda(valorPrevisto),
      valorMedido: 0,
      retencoes: [],
      multas: [],
      documentos: [],
      observacoes: "",
      itens: cronograma.servicos.map(({ item, quantidades }) => ({
        itemId: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidadeContratada: numeroSeguro(item.quantidade),
        quantidadePeriodo: numeroSeguro(quantidades[periodo.inicio]),
        precoUnitario: numeroSeguro(item.unitario),
      })),
      proposta: true,
    };
  });
}

export const BDI_COMPONENTES_PADRAO = {
  estrutura: "planilha-022026-r00",
  grupos: [
    { id: "A", nome: "Administração Central", itens: [
      { id: "A1", descricao: "Administração Central (Matriz da empresa)", percentual: 5.5 },
      { id: "A2", descricao: "Seguros e Garantias", percentual: 1 },
    ] },
    { id: "B", nome: "Riscos e Imprevistos", itens: [
      { id: "B1", descricao: "Riscos de Execução e Imprevistos", percentual: 1.27 },
    ] },
    { id: "C", nome: "Despesas Financeiras", itens: [
      { id: "C1", descricao: "Despesas Financeiras (Capital de Giro)", percentual: 1.39 },
    ] },
    { id: "D", nome: "Lucro", itens: [
      { id: "D1", descricao: "Lucro Bruto", percentual: 8.21 },
    ] },
    { id: "E", nome: "Tributos", itens: [
      { id: "E1", descricao: "ISS", percentual: 2 },
      { id: "E2", descricao: "PIS", percentual: 0.65 },
      { id: "E3", descricao: "COFINS", percentual: 3 },
      { id: "E4", descricao: "CPRB", percentual: 0 },
    ] },
  ],
};

export const BDI_DIFERENCIADO_COMPONENTES_PADRAO = {
  estrutura: "tcu-acordao-2622-2013-bdi-diferenciado",
  fonte: "Acórdão TCU 2.622/2013-Plenário",
  faixaReferencia: {
    primeiroQuartil: 11.1,
    medio: 14.02,
    terceiroQuartil: 16.8,
  },
  grupos: [
    { id: "A", nome: "Administração Central, Seguros e Garantias", itens: [
      { id: "A1", descricao: "Administração Central", percentual: 3.45 },
      { id: "A2", descricao: "Seguros e Garantias", percentual: 0.48 },
    ] },
    { id: "B", nome: "Riscos", itens: [
      { id: "B1", descricao: "Riscos", percentual: 0.85 },
    ] },
    { id: "C", nome: "Despesas Financeiras", itens: [
      { id: "C1", descricao: "Despesas Financeiras", percentual: 0.85 },
    ] },
    { id: "D", nome: "Lucro", itens: [
      { id: "D1", descricao: "Lucro", percentual: 5.11 },
    ] },
    { id: "E", nome: "Tributos sobre o faturamento", itens: [
      { id: "E1", descricao: "ISS — não incidente no mero fornecimento", percentual: 0 },
      { id: "E2", descricao: "PIS", percentual: 0.65 },
      { id: "E3", descricao: "COFINS", percentual: 3 },
      { id: "E4", descricao: "CPRB", percentual: 0 },
    ] },
  ],
};

export const ENCARGOS_SOCIAIS_PADRAO = {
  estrutura: "planilha-022026-r00",
  fonte: "SINAPI",
  uf: "RS",
  referencia: "02/2026",
  regime: "Sem desoneração",
  grupos: [
    { id: "A", nome: "Encargos básicos", itens: [
      { id: "A1", descricao: "INSS", percentual: 20 },
      { id: "A2", descricao: "SESC", percentual: 1.5 },
      { id: "A3", descricao: "SENAC", percentual: 1 },
      { id: "A4", descricao: "INCRA", percentual: 0.2 },
      { id: "A5", descricao: "SEBRAE", percentual: 0.6 },
      { id: "A6", descricao: "Salário Educação", percentual: 2.5 },
      { id: "A7", descricao: "Seguro Contra Acidentes de Trabalho", percentual: 3 },
      { id: "A8", descricao: "FGTS", percentual: 8 },
      { id: "A9", descricao: "SECONCI", percentual: 0 },
    ] },
    { id: "B", nome: "Encargos trabalhistas", itens: [
      { id: "B1", descricao: "Repouso Semanal Remunerado", percentual: 17.93 },
      { id: "B2", descricao: "Feriados", percentual: 4.24 },
      { id: "B3", descricao: "Auxílio - Enfermidade", percentual: 0.86 },
      { id: "B4", descricao: "13º Salário", percentual: 10.94 },
      { id: "B5", descricao: "Licença Paternidade", percentual: 0.07 },
      { id: "B6", descricao: "Faltas Justificadas", percentual: 0.73 },
      { id: "B7", descricao: "Dias de Chuvas", percentual: 1.56 },
      { id: "B8", descricao: "Auxílio Acidente de Trabalho", percentual: 0.1 },
      { id: "B9", descricao: "Férias Gozadas", percentual: 10.28 },
      { id: "B10", descricao: "Salário maternidade", percentual: 0.04 },
    ] },
    { id: "C", nome: "Encargos indenizatórios", itens: [
      { id: "C1", descricao: "Aviso Prévio Indenizado", percentual: 4.56 },
      { id: "C2", descricao: "Aviso Prévio Trabalhado", percentual: 0.11 },
      { id: "C3", descricao: "Férias Indenizadas", percentual: 3.35 },
      { id: "C4", descricao: "Depósito Rescisão Sem Justa Causa", percentual: 2.83 },
      { id: "C5", descricao: "Indenização Adicional", percentual: 0.38 },
    ] },
    { id: "D", nome: "Reincidências", itens: [
      { id: "D1", descricao: "Reincidência do Grupo A sobre Grupo B", percentual: 17.2 },
      { id: "D2", descricao: "Reincidência do Grupo A sobre Aviso Prévio Trabalhado e do FGTS sobre Aviso Prévio Indenizado", percentual: 0.41 },
    ] },
  ],
  observacoes: "Composição analítica conforme a planilha estratégica BASE DE CUSTOS 022026-R00.",
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
  { id: "rev-3", codigo: "R03", status: "Em elaboração", bases: "Própria, SINAPI", total: 1836000.42, variacao: 3.2, autor: "Tiago Souza", publicada: false, data: "2026-07-26T10:42:00.000Z", snapshot: itensBase },
  { id: "rev-2", codigo: "R02", status: "Aprovada", bases: "Própria, SINAPI", total: 1779096.68, variacao: 1.7, autor: "Marina Alves", publicada: true, data: "2026-06-30T14:10:00.000Z", snapshot: itensBase.map((item) => item.tipo === "grupo" ? item : { ...item, unitario: item.unitario * 0.968 }) },
  { id: "rev-1", codigo: "R01", status: "Substituída", bases: "Própria, SINAPI", total: 1749406.77, variacao: 0, autor: "Tiago Souza", publicada: true, data: "2026-05-29T09:15:00.000Z", snapshot: itensBase.slice(0, -1).map((item) => item.tipo === "grupo" ? item : { ...item, unitario: item.unitario * 0.951 }) },
];

export const ORCAMENTOS_INICIAIS = [
  {
    id: "ORC-2026-0042",
    nome: "Centro Administrativo Canoas",
    status: "Em elaboração",
    revisao: "R03",
    bdi: 24.73,
    bdiComponentes: BDI_COMPONENTES_PADRAO,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 5840,
    inicioObra: "2026-07-01",
    fimObra: "2027-06-30",
    intervaloMedicaoDias: 30,
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
    bdi: 22.5,
    bdiComponentes: null,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 1920,
    inicioObra: "2026-08-01",
    fimObra: "2027-01-31",
    intervaloMedicaoDias: 30,
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
    bdi: 21.8,
    bdiComponentes: null,
    descontoGlobal: null,
    historicoCalculo: [],
    area: 2460,
    inicioObra: "2026-09-01",
    fimObra: "2027-04-30",
    intervaloMedicaoDias: 30,
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
  if (Array.isArray(componentes.grupos)) {
    const total = (id) => componentes.grupos
      .find((grupo) => grupo.id === id)?.itens
      .reduce((soma, item) => soma + numeroSeguro(item.percentual), 0) || 0;
    const a = total("A") / 100;
    const r = total("B") / 100;
    const df = total("C") / 100;
    const l = total("D") / 100;
    const i = Math.min(total("E") / 100, 0.99);
    return ((((1 + a + r) * (1 + df) * (1 + l)) / (1 - i)) - 1) * 100;
  }
  const ac = numeroSeguro(componentes.administracaoCentral) / 100;
  const sg = numeroSeguro(componentes.segurosGarantias) / 100;
  const r = numeroSeguro(componentes.riscos) / 100;
  const df = numeroSeguro(componentes.despesasFinanceiras) / 100;
  const l = numeroSeguro(componentes.lucro) / 100;
  const i = Math.min(numeroSeguro(componentes.tributos) / 100, 0.99);
  return ((((1 + ac + sg + r) * (1 + df) * (1 + l)) / (1 - i)) - 1) * 100;
}

export function calcularTotalPercentuais(grupos = []) {
  return grupos.reduce((total, grupo) => total + (grupo.itens || []).reduce(
    (subtotal, item) => subtotal + numeroSeguro(item.percentual),
    0,
  ), 0);
}

export function obterBdi(orcamento) {
  return orcamento.bdiComponentes
    ? calcularBdiDetalhado(orcamento.bdiComponentes)
    : numeroSeguro(orcamento.bdi);
}

export function obterBdiDiferenciado(orcamento) {
  return calcularBdiDetalhado(
    orcamento.bdiDiferenciadoComponentes || BDI_DIFERENCIADO_COMPONENTES_PADRAO,
  );
}

const CRITERIOS_BDI_DIFERENCIADO = [
  ["inviabilidadeParcelamento", "inviabilidade técnico-econômica de parcelamento"],
  ["naturezaEspecifica", "natureza específica do material ou equipamento"],
  ["fornecedorEspecializado", "fornecimento por empresa de especialidade própria e diversa"],
  ["impactoSignificativo", "representatividade significativa no preço global"],
  ["meraIntermediacao", "mera intermediação e atividade residual da construtora"],
  ["servicosAssociadosSeparados", "serviços de instalação ou montagem separados do fornecimento"],
];

export function validarBdiDiferenciadoItem(item = {}) {
  if (item.tipo === "grupo" || item.bdiTipo !== "diferenciado") {
    return { elegivel: false, aplicavel: false, pendencias: [] };
  }
  const memoria = item.bdiDiferenciado || {};
  const pendencias = CRITERIOS_BDI_DIFERENCIADO
    .filter(([campo]) => memoria[campo] !== true)
    .map(([, descricao]) => descricao);
  if (String(memoria.justificativa || "").trim().length < 20) {
    pendencias.push("justificativa técnica detalhada");
  }
  return {
    elegivel: pendencias.length === 0,
    aplicavel: true,
    pendencias,
  };
}

export function obterBdiItem(orcamento, item) {
  const validacao = validarBdiDiferenciadoItem(item);
  return validacao.elegivel ? obterBdiDiferenciado(orcamento) : obterBdi(orcamento);
}

export function totalItem(item) {
  if (item.tipo === "grupo") return 0;
  return truncarMoeda(numeroSeguro(item.quantidade) * numeroSeguro(item.unitario));
}

export function decomporParcelasUnitarias(item = {}) {
  const unitario = numeroSeguro(item.unitario);
  const percentualMaoObra = numeroSeguro(item.percentualMaoObra);
  const maoObra = item.custoMaoObra == null
    ? unitario * percentualMaoObra
    : numeroSeguro(item.custoMaoObra);
  const material = item.custoMaterial == null
    ? Math.max(0, unitario - maoObra)
    : numeroSeguro(item.custoMaterial);
  const totalParcelas = maoObra + material;
  if (unitario > 0 && totalParcelas > 0 && Math.abs(totalParcelas - unitario) > 0.00000001) {
    const fator = unitario / totalParcelas;
    return { maoObra: maoObra * fator, material: material * fator };
  }
  return { maoObra, material };
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
  const bdiPadrao = obterBdi(orcamento);
  const bdiDiferenciado = obterBdiDiferenciado(orcamento);
  let baseBdiPadrao = 0;
  let baseBdiDiferenciado = 0;
  let valorBdiPadrao = 0;
  let valorBdiDiferenciado = 0;
  let itensBdiDiferenciado = 0;
  (orcamento.itens || []).filter((item) => item.tipo !== "grupo").forEach((item) => {
    const liquido = Math.max(0, truncarMoeda(
      totalItem(item) - numeroSeguro(distribuicao.porItem.get(item.id)),
    ));
    const diferenciado = validarBdiDiferenciadoItem(item).elegivel;
    if (diferenciado) {
      baseBdiDiferenciado += liquido;
      valorBdiDiferenciado += truncarMoeda(liquido * (bdiDiferenciado / 100));
      itensBdiDiferenciado += 1;
    } else {
      baseBdiPadrao += liquido;
      valorBdiPadrao += truncarMoeda(liquido * (bdiPadrao / 100));
    }
  });
  baseBdiPadrao = truncarMoeda(baseBdiPadrao);
  baseBdiDiferenciado = truncarMoeda(baseBdiDiferenciado);
  valorBdiPadrao = truncarMoeda(valorBdiPadrao);
  valorBdiDiferenciado = truncarMoeda(valorBdiDiferenciado);
  const valorBdi = truncarMoeda(valorBdiPadrao + valorBdiDiferenciado);
  const bdi = custoDireto > 0 ? (valorBdi / custoDireto) * 100 : bdiPadrao;
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
    bdiPadrao,
    bdiDiferenciado,
    baseBdiPadrao,
    baseBdiDiferenciado,
    valorBdiPadrao,
    valorBdiDiferenciado,
    itensBdiDiferenciado,
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
      const validacaoBdi = validarBdiDiferenciadoItem(item);
      if (validacaoBdi.aplicavel && !validacaoBdi.elegivel) {
        problemas.push({
          tipo: "erro",
          mensagem: `BDI diferenciado incompleto no item ${item.codigo}: ${validacaoBdi.pendencias.join(", ")}.`,
        });
      }
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

function clonarConfiguracao(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function normalizarBdiComponentes(componentes) {
  if (componentes?.estrutura === BDI_COMPONENTES_PADRAO.estrutura && Array.isArray(componentes?.grupos)) {
    return clonarConfiguracao(componentes);
  }
  return clonarConfiguracao(BDI_COMPONENTES_PADRAO);
}

function normalizarBdiDiferenciadoComponentes(componentes) {
  if (Array.isArray(componentes?.grupos)) return clonarConfiguracao(componentes);
  return clonarConfiguracao(BDI_DIFERENCIADO_COMPONENTES_PADRAO);
}

export function normalizarOrcamento(orcamento) {
  const dadosOrcamento = { ...orcamento };
  delete dadosOrcamento.base;
  delete dadosOrcamento.checklistHomologacao;
  const planejamento = normalizarPlanejamentoObra(orcamento);
  return {
    ...dadosOrcamento,
    ...planejamento,
    bdiComponentes: normalizarBdiComponentes(orcamento.bdiComponentes),
    bdiDiferenciadoComponentes: normalizarBdiDiferenciadoComponentes(
      orcamento.bdiDiferenciadoComponentes,
    ),
    encargosSociais: orcamento.encargosSociais?.estrutura === ENCARGOS_SOCIAIS_PADRAO.estrutura
      && Array.isArray(orcamento.encargosSociais?.grupos)
      ? clonarConfiguracao(orcamento.encargosSociais)
      : clonarConfiguracao(ENCARGOS_SOCIAIS_PADRAO),
    descontoGlobal: orcamento.descontoGlobal ?? null,
    historicoCalculo: orcamento.historicoCalculo || [],
    cronogramaQuantidades: orcamento.cronogramaQuantidades || {},
    histogramaEquipes: orcamento.histogramaEquipes || {},
    suprimentosConfig: {
      antecedenciaPadraoDias: Math.max(
        0,
        Math.round(numeroSeguro(orcamento.suprimentosConfig?.antecedenciaPadraoDias ?? 15)),
      ),
      antecedenciasPorItem: orcamento.suprimentosConfig?.antecedenciasPorItem || {},
      estoquesPorItem: orcamento.suprimentosConfig?.estoquesPorItem || {},
      pedidos: orcamento.suprimentosConfig?.pedidos || [],
      regrasPorItem: orcamento.suprimentosConfig?.regrasPorItem || {},
    },
    medicoes: orcamento.medicoes || [],
    itens: reclassificarEap((orcamento.itens || []).map((item) => ({
      ...item,
      id: item.id || criarId(item.tipo === "grupo" ? "grp" : "item"),
      tipo: item.tipo || "servico",
      parentId: item.parentId || "",
      nivelEap: item.tipo === "grupo" ? (item.nivelEap || "disciplina") : "",
      unidade: item.tipo === "grupo" ? "" : (item.unidade || "").toUpperCase(),
      basePrecoId: item.tipo === "grupo" ? "" : (item.basePrecoId || ""),
      referenciaCodigo: item.tipo === "grupo"
        ? ""
        : (item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim() || ""),
      referenciaTipo: item.tipo === "grupo" ? "" : (item.referenciaTipo || "composicao"),
      percentualMaoObra: item.tipo === "grupo" ? 0 : numeroSeguro(item.percentualMaoObra),
      custoMaoObra: item.tipo === "grupo" ? 0 : numeroSeguro(item.custoMaoObra),
      custoMaterial: item.tipo === "grupo"
        ? 0
        : numeroSeguro(item.custoMaterial ?? item.unitario),
      bdiTipo: item.tipo === "grupo" ? "padrao" : (item.bdiTipo || "padrao"),
      bdiDiferenciado: item.tipo === "grupo"
        ? null
        : (item.bdiDiferenciado || null),
    }))),
    composicoes: (orcamento.composicoes || []).map((composicao) => ({
      ...composicao,
      componentes: composicao.componentes || [],
    })),
    revisoes: (orcamento.revisoes || []).map((revisao) => {
      const dadosRevisao = { ...revisao };
      const bases = revisao.bases || revisao.base || "Própria";
      delete dadosRevisao.base;
      return {
        ...dadosRevisao,
        bases,
        ativa: dadosRevisao.ativa ?? dadosRevisao.codigo === orcamento.revisao,
        inativa: dadosRevisao.inativa ?? false,
      };
    }),
  };
}

export function criarOrcamento({
  id,
  nome,
  bdi,
  area,
  inicioObra,
  fimObra,
  prazoDias,
  intervaloMedicaoDias,
}) {
  const planejamento = normalizarPlanejamentoObra({
    inicioObra,
    fimObra,
    prazoDias,
    intervaloMedicaoDias,
  });
  return {
    id,
    nome,
    status: "Em elaboração",
    revisao: "R01",
    bdi: numeroSeguro(bdi),
    bdiComponentes: clonarConfiguracao(BDI_COMPONENTES_PADRAO),
    bdiDiferenciadoComponentes: clonarConfiguracao(BDI_DIFERENCIADO_COMPONENTES_PADRAO),
    encargosSociais: clonarConfiguracao(ENCARGOS_SOCIAIS_PADRAO),
    descontoGlobal: null,
    historicoCalculo: [],
    cronogramaQuantidades: {},
    histogramaEquipes: {},
    suprimentosConfig: {
      antecedenciaPadraoDias: 15,
      antecedenciasPorItem: {},
      estoquesPorItem: {},
      pedidos: [],
      regrasPorItem: {},
    },
    medicoes: [],
    area: numeroSeguro(area),
    ...planejamento,
    atualizadoEm: new Date().toISOString(),
    itens: [],
    composicoes: [],
    revisoes: [],
  };
}
