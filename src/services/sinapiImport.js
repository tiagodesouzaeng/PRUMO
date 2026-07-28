import { numeroSeguro } from "../domain/orcamento.js";
import { resolverPrecoPorUf, UFS_BRASIL } from "../domain/basesPrecos.js";

const REGIMES_SINAPI = {
  "SEM-DESONERACAO": { insumos: "ISD", composicoes: "CSD", maoObra: "SEM Desoneração" },
  NAO_DESONERADO: { insumos: "ISD", composicoes: "CSD", maoObra: "SEM Desoneração" },
  DESONERADO: { insumos: "ICD", composicoes: "CCD", maoObra: "COM Desoneração" },
  "SEM-ENCARGOS": { insumos: "ISE", composicoes: "CSE", maoObra: "" },
};

export const UFS_SINAPI = UFS_BRASIL;

function normalizarChave(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizarUnidade(valor) {
  const unidade = String(valor ?? "").trim().toUpperCase();
  return { M2: "M²", M3: "M³", MES: "MÊS" }[unidade] || unidade;
}

function valorCodigo(celula, fallback = "") {
  const formula = celula?.f || "";
  const rotuloHyperlink = formula.match(/,\s*"?([A-Z0-9.-]+)"?\s*\)$/i)?.[1];
  const valor = rotuloHyperlink || celula?.v || fallback;
  return String(valor ?? "").trim();
}

function linhasDaAba(XLSX, aba) {
  return XLSX.utils.sheet_to_json(aba, { header: 1, defval: "", raw: true });
}

function encontrarCabecalho(linhas, termosObrigatorios, limite = 35) {
  return linhas.slice(0, limite).findIndex((linha) => {
    const chaves = linha.map(normalizarChave);
    return termosObrigatorios.every((termo) => chaves.some((chave) => chave.includes(termo)));
  });
}

function indiceCabecalho(linha, aliases) {
  const normalizados = aliases.map(normalizarChave);
  return linha.findIndex((valor) => {
    const chave = normalizarChave(valor);
    return normalizados.some((alias) => chave === alias || chave.includes(alias));
  });
}

function criarReferencia({
  codigo,
  descricao,
  tipo,
  unidade = "",
  preco = 0,
  origem = "",
  ...adicionais
}) {
  const valor = numeroSeguro(preco);
  return {
    codigo: String(codigo).trim(),
    descricao: String(descricao).trim(),
    tipo,
    unidade: normalizarUnidade(unidade),
    preco: valor,
    semPreco: ["insumo", "composicao"].includes(tipo) ? valor <= 0 : false,
    origem: String(origem ?? "").trim(),
    ...adicionais,
  };
}

function extrairValoresPorUf(colunasUf, linhaValores, validarColuna = () => true) {
  return UFS_SINAPI.reduce((precos, uf) => {
    const indice = colunasUf.findIndex(
      (valor, posicao) => normalizarChave(valor) === normalizarChave(uf) && validarColuna(posicao),
    );
    precos[uf] = indice >= 0 ? numeroSeguro(linhaValores[indice]) : 0;
    return precos;
  }, {});
}

function extrairPrecosInsumosSinapi(XLSX, workbook, metadados) {
  const regime = REGIMES_SINAPI[metadados.regime] || REGIMES_SINAPI["SEM-DESONERACAO"];
  const aba = workbook.Sheets[regime.insumos];
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["codigo", "insumo", "descricao"]);
  if (cabecalho < 0) return [];
  const colunas = linhas[cabecalho];
  const codigoCol = indiceCabecalho(colunas, ["Código do Insumo"]);
  const descricaoCol = indiceCabecalho(colunas, ["Descrição do Insumo"]);
  const unidadeCol = indiceCabecalho(colunas, ["Unidade"]);
  const origemCol = indiceCabecalho(colunas, ["Origem de Preço"]);
  const possuiUf = UFS_SINAPI.some((uf) => colunas.some(
    (valor) => normalizarChave(valor) === normalizarChave(uf),
  ));
  if ([codigoCol, descricaoCol].some((indice) => indice < 0) || !possuiUf) return [];

  return linhas.slice(cabecalho + 1).flatMap((linha, indice) => {
    const codigo = valorCodigo(
      aba[XLSX.utils.encode_cell({ r: cabecalho + 1 + indice, c: codigoCol })],
      linha[codigoCol],
    );
    const descricao = linha[descricaoCol];
    if (!codigo || !descricao) return [];
    const precosPorUf = extrairValoresPorUf(colunas, linha);
    const precoSelecionado = resolverPrecoPorUf(precosPorUf, metadados.uf);
    return [criarReferencia({
      codigo,
      descricao,
      tipo: "insumo",
      unidade: linha[unidadeCol],
      preco: precoSelecionado.preco,
      origem: linha[origemCol],
      classificacao: linha[0] || "",
      precosPorUf,
      ...precoSelecionado,
    })];
  });
}

