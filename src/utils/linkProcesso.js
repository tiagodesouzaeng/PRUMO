/* =====================================================
   RELEASE........: v2.5.0 RC1
   ARQUIVO........: src/utils/linkProcesso.js
   DESCRIÇÃO......: Normalização do campo Link Processo vindo da planilha
===================================================== */

export function normalizarUrl(url) {
  if (!url) return null;

  const urlLimpa = String(url)
    .trim()
    .replace(/[),.;]+$/g, "");

  if (!urlLimpa) return null;

  if (/^https?:\/\//i.test(urlLimpa)) {
    return urlLimpa;
  }

  return `https://${urlLimpa}`;
}

export function extrairUrlLinkProcesso(valorBruto) {
  if (valorBruto === null || valorBruto === undefined) return null;

  const texto = String(valorBruto).trim();
  if (!texto || texto === "-") return null;

  const formulaMatch = texto.match(
    /=\s*(?:HYPERLINK|HIPERLINK)\s*\(\s*["']([^"']+)["']/i
  );

  if (formulaMatch?.[1]) {
    return normalizarUrl(formulaMatch[1]);
  }

  const urlCompletaMatch = texto.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlCompletaMatch?.[0]) {
    return normalizarUrl(urlCompletaMatch[0]);
  }

  const wwwMatch = texto.match(/www\.[^\s"'<>]+/i);
  if (wwwMatch?.[0]) {
    return normalizarUrl(wwwMatch[0]);
  }

  const dominioMatch = texto.match(
    /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?/i
  );

  if (dominioMatch?.[0]) {
    return normalizarUrl(dominioMatch[0]);
  }

  return null;
}
