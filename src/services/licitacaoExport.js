import {
  calcularDistribuicaoDesconto,
  calcularTotais,
  obterBdi,
} from "../domain/orcamento.js";

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

function mesesCronograma(orcamento) {
  const inicio = new Date(orcamento.inicioObra || orcamento.atualizadoEm || "2026-07-01");
  return Array.from({ length: 12 }, (_, indice) => {
    const data = new Date(inicio.getFullYear(), inicio.getMonth() + indice, 1);
    return data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(".", "")
      .replace(" de ", "/");
  });
}

function criarInstrucoes(XLSX, orcamento) {
  const dados = [
    ["PACOTE DE LICITAÇÃO E CONCORRÊNCIA", "", ""],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "", ""],
    ["GUIA", "FINALIDADE", "EDIÇÃO"],
    ["Orçamento Completo", "Memória da planilha com bases, custos, desconto e BDI.", "Somente leitura"],
    ["Proposta de Preços", "Preenchimento dos preços unitários pelos concorrentes.", "Células amarelas"],
    ["BDI e Encargos", "Preenchimento analítico dos percentuais de BDI e encargos.", "Células amarelas"],
    ["Cronograma", "Distribuição percentual dos serviços em até 12 meses.", "Células amarelas"],
    ["Histograma", "Horas de mão de obra derivadas do cronograma.", "Somente leitura"],
    ["", "", ""],
    ["REGRAS", "", ""],
    ["1", "Não alterar códigos, descrições, unidades ou fórmulas.", ""],
    ["2", "Preencher somente as células amarelas.", ""],
    ["3", "Os percentuais mensais do cronograma devem totalizar 100% por serviço.", ""],
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
  const linhas = [
    ["ORÇAMENTO COMPLETO", "", "", "", "", "", "", "", "", "", ""],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "", "", "", "", "", "", "", "", "", ""],
    ["ITEM", "DESCRIÇÃO", "BASE / REFERÊNCIA", "UN.", "QUANTIDADE", "CUSTO UNITÁRIO", "VALOR BRUTO", "DESCONTO", "VALOR LÍQUIDO", "BDI", "PREÇO TOTAL"],
  ];
  const linhasServico = new Map();
  orcamento.itens.forEach((item) => {
    const linha = linhas.length + 1;
    if (item.tipo === "grupo") {
      linhas.push([item.codigo, item.descricao, `EAP · ${item.nivelEap || ""}`, "", "", "", "", "", "", "", ""]);
      return;
    }
    linhasServico.set(item.id, linha);
    linhas.push([
      item.codigo,
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
    linhas[linha - 1][7] = desconto;
  });
  const totalLinha = linhas.length + 1;
  linhas.push(["", "TOTAL GERAL", "", "", "", "", null, null, null, "", null]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  adicionarTitulo(XLSX, aba, "ORÇAMENTO COMPLETO", `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "K");
  aplicarEstiloCabecalho(aba, "A3:K3");
  for (let linha = 4; linha < totalLinha; linha += 1) {
    const item = orcamento.itens[linha - 4];
    if (item.tipo === "grupo") {
      enderecosIntervalo(XLSX, `A${linha}:K${linha}`).forEach((endereco) => {
        estilizarCelula(aba[endereco], { preenchimento: COR.cinza, negrito: true });
      });
      continue;
    }
    aba[`G${linha}`] = { t: "n", f: `IF(D${linha}="","",TRUNC(E${linha}*F${linha},2))` };
    aba[`I${linha}`] = { t: "n", f: `IF(G${linha}="","",TRUNC(G${linha}-H${linha},2))` };
    aba[`K${linha}`] = { t: "n", f: `IF(I${linha}="","",TRUNC(I${linha}*(1+J${linha}),2))` };
    ["F", "G", "H", "I", "K"].forEach((coluna) => estilizarCelula(aba[`${coluna}${linha}`], {
      formato: formatoMoeda,
      alinhamento: "right",
    }));
    estilizarCelula(aba[`J${linha}`], { formato: formatoPercentual, alinhamento: "right" });
  }
  aba[`G${totalLinha}`] = { t: "n", f: `SUM(G4:G${totalLinha - 1})` };
  aba[`H${totalLinha}`] = { t: "n", f: `SUM(H4:H${totalLinha - 1})` };
  aba[`I${totalLinha}`] = { t: "n", f: `SUM(I4:I${totalLinha - 1})` };
  aba[`K${totalLinha}`] = { t: "n", f: `SUM(K4:K${totalLinha - 1})` };
  enderecosIntervalo(XLSX, `A${totalLinha}:K${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: ["G", "H", "I", "K"].includes(endereco[0]) ? formatoMoeda : undefined,
    });
  });
  prepararAba(aba, [12, 48, 28, 9, 13, 16, 16, 15, 16, 10, 17], `A3:K${totalLinha}`);
  return { aba, linhasServico };
}

