import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  arquivarBasePrecos,
  carregarReferenciasBase,
  excluirBasePrecosDefinitivamente,
  listarBasesPrecos,
  restaurarBasePrecos,
  salvarBasePrecos,
} from "../src/services/basePrecosRepository.js";

const BASE_ID = "base-teste-governanca-v948";

test("arquiva, restaura e exclui definitivamente uma base unitária", async () => {
  await excluirBasePrecosDefinitivamente(BASE_ID);
  await salvarBasePrecos(
    {
      id: BASE_ID,
      nome: "Base de teste",
      referencia: "07/2026",
      tipo: "SBC",
    },
    [
      {
        tipo: "insumo",
        codigo: "MAT-001",
        descricao: "Material de teste",
        unidade: "UN",
        preco: 12.3456,
      },
    ],
  );

  assert.ok((await listarBasesPrecos()).some((base) => base.id === BASE_ID));
  assert.equal((await carregarReferenciasBase(BASE_ID)).length, 1);

  await arquivarBasePrecos(BASE_ID, "Teste automatizado");
  assert.ok(!(await listarBasesPrecos()).some((base) => base.id === BASE_ID));
  assert.equal(
    (await listarBasesPrecos({ incluirExcluidas: true }))
      .find((base) => base.id === BASE_ID)?.status,
    "excluida",
  );

  await restaurarBasePrecos(BASE_ID, "Teste automatizado");
  assert.ok((await listarBasesPrecos()).some((base) => base.id === BASE_ID));

  await excluirBasePrecosDefinitivamente(BASE_ID);
  assert.ok(
    !(await listarBasesPrecos({ incluirExcluidas: true }))
      .some((base) => base.id === BASE_ID),
  );
  assert.deepEqual(await carregarReferenciasBase(BASE_ID), []);
});