function extrairCustosComposicoesSinapi(XLSX, workbook, metadados) {
  const regime = REGIMES_SINAPI[metadados.regime] || REGIMES_SINAPI["SEM-DESONERACAO"];
  const aba = workbook.Sheets[regime.composicoes];
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["codigo", "composicao", "descricao"]);
  if (cabecalho < 0) return [];
  const colunas = linhas[cabecalho];
  const codigoCol = indiceCabecalho(colunas, ["Código da Composição"]);
  const descricaoCol = indiceCabecalho(colunas, ["Descrição"]);
  const unidadeCol = indiceCabecalho(colunas, ["Unidade"]);
  const linhaUfs = linhas[cabecalho - 1] || [];
  const possuiUf = UFS_SINAPI.some((uf) => linhaUfs.some(
    (valor, indice) => normalizarChave(valor) === normalizarChave(uf)
      && normalizarChave(colunas[indice]).includes("custo"),
  ));
  if ([codigoCol, descricaoCol].some((indice) => indice < 0) || !possuiUf) return [];

  return linhas.slice(cabecalho + 1).flatMap((linha, indice) => {
    const codigo = valorCodigo(
      aba[XLSX.utils.encode_cell({ r: cabecalho + 1 + indice, c: codigoCol })],
      linha[codigoCol],
    );
    const descricao = linha[descricaoCol];
    if (!codigo || !descricao || codigo === "0") return [];
    const precosPorUf = extrairValoresPorUf(
      linhaUfs,
      linha,
      (indice) => normalizarChave(colunas[indice]).includes("custo"),
    );
    const precoSelecionado = resolverPrecoPorUf(precosPorUf, metadados.uf);
    return [criarReferencia({
      codigo,
      descricao,
      tipo: "composicao",
      unidade: linha[unidadeCol],
      preco: precoSelecionado.preco,
      origem: precoSelecionado.ufPrecoEfetivo,
      grupo: linha[0] || "",
      precosPorUf,
      ...precoSelecionado,
    })];
  });
}

function extrairAnaliticoSinapi(XLSX, workbook) {
  const aba = workbook.Sheets["Analítico"];
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["codigo", "composicao", "tipoitem"]);
  if (cabecalho < 0) return [];
  const colunas = linhas[cabecalho];
  const composicaoCol = indiceCabecalho(colunas, ["Código da Composição"]);
  const tipoCol = indiceCabecalho(colunas, ["Tipo Item"]);
  const itemCol = indiceCabecalho(colunas, ["Código do Item"]);
  const descricaoCol = indiceCabecalho(colunas, ["Descrição"]);
  const unidadeCol = indiceCabecalho(colunas, ["Unidade"]);
  const coeficienteCol = indiceCabecalho(colunas, ["Coeficiente"]);
  const situacaoCol = indiceCabecalho(colunas, ["Situação"]);

  return linhas.slice(cabecalho + 1).flatMap((linha) => {
    const composicaoCodigo = String(linha[composicaoCol] || "").trim();
    const itemCodigo = String(linha[itemCol] || "").trim();
    const itemTipo = normalizarChave(linha[tipoCol]);
    if (!composicaoCodigo || !itemCodigo || !itemTipo) return [];
    return [criarReferencia({
      codigo: `${composicaoCodigo}:${itemTipo}:${itemCodigo}`,
      descricao: linha[descricaoCol],
      tipo: "composicao_item",
      unidade: linha[unidadeCol],
      composicaoCodigo,
      itemCodigo,
      itemTipo: itemTipo.includes("insumo") ? "insumo" : "composicao",
      coeficiente: numeroSeguro(linha[coeficienteCol]),
      situacao: String(linha[situacaoCol] || "").trim(),
    })];
  });
}

function extrairFamiliasSinapi(XLSX, workbook, metadados) {
  const aba = workbook.Sheets.Coeficientes;
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["codigo", "familia", "insumo"]);
  if (cabecalho < 0) return [];
  const colunas = linhas[cabecalho];
  const familiaCol = indiceCabecalho(colunas, ["Código da Família"]);
  const insumoCol = indiceCabecalho(colunas, ["Código do Insumo"]);
  const descricaoCol = indiceCabecalho(colunas, ["Descrição do Insumo"]);
  const unidadeCol = indiceCabecalho(colunas, ["Unidade"]);
  const categoriaCol = indiceCabecalho(colunas, ["Categoria"]);
  const ufCol = colunas.findIndex((valor) => normalizarChave(valor) === normalizarChave(metadados.uf));

  return linhas.slice(cabecalho + 1).flatMap((linha) => {
    const familia = String(linha[familiaCol] || "").trim();
    const insumo = String(linha[insumoCol] || "").trim();
    if (!familia || !insumo) return [];
    return [criarReferencia({
      codigo: `${familia}:${insumo}`,
      descricao: linha[descricaoCol],
      tipo: "familia_coeficiente",
      unidade: linha[unidadeCol],
      familiaCodigo: familia,
      insumoCodigo: insumo,
      categoria: String(linha[categoriaCol] || "").trim(),
      coeficiente: ufCol >= 0 ? numeroSeguro(linha[ufCol]) : 0,
    })];
  });
}