function criarProposta(XLSX, orcamento) {
  const servicos = orcamento.itens.filter((item) => item.tipo !== "grupo");
  const linhas = [
    ["PROPOSTA DE PREÇOS", "", "", "", "", "", ""],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "", "", "", "", "", ""],
    ["ITEM", "DESCRIÇÃO", "UN.", "QUANTIDADE", "PREÇO UNITÁRIO PROPOSTO", "PREÇO TOTAL", "OBSERVAÇÃO"],
    ...servicos.map((item) => [
      item.codigo,
      item.descricao,
      item.unidade,
      Number(item.quantidade) || 0,
      null,
      null,
      "",
    ]),
  ];
  const totalLinha = linhas.length + 1;
  linhas.push(["", "TOTAL DA PROPOSTA", "", "", "", null, ""]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  adicionarTitulo(XLSX, aba, "PROPOSTA DE PREÇOS", `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "G");
  aplicarEstiloCabecalho(aba, "A3:G3");
  for (let linha = 4; linha < totalLinha; linha += 1) {
    aba[`F${linha}`] = { t: "n", f: `IF(ISNUMBER(E${linha}),TRUNC(D${linha}*E${linha},2),0)` };
    estilizarCelula(aba[`E${linha}`] || (aba[`E${linha}`] = { t: "s", v: "" }), {
      preenchimento: COR.entrada,
      bloqueada: false,
      formato: formatoMoeda,
    });
    estilizarCelula(aba[`F${linha}`], { formato: formatoMoeda });
    estilizarCelula(aba[`G${linha}`] || (aba[`G${linha}`] = { t: "s", v: "" }), {
      preenchimento: COR.entrada,
      bloqueada: false,
    });
  }
  aba[`F${totalLinha}`] = { t: "n", f: `SUM(F4:F${totalLinha - 1})` };
  enderecosIntervalo(XLSX, `A${totalLinha}:G${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: endereco === `F${totalLinha}` ? formatoMoeda : undefined,
    });
  });
  prepararAba(aba, [12, 55, 9, 13, 22, 18, 32], `A3:G${totalLinha}`);
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
  adicionarTitulo(XLSX, aba, "BDI E ENCARGOS SOCIAIS", `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, "E");
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
  const meses = mesesCronograma(orcamento);
  const servicos = orcamento.itens.filter((item) => item.tipo !== "grupo");
  const cabecalho = ["ITEM", "DESCRIÇÃO", "VALOR LÍQUIDO", ...meses, "TOTAL DISTRIBUÍDO", "STATUS"];
  const linhas = [
    ["CRONOGRAMA FÍSICO-FINANCEIRO", ...Array(cabecalho.length - 1).fill("")],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
    ...servicos.map((item) => [
      item.codigo,
      item.descricao,
      null,
      ...Array(12).fill(0),
      null,
      null,
    ]),
  ];
  const resumoLinha = linhas.length + 2;
  linhas.push(Array(cabecalho.length).fill(""));
  linhas.push(["", "VALOR PLANEJADO POR MÊS", "", ...Array(12).fill(null), "", ""]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const ultimaColuna = XLSX.utils.encode_col(cabecalho.length - 1);
  adicionarTitulo(XLSX, aba, "CRONOGRAMA FÍSICO-FINANCEIRO", `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, ultimaColuna);
  aplicarEstiloCabecalho(aba, `A3:${ultimaColuna}3`);
  servicos.forEach((item, indice) => {
    const linha = indice + 4;
    const linhaOrcamento = linhasOrcamento.get(item.id);
    aba[`C${linha}`] = { t: "n", f: `='Orçamento Completo'!I${linhaOrcamento}` };
    for (let coluna = 3; coluna < 15; coluna += 1) {
      const endereco = `${XLSX.utils.encode_col(coluna)}${linha}`;
      estilizarCelula(aba[endereco], {
        preenchimento: COR.entrada,
        bloqueada: false,
        formato: formatoPercentual,
      });
    }
    aba[`P${linha}`] = { t: "n", f: `SUM(D${linha}:O${linha})` };
    aba[`Q${linha}`] = { t: "s", f: `IF(ABS(P${linha}-1)<0.0001,"OK","REVISAR")` };
    estilizarCelula(aba[`C${linha}`], { formato: formatoMoeda });
    estilizarCelula(aba[`P${linha}`], { formato: formatoPercentual });
  });
  for (let coluna = 3; coluna < 15; coluna += 1) {
    const letra = XLSX.utils.encode_col(coluna);
    aba[`${letra}${resumoLinha}`] = {
      t: "n",
      f: `SUMPRODUCT($C$4:$C$${servicos.length + 3},${letra}$4:${letra}$${servicos.length + 3})`,
    };
    estilizarCelula(aba[`${letra}${resumoLinha}`], { formato: formatoMoeda, negrito: true });
  }
  enderecosIntervalo(XLSX, `A${resumoLinha}:Q${resumoLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], {
      preenchimento: COR.claro,
      negrito: true,
      formato: endereco.match(/^[D-O]/) ? formatoMoeda : undefined,
    });
  });
  prepararAba(aba, [11, 44, 17, ...Array(12).fill(12), 16, 13], `A3:Q${resumoLinha}`);
  return { aba, linhasServico: new Map(servicos.map((item, indice) => [item.id, indice + 4])) };
}

function criarHistograma(XLSX, orcamento, linhasCronograma) {
  const meses = mesesCronograma(orcamento);
  const composicoes = new Map((orcamento.composicoes || []).map((item) => [item.codigo, item]));
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
  const cabecalho = ["ITEM", "RECURSO DE MÃO DE OBRA", "COEFICIENTE (H)", "HORAS TOTAIS", ...meses];
  const linhas = [
    ["HISTOGRAMA DE MÃO DE OBRA", ...Array(cabecalho.length - 1).fill("")],
    [`${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, ...Array(cabecalho.length - 1).fill("")],
    cabecalho,
    ...recursos.map((recurso) => [
      recurso.item?.codigo || "",
      recurso.descricao,
      recurso.coeficiente,
      recurso.item ? (Number(recurso.item.quantidade) || 0) * recurso.coeficiente : 0,
      ...Array(12).fill(null),
    ]),
  ];
  const totalLinha = linhas.length + 1;
  linhas.push(["", "TOTAL DE HORAS", "", null, ...Array(12).fill(null)]);
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const ultimaColuna = XLSX.utils.encode_col(cabecalho.length - 1);
  adicionarTitulo(XLSX, aba, "HISTOGRAMA DE MÃO DE OBRA", `${orcamento.id} · ${orcamento.nome} · revisão ${orcamento.revisao}`, ultimaColuna);
  aplicarEstiloCabecalho(aba, `A3:${ultimaColuna}3`);
  recursos.forEach((recurso, indice) => {
    const linha = indice + 4;
    for (let coluna = 4; coluna < 16; coluna += 1) {
      const letra = XLSX.utils.encode_col(coluna);
      const linhaCronograma = recurso.item ? linhasCronograma.get(recurso.item.id) : null;
      aba[`${letra}${linha}`] = {
        t: "n",
        f: linhaCronograma ? `TRUNC($D${linha}*'Cronograma'!${XLSX.utils.encode_col(coluna - 1)}${linhaCronograma},2)` : "0",
      };
      estilizarCelula(aba[`${letra}${linha}`], { formato: "#,##0.00" });
    }
  });
  aba[`D${totalLinha}`] = { t: "n", f: `SUM(D4:D${totalLinha - 1})` };
  for (let coluna = 4; coluna < 16; coluna += 1) {
    const letra = XLSX.utils.encode_col(coluna);
    aba[`${letra}${totalLinha}`] = { t: "n", f: `SUM(${letra}4:${letra}${totalLinha - 1})` };
  }
  enderecosIntervalo(XLSX, `A${totalLinha}:${ultimaColuna}${totalLinha}`).forEach((endereco) => {
    estilizarCelula(aba[endereco], { preenchimento: COR.claro, negrito: true, formato: "#,##0.00" });
  });
  prepararAba(aba, [11, 38, 17, 16, ...Array(12).fill(12)], `A3:${ultimaColuna}${totalLinha}`);
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
    ["Histograma", criarHistograma(XLSX, orcamento, cronograma.linhasServico)],
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
  completa.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4) return;
    const grupo = String(linha.getCell(3).value || "").startsWith("EAP");
    const total = String(linha.getCell(2).value || "").startsWith("TOTAL");
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
  proposta.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4 || !linha.getCell(1).value) return;
    [5, 7].forEach((coluna) => {
      const celula = linha.getCell(coluna);
      celula.style = {
        ...(celula.style || {}),
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: COR.entrada } },
        protection: { locked: false },
      };
    });
    linha.getCell(5).numFmt = formatoMoeda;
    linha.getCell(6).numFmt = formatoMoeda;
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
  cronograma.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4 || !linha.getCell(1).value) return;
    for (let coluna = 4; coluna <= 15; coluna += 1) {
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
  link.click();
  URL.revokeObjectURL(endereco);
}

export function resumirPacoteLicitacao(orcamento) {
  const totais = calcularTotais(orcamento);
  return {
    abas: 6,
    servicos: orcamento.itens.filter((item) => item.tipo !== "grupo").length,
    composicoes: orcamento.composicoes?.length || 0,
    precoTotal: totais.precoTotal,
    bdi: totais.bdi,
  };
}
