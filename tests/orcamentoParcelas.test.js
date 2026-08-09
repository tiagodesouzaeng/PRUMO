import test from "node:test";
import assert from "node:assert/strict";
import { decomporParcelasUnitarias } from "../src/domain/orcamento.js";

test("separa mão de obra e material preservando o preço unitário", () => {
  const parcelas = decomporParcelasUnitarias({
    unitario: 100,
    custoMaoObra: 30,
    custoMaterial: 70,
  });
  assert.deepEqual(parcelas, { maoObra: 30, material: 70 });
});

test("calcula parcelas pelo percentual e normaliza memória divergente", () => {
  assert.deepEqual(
    decomporParcelasUnitarias({ unitario: 200, percentualMaoObra: 0.25 }),
    { maoObra: 50, material: 150 },
  );
  const normalizadas = decomporParcelasUnitarias({
    unitario: 100,
    custoMaoObra: 40,
    custoMaterial: 80,
  });
  assert.equal(Math.round((normalizadas.maoObra + normalizadas.material) * 100) / 100, 100);
});
