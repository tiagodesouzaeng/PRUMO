import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), "utf8");

test("design system unificado usa Orçamentos como referência visual", async () => {
  const [tokens, appCss, unificado] = await Promise.all([
    ler("src/styles/sigiuTokens.css"),
    ler("src/App.css"),
    ler("src/styles/prumoUnified.css"),
  ]);

  assert.match(tokens, /--sigiu-azul:\s*#123247/);
  assert.match(tokens, /--sigiu-verde-institucional:\s*#087f73/);
  assert.match(tokens, /--sigiu-font-family-display:\s*Georgia/);
  assert.match(tokens, /--sigiu-font-size-2xl:\s*27px/);
  assert.ok(appCss.indexOf("orcamento.css") < appCss.indexOf("prumoUnified.css"));
  assert.match(unificado, /\.sigiu-page-heading h1/);
  assert.match(unificado, /\.sigiu-admin-tabs/);
  assert.match(unificado, /\.sigiu-content table/);
  assert.match(unificado, /\.sigiu-content input:focus/);
});

test("Planejamento e Suprimentos usam o cabeçalho canônico", async () => {
  const [planejamento, suprimentos, contratos] = await Promise.all([
    ler("src/pages/Planejamento.jsx"),
    ler("src/pages/Suprimentos.jsx"),
    ler("src/pages/Contratos.jsx"),
  ]);

  for (const pagina of [planejamento, suprimentos, contratos]) {
    assert.match(pagina, /sigiu-page-heading sigiu-page-heading--modulo/);
    assert.match(pagina, /sigiu-page-eyebrow/);
  }
});
