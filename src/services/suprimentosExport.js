const COR_NAVY = "0B2F5B";
const COR_TEAL = "00877A";
const COR_HEADER = "E8F3F1";
const COR_INPUT = "FFF4CC";
const COR_BORDER = "D7E3E4";
const SENHA_PROTECAO = "PRUMO";

function numero(valor, padrao = 0) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
}

function dataExcel(valor) {
  if (!valor) return null;
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function nomeSeguro(valor) {
  return String(valor || "orcamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function configurarAba(aba, titulo, subtitulo, colunas) {
  aba.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];
  aba.properties.defaultRowHeight = 18;
  aba.mergeCells(1, 1, 1, colunas.length);
  aba.mergeCells(2, 1, 2, colunas.length);
  aba.getCell("A1").value = titulo;
  aba.getCell("A2").value = subtitulo;
  aba.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 15 };
  aba.getCell("A2").font = { color: { argb: "FFD8E7EE" }, size: 9 };
  aba.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_NAVY}` } };
  aba.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_NAVY}` } };
  aba.getRow(1).height = 25;
  aba.getRow(2).height = 20;
  aba.addRow([]);
  const cabecalho = aba.addRow(colunas.map((coluna) => coluna.header));
  cabecalho.height = 24;
  cabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: `FF${COR_NAVY}` }, size: 9 };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_HEADER}` } };
    celula.alignment = { vertical: "middle", wrapText: true };
    celula.border = { bottom: { style: "thin", color: { argb: `FF${COR_TEAL}` } } };
  });
  colunas.forEach((coluna, indice) => {
    aba.getColumn(indice + 1).width = coluna.width;
    if (coluna.numFmt) aba.getColumn(indice + 1).numFmt = coluna.numFmt;
  });
  aba.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: colunas.length },
  };
}

function estilizarLinhas(aba, inicio = 5) {
  for (let linha = inicio; linha <= aba.rowCount; linha += 1) {
    const atual = aba.getRow(linha);
    atual.alignment = { vertical: "top", wrapText: true };
    atual.eachCell({ includeEmpty: true }, (celula) => {
      celula.font = { color: { argb: "FF415B66" }, size: 9 };
      celula.border = { bottom: { style: "hair", color: { argb: `FF${COR_BORDER}` } } };
    });
  }
}

function liberarEdicao(aba, colunas, inicio = 5) {
  for (let linha = inicio; linha <= aba.rowCount; linha += 1) {
    colunas.forEach((coluna) => {
      const celula = aba.getCell(linha, coluna);
      celula.protection = { locked: false };
      celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_INPUT}` } };
    });
  }
}

async function proteger(aba) {
  await aba.protect(SENHA_PROTECAO, {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    deleteRows: false,
    sort: true,
    autoFilter: true,
  });
}

function subtitulo(orcamento) {
  return `${orcamento.id || "Orçamento"} · ${orcamento.nome || "Sem nome"} · ${orcamento.revisao || "R01"}`;
}

