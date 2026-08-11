import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  construirSelecaoPatrimonial,
  idsNoEscopoPatrimonial,
} from "../src/services/contextoPatrimonial.js";
import { EMPRESAS_HOMOLOGACAO } from "../server/operations/seedHomologacao.js";

const arvore = [
  { id: "c1", nivel: "cliente", parentId: "" },
  { id: "s1", nivel: "site", parentId: "c1" },
  { id: "p1", nivel: "predio", parentId: "s1" },
  { id: "sl1", nivel: "sala", parentId: "p1" },
  { id: "s2", nivel: "site", parentId: "c1" },
];

test("contexto global reconstrói Cliente, Site, Prédio e Sala", () => {
  assert.deepEqual(construirSelecaoPatrimonial(arvore[3], arvore), {
    cliente: "c1", site: "s1", predio: "p1", sala: "sl1",
  });
});

test("escopo patrimonial inclui descendentes e exclui ramos irmãos", () => {
  assert.deepEqual([...idsNoEscopoPatrimonial(arvore, "s1")].sort(), ["p1", "s1", "sl1"]);
});

test("massa de homologação possui três organizações isoladas e perfis distintos", () => {
  assert.equal(EMPRESAS_HOMOLOGACAO.length, 3);
  assert.equal(new Set(EMPRESAS_HOMOLOGACAO.map((item) => item.tenantId)).size, 3);
  assert.equal(new Set(EMPRESAS_HOMOLOGACAO.map((item) => item.teamId)).size, 3);
  assert.deepEqual(new Set(EMPRESAS_HOMOLOGACAO.map((item) => item.perfil)), new Set(["publico", "federacao", "escritorio"]));
});

test("interface usa contexto global, carregamento sob demanda e exclusão explicativa", async () => {
  const [app, topo, patrimonio, repositorio] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/Navigation/Topbar.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Patrimonio.jsx", import.meta.url), "utf8"),
    readFile(new URL("../server/db/postgresRepository.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /lazy\(\(\) => import/);
  assert.match(topo, /Contexto de trabalho/);
  assert.match(topo, /Site/);
  assert.match(topo, /Prédio/);
  assert.match(topo, /Sala/);
  assert.match(patrimonio, /erroExclusao/);
  assert.match(repositorio, /obterDependenciasUnidadePatrimonial/);
});
