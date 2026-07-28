import test from "node:test";
import assert from "node:assert/strict";
import { normalizarOrcamento } from "../src/domain/orcamento.js";

test("normaliza a revisão corrente como ativa e preserva revisões inativas", () => {
  const orcamento = normalizarOrcamento({
    id: "ORC-TESTE",
    revisao: "R02",
    itens: [],
    composicoes: [],
    revisoes: [
      { id: "rev-2", codigo: "R02", base: "SINAPI" },
      { id: "rev-1", codigo: "R01", bases: "Própria", inativa: true },
    ],
  });

  assert.equal(orcamento.revisoes[0].ativa, true);
  assert.equal(orcamento.revisoes[0].bases, "SINAPI");
  assert.equal(orcamento.revisoes[1].ativa, false);
  assert.equal(orcamento.revisoes[1].inativa, true);
});