function extrairManutencoesSinapi(XLSX, workbook) {
  const aba = workbook.Sheets["Manutenções"];
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["referencia", "tipo", "codigo", "manutencao"]);
  if (cabecalho < 0) return [];

  return linhas.slice(cabecalho + 1).flatMap((linha, indice) => {
    const codigo = String(linha[2] || "").trim();
    const tipoOriginal = String(linha[1] || "").trim();
    if (!codigo || !tipoOriginal) return [];
    return [criarReferencia({
      codigo: `${tipoOriginal}:${codigo}:${indice}`,
      descricao: linha[3],
      tipo: "manutencao",
      referenciaCodigo: codigo,
      referenciaTipo: normalizarChave(tipoOriginal),
      manutencao: String(linha[4] || "").trim(),
    })];
  });
}

function extrairMaoObraSinapi(XLSX, workbook, metadados) {
  const regime = REGIMES_SINAPI[metadados.regime] || REGIMES_SINAPI["SEM-DESONERACAO"];
  if (!regime.maoObra) return [];
  const aba = workbook.Sheets[regime.maoObra];
  if (!aba) return [];
  const linhas = linhasDaAba(XLSX, aba);
  const cabecalho = encontrarCabecalho(linhas, ["codigo", "composicao", "descricao"]);
  if (cabecalho < 0) return [];
  const colunas = linhas[cabecalho];
  const codigoCol = indiceCabecalho(colunas, ["Código da Composição"]);
  const descricaoCol = indiceCabecalho(colunas, ["Descrição"]);
  const unidadeCol = indiceCabecalho(colunas, ["Unidade"]);
  const ufCol = colunas.findIndex((valor) => normalizarChave(valor) === normalizarChave(metadados.uf));

  return linhas.slice(cabecalho + 1).flatMap((linha) => {
    const codigo = String(linha[codigoCol] || "").trim();
    if (!codigo) return [];
    return [criarReferencia({
      codigo,
      descricao: linha[descricaoCol],
      tipo: "mao_obra",
      unidade: linha[unidadeCol],
      percentualMaoObra: ufCol >= 0 ? numeroSeguro(linha[ufCol]) : 0,
      grupo: linha[0] || "",
    })];
  });
}

function extrairGenerico(XLSX, workbook) {
  const referencias = [];
  workbook.SheetNames.forEach((nomeAba) => {
    const aba = workbook.Sheets[nomeAba];
    const linhas = linhasDaAba(XLSX, aba);
    const cabecalho = encontrarCabecalho(linhas, ["codigo", "descricao"]);
    if (cabecalho < 0) return;
    const colunas = linhas[cabecalho];
    const codigoCol = indiceCabecalho(colunas, ["Código", "Código da Composição", "Código do Insumo"]);
    const descricaoCol = indiceCabecalho(colunas, ["Descrição", "Descrição da Composição", "Descrição do Insumo"]);
    const unidadeCol = indiceCabecalho(colunas, ["Unidade", "Un", "Und"]);
    const precoCol = indiceCabecalho(colunas, ["Preço", "Custo", "Custo Total", "Preço Mediano", "Valor"]);
    const tipoCol = indiceCabecalho(colunas, ["Tipo", "Classe"]);
    const origemCol = indiceCabecalho(colunas, ["Origem", "Origem de Preço"]);
    if (codigoCol < 0 || descricaoCol < 0) return;

    linhas.slice(cabecalho + 1).forEach((linha, indice) => {
      const codigo = valorCodigo(
        aba[XLSX.utils.encode_cell({ r: cabecalho + 1 + indice, c: codigoCol })],
        linha[codigoCol],
      );
      const descricao = linha[descricaoCol];
      if (!codigo || !descricao || codigo === "0") return;
      const tipoInformado = normalizarChave(linha[tipoCol]);
      const tipo = tipoInformado.includes("insumo") || normalizarChave(nomeAba).includes("insumo")
        ? "insumo"
        : "composicao";
      referencias.push(criarReferencia({
        codigo,
        descricao,
        tipo,
        unidade: linha[unidadeCol],
        preco: precoCol >= 0 ? linha[precoCol] : 0,
        origem: origemCol >= 0 ? linha[origemCol] : nomeAba,
      }));
    });
  });
  return referencias;
}

