import { numeroSeguro } from "../domain/orcamento.js";

function normalizarChave(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function obterCampo(linha, aliases) {
  const aliasesNormalizados = aliases.map(normalizarChave);
  const encontrado = Object.entries(linha).find(([chave]) => (
    aliasesNormalizados.includes(normalizarChave(chave))
  ));
  return encontrado?.[1] ?? "";
}

function normalizarUnidade(valor) {
  const unidade = String(valor).trim().toUpperCase();
  return { M2: "M²", M3: "M³", MES: "MÊS" }[unidade] || unidade;
}

async function calcularHash(buffer) {
  const resumo = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function importarArquivoSinapi(arquivo, metadados) {
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const referencias = [];
  let planilhas = [buffer];

  if (arquivo.name.toLowerCase().endsWith(".zip")) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const entradas = Object.values(zip.files).filter(
      (entrada) => !entrada.dir && /\.(xlsx|xls)$/i.test(entrada.name),
    );
    if (!entradas.length) throw new Error("O ZIP não contém planilhas XLSX ou XLS.");
    planilhas = await Promise.all(entradas.map((entrada) => entrada.async("arraybuffer")));
  }

  planilhas.forEach((planilha) => {
    const workbook = XLSX.read(planilha, { type: "array", cellDates: false });
    workbook.SheetNames.forEach((nomeAba) => {
      const nomeNormalizado = normalizarChave(nomeAba);
      const tipoAba = nomeNormalizado.includes("insumo") ? "insumo" : "composicao";
      const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { defval: "", raw: true });

      linhas.forEach((linha) => {
        const codigo = String(obterCampo(linha, ["Código", "Codigo", "Código da Composição", "Codigo da Composicao", "Código do Insumo", "Codigo do Insumo"])).trim();
        const descricao = String(obterCampo(linha, ["Descrição", "Descricao", "Descrição da Composição", "Descricao da Composicao", "Descrição do Insumo", "Descricao do Insumo"])).trim();
        if (!codigo || !descricao) return;

        const tipoInformado = normalizarChave(obterCampo(linha, ["Tipo", "Classe"]));
        const tipo = tipoInformado.includes("insumo") ? "insumo"
          : tipoInformado.includes("compos") ? "composicao"
            : tipoAba;
        const preco = numeroSeguro(obterCampo(linha, ["Preço", "Preco", "Custo", "Custo Total", "Preço Mediano", "Preco Mediano", "Valor"]));

        referencias.push({
          codigo,
          descricao,
          tipo,
          unidade: normalizarUnidade(obterCampo(linha, ["Unidade", "Un", "Und"])),
          preco,
          semPreco: preco <= 0,
          origem: String(obterCampo(linha, ["Origem", "Origem de Preço", "Origem de Preco"])).trim(),
        });
      });
    });
  });

  const unicas = [...new Map(referencias.map((item) => [`${item.tipo}:${item.codigo}`, item])).values()];
  if (!unicas.length) {
    throw new Error("Nenhuma referência SINAPI reconhecida no arquivo.");
  }

  const baseId = `SINAPI-${metadados.uf}-${metadados.referencia}-${metadados.regime}`
    .replace(/[^A-Z0-9-]/gi, "-")
    .toUpperCase();
  const semPreco = unicas.filter((item) => item.semPreco).length;
  const base = {
    id: baseId,
    titulo: `SINAPI ${metadados.uf} · ${metadados.referencia}`,
    uf: metadados.uf,
    referencia: metadados.referencia,
    regime: metadados.regime,
    arquivo: arquivo.name,
    hash: await calcularHash(buffer),
    importadaEm: new Date().toISOString(),
    total: unicas.length,
    insumos: unicas.filter((item) => item.tipo === "insumo").length,
    composicoes: unicas.filter((item) => item.tipo === "composicao").length,
    semPreco,
    statusPreco: semPreco === unicas.length ? "Preços indisponíveis" : semPreco ? "Preços parciais" : "Preços válidos",
  };

  return { base, referencias: unicas };
}
