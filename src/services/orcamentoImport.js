import { numeroSeguro } from "../domain/orcamento.js";

function normalizarChave(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function obterCampo(linha, aliases) {
  const entradas = Object.entries(linha);
  const aliasNormalizados = aliases.map(normalizarChave);
  const encontrado = entradas.find(([chave]) => aliasNormalizados.includes(normalizarChave(chave)));
  return encontrado?.[1] ?? "";
}

function normalizarUnidade(valor) {
  const unidade = String(valor).trim().toUpperCase();
  return {
    M2: "M²",
    M3: "M³",
    MES: "MÊS",
  }[unidade] || unidade;
}

export async function importarPlanilhaOrcamentaria(arquivo) {
  const XLSX = await import("xlsx");
  const dados = await arquivo.arrayBuffer();
  const workbook = XLSX.read(dados, { type: "array", cellDates: false });
  const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
  if (!primeiraAba) throw new Error("A planilha não possui abas legíveis.");

  const linhas = XLSX.utils.sheet_to_json(primeiraAba, { defval: "", raw: true });
  const erros = [];
  const itens = linhas.flatMap((linha, indice) => {
    const codigo = String(obterCampo(linha, ["Código", "Codigo", "Item", "EAP"])).trim();
    const descricao = String(obterCampo(linha, ["Descrição", "Descricao", "Serviço", "Servico"])).trim();
    const tipoInformado = normalizarChave(obterCampo(linha, ["Tipo", "Classe"]));
    const tipo = tipoInformado.includes("grupo") ? "grupo" : "servico";

    if (!codigo && !descricao) return [];
    if (!codigo || !descricao) {
      erros.push(`Linha ${indice + 2}: código e descrição são obrigatórios.`);
      return [];
    }

    return [{
      tipo,
      codigo,
      descricao,
      fonte: tipo === "grupo" ? "" : String(obterCampo(linha, ["Fonte", "Base", "Referência", "Referencia"])).trim(),
      quantidade: tipo === "grupo" ? 0 : numeroSeguro(obterCampo(linha, ["Quantidade", "Qtd"])),
      unidade: tipo === "grupo" ? "" : normalizarUnidade(obterCampo(linha, ["Unidade", "Un", "Und"])),
      unitario: tipo === "grupo" ? 0 : numeroSeguro(obterCampo(linha, ["Preço Unitário", "Preco Unitario", "Unitário", "Unitario", "Valor Unitário"])),
    }];
  });

  if (!itens.length && !erros.length) {
    erros.push("Nenhuma linha orçamentária foi encontrada.");
  }

  return { itens, erros, totalLinhas: linhas.length };
}
