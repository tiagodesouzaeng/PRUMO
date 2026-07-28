import {
  calcularDistribuicaoDesconto,
  calcularTotais,
  criarPeriodosMedicao,
  obterBdi,
} from "../domain/orcamento.js";
import { mapearHierarquiaEap } from "../domain/eap.js";

const COR = {
  marinho: "173B4A",
  verde: "087F73",
  dourado: "C19B54",
  claro: "EAF4F2",
  entrada: "FFF2CC",
  cinza: "E7ECEE",
  branco: "FFFFFF",
  texto: "314B55",
};

const formatoMoeda = '"R$" #,##0.00';
const formatoPercentual = "0.00%";
const CABECALHOS_EAP = ["SITE", "PRÉDIO", "ANDAR", "SALA", "DISCIPLINA"];
const CHAVES_EAP = ["site", "predio", "andar", "sala", "disciplina"];

function aplicarEstiloCabecalho(aba, intervalo) {
  const XLSX = globalThis.__PRUMO_XLSX__;
  for (const endereco of XLSX.utils.decode_range(intervalo)
    ? enderecosIntervalo(XLSX, intervalo)
    : []) {
    const celula = aba[endereco];
    if (!celula) continue;
    celula.s = {
      fill: { fgColor: { rgb: COR.marinho } },
      font: { bold: true, color: { rgb: COR.branco } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      protection: { locked: true },
    };
  }
}

function enderecosIntervalo(XLSX, intervalo) {
  const faixa = XLSX.utils.decode_range(intervalo);
  const enderecos = [];
  for (let linha = faixa.s.r; linha <= faixa.e.r; linha += 1) {
    for (let coluna = faixa.s.c; coluna <= faixa.e.c; coluna += 1) {
      enderecos.push(XLSX.utils.encode_cell({ r: linha, c: coluna }));
    }
  }
  return enderecos;
}

function estilizarCelula(celula, opcoes = {}) {
  if (!celula) return;
  celula.s = {
    ...(celula.s || {}),
    font: {
      color: { rgb: opcoes.corTexto || COR.texto },
      bold: Boolean(opcoes.negrito),
    },
    fill: opcoes.preenchimento
      ? { fgColor: { rgb: opcoes.preenchimento } }
      : undefined,
    alignment: {
      vertical: "center",
      horizontal: opcoes.alinhamento || "left",
      wrapText: Boolean(opcoes.quebrar),
    },
    protection: { locked: opcoes.bloqueada !== false },
  };
  if (opcoes.formato) celula.z = opcoes.formato;
}

function prepararAba(aba, larguras, filtro, congelar = { xSplit: 0, ySplit: 3 }) {
  aba["!cols"] = larguras.map((wch) => ({ wch }));
  aba["!autofilter"] = filtro ? { ref: filtro } : undefined;
  aba["!freeze"] = congelar;
  aba["!protect"] = {
    password: "PRUMO",
    selectLockedCells: false,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    deleteRows: false,
    sort: false,
    autoFilter: true,
  };
}

function adicionarTitulo(XLSX, aba, titulo, subtitulo, ultimaColuna) {
  aba.A1 = { t: "s", v: titulo };
  aba.A2 = { t: "s", v: subtitulo };
  aba["!merges"] = [
    ...(aba["!merges"] || []),
    XLSX.utils.decode_range(`A1:${ultimaColuna}1`),
    XLSX.utils.decode_range(`A2:${ultimaColuna}2`),
  ];
  estilizarCelula(aba.A1, {
    preenchimento: COR.marinho,
    corTexto: COR.branco,
    negrito: true,
  });
  estilizarCelula(aba.A2, {
    preenchimento: COR.claro,
    corTexto: COR.verde,
    negrito: true,
  });
}

function nomeSeguroArquivo(valor) {
  return String(valor || "orcamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-");
}

function valoresHierarquia(hierarquia = {}) {
  const dados = hierarquia || {};
  return CHAVES_EAP.map((chave) => dados[chave] || "");
}

function subtituloPacote(orcamento) {
  return `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao} · `
    + `${orcamento.inicioObra} a ${orcamento.fimObra} · medições a cada ${orcamento.intervaloMedicaoDias} dias`;
}

function criarInstrucoes(XLSX, orcamento) {
  const dados = [
    ["PACOTE DE LICITAÇÃO E CONCORRÊNCIA", "", ""],
    [subtituloPacote(orcamento), "", ""],
    ["GUIA", "FINALIDADE", "EDIÇÃO"],
    ["Orçamento Completo", "Memória da planilha com bases, custos, desconto e BDI.", "Somente leitura"],
    ["Proposta de Preços", "Preenchimento dos preços unitários pelos concorrentes.", "Células amarelas"],
    ["BDI e Encargos", "Preenchimento analítico dos percentuais de BDI e encargos.", "Células amarelas"],
    ["Cronograma", "Distribuição percentual conforme os períodos de medição da obra.", "Células amarelas"],
    ["Histograma", "Horas de mão de obra derivadas do cronograma.", "Somente leitura"],
    ["", "", ""],
    ["REGRAS", "", ""],
    ["1", "Não alterar códigos, descrições, unidades ou fórmulas.", ""],
    ["2", "Preencher somente as células amarelas.", ""],
    ["3", "Os percentuais dos períodos de medição devem totalizar 100% por serviço.", ""],
    ["4", "Valores monetários são calculados com truncamento após a segunda casa decimal.", ""],
    ["5", "Senha de proteção administrativa: PRUMO.", ""],
  ];
  const aba = XLSX.utils.aoa_to_sheet(dados);
  aba["!merges"] = [
    XLSX.utils.decode_range("A1:C1"),
    XLSX.utils.decode_range("A2:C2"),
    XLSX.utils.decode_range("A10:C10"),
  ];
  prepararAba(aba, [18, 72, 24], "A3:C8", { xSplit: 0, ySplit: 3 });
  aplicarEstiloCabecalho(aba, "A3:C3");
  aplicarEstiloCabecalho(aba, "A10:C10");
  estilizarCelula(aba.A1, { preenchimento: COR.marinho, corTexto: COR.branco, negrito: true });
  estilizarCelula(aba.A2, { preenchimento: COR.claro, corTexto: COR.verde, negrito: true });
  return aba;
}

function criarOrcamentoCompleto(XLSX, orcamento) {
  const distribuicao = calcularDistribuicaoDesconto(orcamento);
  const bdi = obterBdi(orcamento) / 100;
  const hierarquias = mapearHierarquiaEap(orcamento.itens);
  const cabecalho = [
    "ITEM",
    ...CABECALHOS_EAP,
    "DESCRIÇÃO",
    "BASE / REFERÊNCIA",
    "UN.",
    "QUANTIDADE",
    "CUSTO UNITÁRIO",
    "VALOR BRUTO",
    "DESCONTO",
    "VALOR LÍQUIDO",
    "BDI",
    "PREÇO TOTAL",
  ];
  const linhas = [
    ["ORÇAMENTO COMPLETO", ...Array(cabecalho.length - 1).fill("")],
    [subtituloPacote(orcamento), ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
  ];
  const linhasServico = new Map();
  orcamento.itens.forEach((item) => {
    const linha = linhas.length + 1;
    const hierarquia = valoresHierarquia(hierarquias.get(item.id));
    if (item.tipo === "grupo") {
      linhas.push([
        item.codigo,
        ...hierarquia,
        item.descricao,
        `EAP · ${item.nivelEap || ""}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      return;
    }
    linhasServico.set(item.id, linha);
    linhas.push([
      item.codigo,
      ...hierarquia,
      item.descricao,
      item.fonte || "Preço manual",
      item.unidade,
      Number(item.quantidade) || 0,
      Number(item.unitario) || 0,
      null,
      null,
      null,
      bdi,
      null,
    ]);
    const desconto = distribuicao.porItem.get(item.id) || 0;
    linhas[linha - 1][12] = desconto;
  });
  const totalLinha = linhas.length + 1;
  linhas.push(["", ...Array(5).fill(""), "TOTAL GERAL", "", "", "", "", null, null, null, "", null]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  adicionarTitulo(XLSX, aba, "ORÇAMENTO COMPLETO", subtituloPacote(orcamento), "P");
  aplicarEstiloCabecalho(aba, "A3:P3");
  for (let linha = 4; linha < totalLinha; linha += 1) {
    const item = orcamento.itens[linha - 4];
    if (item.tipo === "grupo") {
      enderecosIntervalo(XLSX, `A${linha}:P${linha}`).forEach((endereco) => {
        estilizarCelula(aba[endereco], { preenchimento: COR.cinza, negrito: true });
      });
      continue;
    }
    aba[`L${linha}`] = { t: "n", f: `IF(I${linha}="","",TRUNC(J${linha}*K${linha},2))` };
    aba[`N${linha}`] = { t: "n", f: `IF(L${linha}="","",TRUNC(L${linha}-M${linha},2))` };
    aba[`P${linha}`] = { t: "n", f: `IF(N${linha}="","",TRUNC(N${linha}*(1+O${linha}),2))` };
    ["K", "L", "M", "N", "P"].forEach((coluna) => estilizarCelula(aba[`${coluna}${linha}`], {
      formato: formatoMoeda,
      alinhamento: "right",
    }));
    estilizarCelula(aba[`O${linha}`], { formato: formatoPercentual, alinhamento: "right" });
  }
  aba[`L${totalLinha}`] = { t: "n", f: `SUM(L4:L${totalLinha - 1})` };
  aba[`M${totalLinha}`] = { t: "n", f: `SUM(M4:M${totalLinha - 1})` };
  aba[`N${totalLinha}`] = { t: "n", f: `SUM(N4:N${totalLinha - 1})` };
  aba[`P${totalLinha}`] = { t: "n", f: `SUM(P4:P${totalLinha - 1})` };
  enderecosIntervalo(XLSX, `A${totalLinha}:P${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: ["L", "M", "N", "P"].includes(endereco.match(/^[A-Z]+/)?.[0]) ? formatoMoeda : undefined,
    });
  });
  prepararAba(aba, [11, 20, 20, 20, 20, 22, 44, 26, 9, 13, 16, 16, 15, 16, 10, 17], `A3:P${totalLinha}`);
  return { aba, linhasServico };
}

function criarProposta(XLSX, orcamento) {
  const servicos = orcamento.itens.filter((item) => item.tipo !== "grupo");
  const hierarquias = mapearHierarquiaEap(orcamento.itens);
  const cabecalho = [
    "ITEM",
    ...CABECALHOS_EAP,
    "DESCRIÇÃO",
    "UN.",
    "QUANTIDADE",
    "PREÇO UNITÁRIO PROPOSTO",
    "PREÇO TOTAL",
    "OBSERVAÇÃO",
  ];
  const linhas = [
    ["PROPOSTA DE PREÇOS", ...Array(cabecalho.length - 1).fill("")],
    [subtituloPacote(orcamento), ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
    ...servicos.map((item) => [
      item.codigo,
      ...valoresHierarquia(hierarquias.get(item.id)),
      item.descricao,
      item.unidade,
      Number(item.quantidade) || 0,
      null,
      null,
      "",
    ]),
  ];
  const totalLinha = linhas.length + 1;
  linhas.push(["", ...Array(5).fill(""), "TOTAL DA PROPOSTA", "", "", "", null, ""]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  adicionarTitulo(XLSX, aba, "PROPOSTA DE PREÇOS", subtituloPacote(orcamento), "L");
  aplicarEstiloCabecalho(aba, "A3:L3");
  for (let linha = 4; linha < totalLinha; linha += 1) {
    aba[`K${linha}`] = { t: "n", f: `IF(ISNUMBER(J${linha}),TRUNC(I${linha}*J${linha},2),0)` };
    estilizarCelula(aba[`J${linha}`] || (aba[`J${linha}`] = { t: "s", v: "" }), {
      preenchimento: COR.entrada,
      bloqueada: false,
      formato: formatoMoeda,
    });
    estilizarCelula(aba[`K${linha}`], { formato: formatoMoeda });
    estilizarCelula(aba[`L${linha}`] || (aba[`L${linha}`] = { t: "s", v: "" }), {
      preenchimento: COR.entrada,
      bloqueada: false,
    });
  }
  aba[`K${totalLinha}`] = { t: "n", f: `SUM(K4:K${totalLinha - 1})` };
  enderecosIntervalo(XLSX, `A${totalLinha}:L${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: endereco === `K${totalLinha}` ? formatoMoeda : undefined,
    });
  });
  prepararAba(aba, [11, 20, 20, 20, 20, 22, 48, 9, 13, 22, 18, 30], `A3:L${totalLinha}`);
  return aba;
}

function criarBdiEncargos(XLSX, orcamento) {
  const linhas = [
    ["BDI E ENCARGOS SOCIAIS", "", "", "", ""],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "", "", "", ""],
    ["CÓDIGO", "GRUPO / ITEM", "PERCENTUAL", "TIPO", "OBSERVAÇÃO"],
  ];
  const totaisBdi = {};
  (orcamento.bdiComponentes?.grupos || []).forEach((grupo) => {
    linhas.push([grupo.id, `GRUPO ${grupo.id} — ${grupo.nome}`, null, "BDI", ""]);
    const inicio = linhas.length + 1;
    grupo.itens.forEach((item) => linhas.push([
      item.id,
      item.descricao,
      (Number(item.percentual) || 0) / 100,
      "BDI",
      "",
    ]));
    const fim = linhas.length;
    const linhaTotal = linhas.length + 1;
    linhas.push(["", `TOTAL GRUPO ${grupo.id}`, null, "BDI", ""]);
    totaisBdi[grupo.id] = { linhaTotal, inicio, fim };
  });
  const linhaBdi = linhas.length + 1;
  linhas.push(["", "BDI CALCULADO", null, "RESULTADO", "Fórmula analítica"]);
  linhas.push(["", "", "", "", ""]);
  const encargosInicio = linhas.length + 1;
  linhas.push(["", "ENCARGOS SOCIAIS", null, "", ""]);
  const totaisEncargos = [];
  (orcamento.encargosSociais?.grupos || []).forEach((grupo) => {
    linhas.push([grupo.id, `GRUPO ${grupo.id} — ${grupo.nome}`, null, "ENCARGOS", ""]);
    const inicio = linhas.length + 1;
    grupo.itens.forEach((item) => linhas.push([
      item.id,
      item.descricao,
      (Number(item.percentual) || 0) / 100,
      "ENCARGOS",
      "",
    ]));
    const fim = linhas.length;
    const linhaTotal = linhas.length + 1;
    linhas.push(["", `TOTAL GRUPO ${grupo.id}`, null, "ENCARGOS", ""]);
    totaisEncargos.push({ linhaTotal, inicio, fim });
  });
  const linhaEncargos = linhas.length + 1;
  linhas.push(["", "TOTAL GERAL DOS ENCARGOS", null, "RESULTADO", ""]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  adicionarTitulo(XLSX, aba, "BDI E ENCARGOS SOCIAIS", subtituloPacote(orcamento), "E");
  aplicarEstiloCabecalho(aba, "A3:E3");

  Object.values(totaisBdi).forEach(({ linhaTotal, inicio, fim }) => {
    aba[`C${linhaTotal}`] = { t: "n", f: `SUM(C${inicio}:C${fim})` };
  });
  const a = totaisBdi.A?.linhaTotal || 1;
  const b = totaisBdi.B?.linhaTotal || 1;
  const c = totaisBdi.C?.linhaTotal || 1;
  const d = totaisBdi.D?.linhaTotal || 1;
  const e = totaisBdi.E?.linhaTotal || 1;
  aba[`C${linhaBdi}`] = {
    t: "n",
    f: `(((1+C${a}+C${b})*(1+C${c})*(1+C${d}))/(1-C${e}))-1`,
  };
  totaisEncargos.forEach(({ linhaTotal, inicio, fim }) => {
    aba[`C${linhaTotal}`] = { t: "n", f: `SUM(C${inicio}:C${fim})` };
  });
  aba[`C${linhaEncargos}`] = {
    t: "n",
    f: `SUM(${totaisEncargos.map(({ linhaTotal }) => `C${linhaTotal}`).join(",")})`,
  };

  for (let linha = 4; linha <= linhaEncargos; linha += 1) {
    const tipo = aba[`D${linha}`]?.v;
    const total = String(aba[`B${linha}`]?.v || "").startsWith("TOTAL") || tipo === "RESULTADO";
    const grupo = String(aba[`B${linha}`]?.v || "").startsWith("GRUPO");
    if (tipo === "BDI" || tipo === "ENCARGOS") {
      const editavel = !grupo && !total && aba[`A${linha}`]?.v;
      if (editavel) {
        estilizarCelula(aba[`C${linha}`], {
          preenchimento: COR.entrada,
          bloqueada: false,
          formato: formatoPercentual,
        });
      }
    }
    if (grupo || total || linha === encargosInicio) {
      enderecosIntervalo(XLSX, `A${linha}:E${linha}`).forEach((endereco) => {
        estilizarCelula(aba[endereco], {
          preenchimento: total ? COR.claro : COR.cinza,
          negrito: true,
          formato: endereco === `C${linha}` ? formatoPercentual : undefined,
        });
      });
    }
  }
  prepararAba(aba, [11, 62, 15, 14, 30], `A3:E${linhaEncargos}`);
  return aba;
}

function criarCronograma(XLSX, orcamento, linhasOrcamento) {
  const periodos = criarPeriodosMedicao(orcamento);
  const servicos = orcamento.itens.filter((item) => item.tipo !== "grupo");
  const hierarquias = mapearHierarquiaEap(orcamento.itens);
  const cabecalho = [
    "ITEM",
    ...CABECALHOS_EAP,
    "DESCRIÇÃO",
    "VALOR LÍQUIDO",
    ...periodos.map((periodo) => periodo.label),
    "TOTAL DISTRIBUÍDO",
    "STATUS",
  ];
  const linhas = [
    ["CRONOGRAMA FÍSICO-FINANCEIRO", ...Array(cabecalho.length - 1).fill("")],
    [subtituloPacote(orcamento), ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
    ...servicos.map((item) => [
      item.codigo,
      ...valoresHierarquia(hierarquias.get(item.id)),
      item.descricao,
      null,
      ...Array(periodos.length).fill(0),
      null,
      null,
    ]),
  ];
  const resumoLinha = linhas.length + 2;
  linhas.push(Array(cabecalho.length).fill(""));
  linhas.push([
    "",
    ...Array(5).fill(""),
    "VALOR PLANEJADO POR PERÍODO",
    "",
    ...Array(periodos.length).fill(null),
    "",
    "",
  ]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const ultimaColuna = XLSX.utils.encode_col(cabecalho.length - 1);
  const colunaValor = 7;
  const colunaInicioPeriodos = 8;
  const colunaFimPeriodos = colunaInicioPeriodos + periodos.length - 1;
  const colunaTotal = colunaFimPeriodos + 1;
  const colunaStatus = colunaTotal + 1;
  adicionarTitulo(XLSX, aba, "CRONOGRAMA FÍSICO-FINANCEIRO", subtituloPacote(orcamento), ultimaColuna);
  aplicarEstiloCabecalho(aba, `A3:${ultimaColuna}3`);
  servicos.forEach((item, indice) => {
    const linha = indice + 4;
    const linhaOrcamento = linhasOrcamento.get(item.id);
    const letraValor = XLSX.utils.encode_col(colunaValor);
    aba[`${letraValor}${linha}`] = { t: "n", f: `='Orçamento Completo'!N${linhaOrcamento}` };
    for (let coluna = colunaInicioPeriodos; coluna <= colunaFimPeriodos; coluna += 1) {
      const endereco = `${XLSX.utils.encode_col(coluna)}${linha}`;
      estilizarCelula(aba[endereco], {
        preenchimento: COR.entrada,
        bloqueada: false,
        formato: formatoPercentual,
      });
    }
    const letraInicio = XLSX.utils.encode_col(colunaInicioPeriodos);
    const letraFim = XLSX.utils.encode_col(colunaFimPeriodos);
    const letraTotal = XLSX.utils.encode_col(colunaTotal);
    const letraStatus = XLSX.utils.encode_col(colunaStatus);
    aba[`${letraTotal}${linha}`] = { t: "n", f: `SUM(${letraInicio}${linha}:${letraFim}${linha})` };
    aba[`${letraStatus}${linha}`] = { t: "s", f: `IF(ABS(${letraTotal}${linha}-1)<0.0001,"OK","REVISAR")` };
    estilizarCelula(aba[`${letraValor}${linha}`], { formato: formatoMoeda });
    estilizarCelula(aba[`${letraTotal}${linha}`], { formato: formatoPercentual });
  });
  for (let coluna = colunaInicioPeriodos; coluna <= colunaFimPeriodos; coluna += 1) {
    const letra = XLSX.utils.encode_col(coluna);
    const letraValor = XLSX.utils.encode_col(colunaValor);
    aba[`${letra}${resumoLinha}`] = {
      t: "n",
      f: `SUMPRODUCT($${letraValor}$4:$${letraValor}$${servicos.length + 3},${letra}$4:${letra}$${servicos.length + 3})`,
    };
    estilizarCelula(aba[`${letra}${resumoLinha}`], { formato: formatoMoeda, negrito: true });
  }
  enderecosIntervalo(XLSX, `A${resumoLinha}:${ultimaColuna}${resumoLinha}`).forEach((endereco) => {
    const coluna = XLSX.utils.decode_cell(endereco).c;
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: coluna >= colunaInicioPeriodos && coluna <= colunaFimPeriodos ? formatoMoeda : undefined,
    });
  });
  prepararAba(
    aba,
    [11, 20, 20, 20, 20, 22, 44, 17, ...Array(periodos.length).fill(17), 16, 13],
    `A3:${ultimaColuna}${resumoLinha}`,
  );
  return {
    aba,
    periodos,
    linhasServico: new Map(servicos.map((item, indice) => [item.id, indice + 4])),
  };
}

function criarHistograma(XLSX, orcamento, cronograma) {
  const { periodos, linhasServico: linhasCronograma } = cronograma;
  const composicoes = new Map((orcamento.composicoes || []).map((item) => [item.codigo, item]));
  const hierarquias = mapearHierarquiaEap(orcamento.itens);
  const recursos = [];
  orcamento.itens.filter((item) => item.tipo !== "grupo").forEach((item) => {
    const codigo = item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim();
    const composicao = composicoes.get(codigo);
    (composicao?.componentes || []).filter((componente) => (
      ["H", "HORA", "HH"].includes(String(componente.unidade || "").toUpperCase())
      || String(componente.referenciaTipo || "").toLowerCase().includes("mao")
    )).forEach((componente) => {
      recursos.push({
        item,
        descricao: componente.descricao || componente.referenciaCodigo,
        coeficiente: Number(componente.coeficiente) || 0,
      });
    });
  });
  if (!recursos.length) {
    recursos.push(
      { item: null, descricao: "Pedreiro", coeficiente: 0 },
      { item: null, descricao: "Servente", coeficiente: 0 },
      { item: null, descricao: "Eletricista", coeficiente: 0 },
      { item: null, descricao: "Encanador", coeficiente: 0 },
    );
  }
  const cabecalho = [
    "ITEM",
    ...CABECALHOS_EAP,
    "RECURSO DE MÃO DE OBRA",
    "COEFICIENTE (H)",
    "HORAS TOTAIS",
    ...periodos.map((periodo) => periodo.label),
  ];
  const linhas = [
    ["HISTOGRAMA DE MÃO DE OBRA", ...Array(cabecalho.length - 1).fill("")],
    [subtituloPacote(orcamento), ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
    ...recursos.map((recurso) => [
      recurso.item?.codigo || "",
      ...valoresHierarquia(recurso.item ? hierarquias.get(recurso.item.id) : null),
      recurso.descricao,
      recurso.coeficiente,
      recurso.item ? (Number(recurso.item.quantidade) || 0) * recurso.coeficiente : 0,
      ...Array(periodos.length).fill(null),
    ]),
  ];
  const totalLinha = linhas.length + 1;
  linhas.push(["", ...Array(5).fill(""), "TOTAL DE HORAS", "", null, ...Array(periodos.length).fill(null)]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const ultimaColuna = XLSX.utils.encode_col(cabecalho.length - 1);
  const colunaHoras = 8;
  const colunaInicioPeriodos = 9;
  const colunaFimPeriodos = colunaInicioPeriodos + periodos.length - 1;
  adicionarTitulo(XLSX, aba, "HISTOGRAMA DE MÃO DE OBRA", subtituloPacote(orcamento), ultimaColuna);
  aplicarEstiloCabecalho(aba, `A3:${ultimaColuna}3`);
  recursos.forEach((recurso, indice) => {
    const linha = indice + 4;
    for (let coluna = colunaInicioPeriodos; coluna <= colunaFimPeriodos; coluna += 1) {
      const letra = XLSX.utils.encode_col(coluna);
      const linhaCronograma = recurso.item ? linhasCronograma.get(recurso.item.id) : null;
      aba[`${letra}${linha}`] = {
        t: "n",
        f: linhaCronograma
          ? `TRUNC($${XLSX.utils.encode_col(colunaHoras)}${linha}*'Cronograma'!${XLSX.utils.encode_col(coluna - 1)}${linhaCronograma},2)`
          : "0",
      };
      estilizarCelula(aba[`${letra}${linha}`], { formato: "#,##0.00" });
    }
  });
  const letraHoras = XLSX.utils.encode_col(colunaHoras);
  aba[`${letraHoras}${totalLinha}`] = { t: "n", f: `SUM(${letraHoras}4:${letraHoras}${totalLinha - 1})` };
  for (let coluna = colunaInicioPeriodos; coluna <= colunaFimPeriodos; coluna += 1) {
    const letra = XLSX.utils.encode_col(coluna);
    aba[`${letra}${totalLinha}`] = { t: "n", f: `SUM(${letra}4:${letra}${totalLinha - 1})` };
  }
  enderecosIntervalo(XLSX, `A${totalLinha}:${ultimaColuna}${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], { preenchimento: COR.claro, negrito: true, formato: "#,##0.00" });
  });
  prepararAba(
    aba,
    [11, 20, 20, 20, 20, 22, 38, 17, 16, ...Array(periodos.length).fill(17)],
    `A3:${ultimaColuna}${totalLinha}`,
  );
  return aba;
}

export async function criarPacoteLicitacao(orcamento) {
  const XLSX = await import("xlsx");
  globalThis.__PRUMO_XLSX__ = XLSX;
  const workbook = XLSX.utils.book_new();
  const orcamentoCompleto = criarOrcamentoCompleto(XLSX, orcamento);
  const cronograma = criarCronograma(XLSX, orcamento, orcamentoCompleto.linhasServico);
  const abas = [
    ["Instruções", criarInstrucoes(XLSX, orcamento)],
    ["Orçamento Completo", orcamentoCompleto.aba],
    ["Proposta de Preços", criarProposta(XLSX, orcamento)],
    ["BDI e Encargos", criarBdiEncargos(XLSX, orcamento)],
    ["Cronograma", cronograma.aba],
    ["Histograma", criarHistograma(XLSX, orcamento, cronograma)],
  ];
  abas.forEach(([nome, aba]) => XLSX.utils.book_append_sheet(workbook, aba, nome));
  workbook.Workbook = {
    ...(workbook.Workbook || {}),
    CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true },
  };
  delete globalThis.__PRUMO_XLSX__;
  return workbook;
}

export async function gerarArquivoPacoteLicitacao(orcamento) {
  const XLSX = await import("xlsx");
  const workbook = await criarPacoteLicitacao(orcamento);
  const conteudoBase = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
    compression: true,
  });
  const moduloExcelJs = await import("exceljs");
  const ExcelJS = moduloExcelJs.default || moduloExcelJs;
  const workbookFinal = new ExcelJS.Workbook();
  await workbookFinal.xlsx.load(conteudoBase);
  workbookFinal.calcProperties.fullCalcOnLoad = true;
  workbookFinal.calcProperties.forceFullCalc = true;
  workbookFinal.calcProperties.calcMode = "auto";

  const bordaInferior = { style: "thin", color: { argb: "DDE6E7" } };
  const estiloTitulo = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.marinho } },
    font: { bold: true, color: { argb: COR.branco }, size: 14 },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  const estiloSubtitulo = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.claro } },
    font: { bold: true, color: { argb: COR.verde }, size: 10 },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  const estiloCabecalho = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.marinho } },
    font: { bold: true, color: { argb: COR.branco }, size: 9 },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  };
  const colunaPorCabecalho = (aba, cabecalho) => {
    let encontrada = 0;
    aba.getRow(3).eachCell((celula, coluna) => {
      if (String(celula.value || "") === cabecalho) encontrada = coluna;
    });
    return encontrada;
  };

  workbookFinal.eachSheet((aba) => {
    aba.views = [{ state: "frozen", ySplit: 3 }];
    aba.showGridLines = false;
    aba.getRow(1).height = 24;
    aba.getRow(2).height = 20;
    aba.getRow(3).height = 28;
    aba.getRow(1).eachCell({ includeEmpty: true }, (celula) => Object.assign(celula, estiloTitulo));
    aba.getRow(2).eachCell({ includeEmpty: true }, (celula) => Object.assign(celula, estiloSubtitulo));
    aba.getRow(3).eachCell({ includeEmpty: true }, (celula) => Object.assign(celula, estiloCabecalho));
    aba.eachRow((linha, numeroLinha) => {
      if (numeroLinha <= 3) return;
      linha.eachCell({ includeEmpty: true }, (celula) => {
        celula.style = {
          ...(celula.style || {}),
          font: { name: "Aptos", size: 9, color: { argb: COR.texto } },
          alignment: {
            vertical: "middle",
            horizontal: typeof celula.value === "number" ? "right" : "left",
            wrapText: false,
          },
          border: { bottom: bordaInferior },
          protection: { locked: true },
        };
      });
    });
  });

  const instrucoes = workbookFinal.getWorksheet("Instruções");
  instrucoes.getRow(10).eachCell({ includeEmpty: true }, (celula) => Object.assign(celula, estiloCabecalho));

  const completa = workbookFinal.getWorksheet("Orçamento Completo");
  const colunaBaseCompleta = colunaPorCabecalho(completa, "BASE / REFERÊNCIA");
  const colunaDescricaoCompleta = colunaPorCabecalho(completa, "DESCRIÇÃO");
  completa.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4) return;
    const grupo = String(linha.getCell(colunaBaseCompleta).value || "").startsWith("EAP");
    const total = String(linha.getCell(colunaDescricaoCompleta).value || "").startsWith("TOTAL");
    if (grupo || total) {
      linha.eachCell({ includeEmpty: true }, (celula) => {
        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: total ? COR.claro : COR.cinza },
        };
        celula.font = { name: "Aptos", size: 9, bold: true, color: { argb: COR.texto } };
      });
    }
  });

  const proposta = workbookFinal.getWorksheet("Proposta de Preços");
  const colunaPrecoProposto = colunaPorCabecalho(proposta, "PREÇO UNITÁRIO PROPOSTO");
  const colunaTotalProposta = colunaPorCabecalho(proposta, "PREÇO TOTAL");
  const colunaObservacao = colunaPorCabecalho(proposta, "OBSERVAÇÃO");
  proposta.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4 || !linha.getCell(1).value) return;
    [colunaPrecoProposto, colunaObservacao].forEach((coluna) => {
      const celula = linha.getCell(coluna);
      celula.style = {
        ...(celula.style || {}),
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.entrada } },
        protection: { locked: false },
      };
    });
    linha.getCell(colunaPrecoProposto).numFmt = formatoMoeda;
    linha.getCell(colunaTotalProposta).numFmt = formatoMoeda;
  });

  const bdiEncargos = workbookFinal.getWorksheet("BDI e Encargos");
  bdiEncargos.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4) return;
    const descricao = String(linha.getCell(2).value || "");
    const tipo = String(linha.getCell(4).value || "");
    const grupo = descricao.startsWith("GRUPO") || descricao === "ENCARGOS SOCIAIS";
    const total = descricao.startsWith("TOTAL") || tipo === "RESULTADO";
    if (grupo || total) {
      linha.eachCell({ includeEmpty: true }, (celula) => {
        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: total ? COR.claro : COR.cinza },
        };
        celula.font = { name: "Aptos", size: 9, bold: true, color: { argb: COR.texto } };
      });
    } else if (linha.getCell(1).value && ["BDI", "ENCARGOS"].includes(tipo)) {
      const percentual = linha.getCell(3);
      percentual.style = {
        ...(percentual.style || {}),
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.entrada } },
        protection: { locked: false },
      };
      percentual.numFmt = formatoPercentual;
    }
  });

  const cronograma = workbookFinal.getWorksheet("Cronograma");
  const colunaValorCronograma = colunaPorCabecalho(cronograma, "VALOR LÍQUIDO");
  const colunaTotalCronograma = colunaPorCabecalho(cronograma, "TOTAL DISTRIBUÍDO");
  cronograma.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4 || !linha.getCell(1).value) return;
    for (let coluna = colunaValorCronograma + 1; coluna < colunaTotalCronograma; coluna += 1) {
      const celula = linha.getCell(coluna);
      celula.style = {
        ...(celula.style || {}),
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.entrada } },
        protection: { locked: false },
      };
      celula.numFmt = formatoPercentual;
    }
  });

  for (const aba of workbookFinal.worksheets) {
    await aba.protect("PRUMO", {
      selectLockedCells: false,
      selectUnlockedCells: true,
      autoFilter: true,
      sort: false,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      deleteRows: false,
    });
  }

  return workbookFinal.xlsx.writeBuffer();
}

export async function baixarPacoteLicitacao(orcamento) {
  const conteudo = await gerarArquivoPacoteLicitacao(orcamento);
  const arquivo = new Blob([conteudo], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = `${nomeSeguroArquivo(orcamento.id)}-${nomeSeguroArquivo(orcamento.revisao)}-licitacao.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(endereco), 1_000);
}

export function resumirPacoteLicitacao(orcamento) {
  const totais = calcularTotais(orcamento);
  return {
    abas: 6,
    servicos: orcamento.itens.filter((item) => item.tipo !== "grupo").length,
    composicoes: orcamento.composicoes?.length || 0,
    periodos: criarPeriodosMedicao(orcamento).length,
    precoTotal: totais.precoTotal,
    bdi: totais.bdi,
  };
}