function adicionarResumo(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Resumo");
  aba.views = [{ showGridLines: false }];
  aba.columns = [{ width: 31 }, { width: 24 }, { width: 68 }];
  aba.mergeCells("A1:C1");
  aba.getCell("A1").value = "PLANEJAMENTO DE SUPRIMENTOS";
  aba.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  aba.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${COR_NAVY}` } };
  aba.getCell("A1").alignment = { vertical: "middle" };
  aba.getRow(1).height = 28;
  const linhas = [
    ["Orçamento", orcamento.id || "", orcamento.nome || ""],
    ["Revisão", orcamento.revisao || "", "Arquivo gerado para homologação da Etapa 9"],
    ["Insumos consolidados", resultado.insumos.length, "Materiais e equipamentos, sem mão de obra"],
    ["Funções de mão de obra", resultado.maoObra.length, "Relação separada para planejamento de recursos"],
    ["Serviços processados", resultado.servicosProcessados, "Itens ativos do orçamento"],
    ["Composições expandidas", resultado.composicoesExpandidas, "Inclui composições internas"],
    ["Pendências analíticas", resultado.pendencias.length, "Devem ser verificadas antes da compra"],
    ["Valor básico estimado", numero(resultado.valorEstimado), "Sem BDI; considera conversões e perdas cadastradas"],
    ["Períodos com ruptura", resultado.rupturas.length, "Demanda superior ao estoque e pedidos disponíveis"],
  ];
  linhas.forEach((linha) => aba.addRow(linha));
  ["B4", "B5", "B6", "B7", "B8", "B10"].forEach((endereco) => {
    aba.getCell(endereco).numFmt = "#,##0";
  });
  aba.getCell("B9").numFmt = '"R$" #,##0.00';
  estilizarLinhas(aba, 2);
  for (let linha = 2; linha <= aba.rowCount; linha += 1) {
    aba.getCell(linha, 1).font = { bold: true, color: { argb: `FF${COR_NAVY}` } };
  }
  return aba;
}

function adicionarDemanda(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Demanda");
  configurarAba(aba, "DEMANDA CONSOLIDADA", subtitulo(orcamento), [
    { header: "Base", width: 19 },
    { header: "UF", width: 8 },
    { header: "Referência", width: 13 },
    { header: "Código", width: 15 },
    { header: "Descrição", width: 46 },
    { header: "Unidade", width: 11 },
    { header: "Quantidade original", width: 18, numFmt: "#,##0.00000000" },
    { header: "Fator de conversão", width: 17, numFmt: "0.00000000" },
    { header: "Perda técnica", width: 14, numFmt: "0.00%" },
    { header: "Quantidade planejada", width: 20, numFmt: "#,##0.00000000" },
    { header: "Preço básico", width: 15, numFmt: '"R$" #,##0.00000000' },
    { header: "Valor estimado", width: 16, numFmt: '"R$" #,##0.00' },
    { header: "Origens", width: 48 },
    { header: "Justificativa da equivalência", width: 42 },
  ]);
  resultado.insumos.forEach((item) => {
    aba.addRow([
      item.base,
      item.uf,
      item.referencia,
      item.codigo,
      item.descricao,
      item.unidade,
      numero(item.quantidadeOriginal, item.quantidade),
      numero(item.fatorConversao, 1),
      numero(item.perdaPercentual) / 100,
      numero(item.quantidade),
      numero(item.preco),
      numero(item.valorEstimado),
      item.origens.join(" | "),
      item.justificativaEquivalencia || "",
    ]);
  });
  estilizarLinhas(aba);
  return aba;
}

function adicionarCalendario(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Calendário");
  configurarAba(aba, "CALENDÁRIO DE COMPRAS", subtitulo(orcamento), [
    { header: "Comprar até", width: 14, numFmt: "dd/mm/yyyy" },
    { header: "Consumo previsto", width: 16, numFmt: "dd/mm/yyyy" },
    { header: "Período", width: 16 },
    { header: "Base", width: 18 },
    { header: "Código", width: 15 },
    { header: "Descrição", width: 45 },
    { header: "Unidade", width: 10 },
    { header: "Quantidade", width: 16, numFmt: "#,##0.00000000" },
    { header: "Preço básico", width: 15, numFmt: '"R$" #,##0.00000000' },
    { header: "Valor estimado", width: 16, numFmt: '"R$" #,##0.00' },
    { header: "Antecedência (dias)", width: 18, numFmt: "0" },
    { header: "Origens", width: 45 },
  ]);
  resultado.planoCompras.forEach((item) => {
    aba.addRow([
      dataExcel(item.comprarAte),
      dataExcel(item.consumoEm),
      item.periodo,
      item.base,
      item.codigo,
      item.descricao,
      item.unidade,
      numero(item.quantidade),
      numero(item.preco),
      numero(item.valorEstimado),
      numero(item.antecedenciaDias),
      item.origens.join(" | "),
    ]);
  });
  estilizarLinhas(aba);
  return aba;
}

function adicionarCobertura(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Cobertura");
  configurarAba(aba, "ESTOQUE, PEDIDOS E COBERTURA", subtitulo(orcamento), [
    { header: "Código", width: 15 },
    { header: "Descrição", width: 46 },
    { header: "Unidade", width: 10 },
    { header: "Demanda total", width: 17, numFmt: "#,##0.00000000" },
    { header: "Estoque atual", width: 16, numFmt: "#,##0.00000000" },
    { header: "Pedidos emitidos", width: 18, numFmt: "#,##0.00000000" },
    { header: "Saldo final", width: 15, numFmt: "#,##0.00000000" },
    { header: "Falta projetada", width: 17, numFmt: "#,##0.00000000" },
    { header: "Situação", width: 14 },
  ]);
  resultado.coberturaPorItem.forEach((item) => {
    aba.addRow([
      item.insumo.codigo,
      item.insumo.descricao,
      item.insumo.unidade,
      numero(item.demandaTotal),
      numero(item.estoqueInicial),
      numero(item.quantidadePedidos),
      numero(item.saldoProjetado),
      numero(item.faltaProjetada),
      item.statusCobertura,
    ]);
  });
  estilizarLinhas(aba);
  return aba;
}

function adicionarCotacao(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Cotação");
  configurarAba(aba, "MAPA PARA COTAÇÃO", `${subtitulo(orcamento)} · células amarelas são editáveis`, [
    { header: "Código", width: 15 },
    { header: "Descrição", width: 46 },
    { header: "Unidade", width: 10 },
    { header: "Quantidade a cotar", width: 18, numFmt: "#,##0.00000000" },
    { header: "Data necessária", width: 16, numFmt: "dd/mm/yyyy" },
    { header: "Fornecedor", width: 28 },
    { header: "Marca/modelo", width: 22 },
    { header: "Preço unitário", width: 16, numFmt: '"R$" #,##0.00000000' },
    { header: "Preço total", width: 16, numFmt: '"R$" #,##0.00' },
    { header: "Prazo (dias)", width: 14, numFmt: "0" },
    { header: "Observações", width: 38 },
  ]);
  resultado.coberturaPorItem.forEach((item) => {
    const compras = resultado.planoCompras.filter((linha) => linha.insumoChave === item.insumo.chave);
    const quantidadeCotacao = item.faltaProjetada > 0 ? item.faltaProjetada : item.demandaTotal;
    const linha = aba.addRow([
      item.insumo.codigo,
      item.insumo.descricao,
      item.insumo.unidade,
      numero(quantidadeCotacao),
      dataExcel(compras[0]?.comprarAte),
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    linha.getCell(9).value = { formula: `ROUND(D${linha.number}*H${linha.number},2)` };
  });
  estilizarLinhas(aba);
  liberarEdicao(aba, [6, 7, 8, 10, 11]);
  return aba;
}

function adicionarPedidos(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Pedidos");
  configurarAba(aba, "PEDIDOS E ACOMPANHAMENTO", `${subtitulo(orcamento)} · células amarelas são editáveis`, [
    { header: "Pedido", width: 18 },
    { header: "Fornecedor", width: 27 },
    { header: "Código", width: 15 },
    { header: "Descrição", width: 43 },
    { header: "Unidade", width: 10 },
    { header: "Quantidade", width: 16, numFmt: "#,##0.00000000" },
    { header: "Entrega prevista", width: 17, numFmt: "dd/mm/yyyy" },
    { header: "Situação", width: 16 },
    { header: "Entrega realizada", width: 18, numFmt: "dd/mm/yyyy" },
    { header: "Observações", width: 40 },
  ]);
  const pedidos = resultado.coberturaPorItem.flatMap((item) => (
    item.pedidos.map((pedido) => ({ item, pedido }))
  ));
  if (pedidos.length) {
    pedidos.forEach(({ item, pedido }) => {
      aba.addRow([
        pedido.id,
        pedido.fornecedor || null,
        item.insumo.codigo,
        item.insumo.descricao,
        item.insumo.unidade,
        numero(pedido.quantidade),
        dataExcel(pedido.entregaEm),
        pedido.status || "Emitido",
        dataExcel(pedido.entregaRealizadaEm),
        pedido.observacoes || null,
      ]);
    });
  } else {
    resultado.coberturaPorItem
      .filter((item) => item.faltaProjetada > 0)
      .forEach((item) => {
        aba.addRow([
          null,
          null,
          item.insumo.codigo,
          item.insumo.descricao,
          item.insumo.unidade,
          numero(item.faltaProjetada),
          null,
          "Planejar",
          null,
          null,
        ]);
      });
  }
  estilizarLinhas(aba);
  liberarEdicao(aba, [1, 2, 6, 7, 8, 9, 10]);
  return aba;
}

function adicionarPendencias(workbook, orcamento, resultado) {
  const aba = workbook.addWorksheet("Pendências");
  configurarAba(aba, "PENDÊNCIAS ANALÍTICAS", subtitulo(orcamento), [
    { header: "Tipo", width: 26 },
    { header: "Código", width: 15 },
    { header: "Descrição", width: 45 },
    { header: "Base", width: 22 },
    { header: "Origem", width: 50 },
  ]);
  resultado.pendencias.forEach((item) => {
    aba.addRow([
      item.tipo.replaceAll("_", " "),
      item.codigo || "",
      item.descricao,
      item.base,
      item.origem,
    ]);
  });
  estilizarLinhas(aba);
  return aba;
}

export async function criarRelatorioSuprimentos(orcamento, resultado) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PRUMO";
  workbook.company = "PRUMO";
  workbook.subject = "Planejamento de suprimentos";
  workbook.title = `${orcamento.id || "Orçamento"} · Suprimentos`;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const abas = [
    adicionarResumo(workbook, orcamento, resultado),
    adicionarDemanda(workbook, orcamento, resultado),
    adicionarCalendario(workbook, orcamento, resultado),
    adicionarCobertura(workbook, orcamento, resultado),
    adicionarCotacao(workbook, orcamento, resultado),
    adicionarPedidos(workbook, orcamento, resultado),
    adicionarPendencias(workbook, orcamento, resultado),
  ];
  await Promise.all(abas.map((aba) => proteger(aba)));
  return workbook.xlsx.writeBuffer();
}

export async function baixarRelatorioSuprimentos(orcamento, resultado) {
  const buffer = await criarRelatorioSuprimentos(orcamento, resultado);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeSeguro(orcamento.id)}-${nomeSeguro(orcamento.revisao)}-suprimentos.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
