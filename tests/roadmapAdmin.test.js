import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ROADMAP_PRUMO, agruparRoadmapPorFase } from "../src/config/roadmapPrumo.js";

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), "utf8");

test("roadmap administrativo cobre a evolução e a continuidade do produto", () => {
  assert.equal(ROADMAP_PRUMO.length, 21);
  assert.equal(ROADMAP_PRUMO.filter((item) => item.status === "concluida").length, 21);
  assert.deepEqual(
    ROADMAP_PRUMO.filter((item) => item.status === "em_andamento").map((item) => item.id),
    [],
  );
  assert.deepEqual(
    ROADMAP_PRUMO.filter((item) => item.status === "planejada").map((item) => item.id),
    [],
  );
  assert.ok(agruparRoadmapPorFase().length >= 5);
});

test("telas operacionais não exibem números internos de Sprint", async () => {
  const paginas = [
    "Planejamento.jsx",
    "Suprimentos.jsx",
    "Contratos.jsx",
    "Financeiro.jsx",
    "Obras.jsx",
    "Manutencao.jsx",
    "Convenios.jsx",
    "Regularidade.jsx",
    "Relatorios.jsx",
    "Patrimonio.jsx",
    "Documentos.jsx",
    "PlaceholderModulo.jsx",
  ];
  const conteudos = await Promise.all(paginas.map((pagina) => ler(`src/pages/${pagina}`)));
  for (const conteudo of conteudos) assert.doesNotMatch(conteudo, /sprint\s*\d+/i);
});

test("Auditoria apresenta o roadmap e a navegação trata catálogo vazio de forma restritiva", async () => {
  const [administracao, sidebar, bottomNav] = await Promise.all([
    ler("src/pages/Administracao.jsx"),
    ler("src/components/Navigation/Sidebar.jsx"),
    ler("src/components/Navigation/BottomNav.jsx"),
  ]);
  assert.match(administracao, /Roadmap completo do PRUMO/);
  assert.match(administracao, /<RoadmapProduto \/>/);
  assert.match(sidebar, /modulosPermitidos instanceof Set/);
  assert.match(bottomNav, /modulosPermitidos instanceof Set/);
});