async function calcularHash(buffer) {
  const resumo = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function importarArquivoBasePrecos(arquivo, metadados) {
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const fonte = String(metadados.fonte || "SINAPI").trim().toUpperCase();
  const arquivos = [];
  let planilhas = [{ nome: arquivo.name, buffer }];

  if (arquivo.name.toLowerCase().endsWith(".zip")) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const entradas = Object.values(zip.files).filter(
      (entrada) => !entrada.dir && /\.(xlsx|xls)$/i.test(entrada.name),
    );
    if (!entradas.length) throw new Error("O ZIP não contém planilhas XLSX ou XLS.");
    planilhas = await Promise.all(entradas.map(async (entrada) => ({
      nome: entrada.name,
      buffer: await entrada.async("arraybuffer"),
    })));
  }

  const workbooks = planilhas.map(({ nome, buffer: planilha }) => {
    arquivos.push(nome);
    return {
      nome,
      workbook: XLSX.read(planilha, {
        type: "array",
        cellDates: false,
        cellFormula: true,
        cellHTML: false,
      }),
    };
  });
  const principalSinapi = workbooks.find(({ workbook }) => (
    workbook.SheetNames.includes("ISD") && workbook.SheetNames.includes("CSD")
  ));
  const referencias = [];

  if (fonte === "SINAPI" && principalSinapi) {
    referencias.push(
      ...extrairPrecosInsumosSinapi(XLSX, principalSinapi.workbook, metadados),
      ...extrairCustosComposicoesSinapi(XLSX, principalSinapi.workbook, metadados),
      ...extrairAnaliticoSinapi(XLSX, principalSinapi.workbook),
    );
    workbooks.forEach(({ workbook }) => {
      referencias.push(
        ...extrairFamiliasSinapi(XLSX, workbook, metadados),
        ...extrairManutencoesSinapi(XLSX, workbook),
        ...extrairMaoObraSinapi(XLSX, workbook, metadados),
      );
    });
  } else {
    workbooks.forEach(({ workbook }) => referencias.push(...extrairGenerico(XLSX, workbook)));
  }

  const unicas = [...new Map(
    referencias.map((item) => [`${item.tipo}:${item.codigo}`, item]),
  ).values()];
  const catalogo = unicas.filter((item) => ["insumo", "composicao"].includes(item.tipo));
  if (!catalogo.length) {
    throw new Error(
      fonte === "SINAPI"
        ? "A publicação foi lida, mas não contém preços SINAPI reconhecíveis para a UF e o regime selecionados."
        : "Nenhuma referência de preço reconhecida. Verifique os cabeçalhos de código, descrição, unidade e preço.",
    );
  }

  const semPreco = catalogo.filter((item) => item.semPreco).length;
  const fonteId = normalizarChave(fonte).toUpperCase() || "BASE";
  const nacional = fonte === "SINAPI";
  const baseId = `${fonteId}-${nacional ? "NACIONAL" : (metadados.uf || "GERAL")}-${metadados.referencia}-${metadados.regime || "PADRAO"}`
    .replace(/[^A-Z0-9-]/gi, "-")
    .toUpperCase();
  const base = {
    id: baseId,
    fonte,
    titulo: `${fonte} ${nacional ? "Nacional" : (metadados.uf || "")} · ${metadados.referencia}`.replace(/\s+/g, " ").trim(),
    uf: nacional ? "NACIONAL" : (metadados.uf || ""),
    ufInicial: metadados.uf || "RS",
    ufsDisponiveis: nacional ? UFS_SINAPI : [metadados.uf || "GERAL"],
    referencia: metadados.referencia,
    regime: metadados.regime || "PADRAO",
    arquivo: arquivo.name,
    arquivos,
    hash: await calcularHash(buffer),
    importadaEm: new Date().toISOString(),
    total: catalogo.length,
    registros: unicas.length,
    insumos: catalogo.filter((item) => item.tipo === "insumo").length,
    composicoes: catalogo.filter((item) => item.tipo === "composicao").length,
    itensComposicao: unicas.filter((item) => item.tipo === "composicao_item").length,
    familias: unicas.filter((item) => item.tipo === "familia_coeficiente").length,
    manutencoes: unicas.filter((item) => item.tipo === "manutencao").length,
    maoObra: unicas.filter((item) => item.tipo === "mao_obra").length,
    semPreco,
    statusPreco: semPreco === catalogo.length
      ? "Preços indisponíveis"
      : semPreco
        ? "Preços parciais"
        : "Preços válidos",
  };

  return { base, referencias: unicas };
}

export const importarArquivoSinapi = importarArquivoBasePrecos;
