import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarPrecoPorUf,
  mesclarReferenciasSinapi,
  resolverPrecoPorUf,
} from "../src/domain/basesPrecos.js";

test("usa o preço do estado selecionado quando disponível", () => {
  assert.deepEqual(resolverPrecoPorUf({ RS: 12.3456, SP: 10 }, "RS"), {
    preco: 12.3456,
    semPreco: false,
    ufPrecoEfetivo: "RS",
    precoSubstituidoSp: false,
  });
});

test("usa SP e sinaliza a substituição quando o estado não possui preço", () => {
  const resultado = aplicarPrecoPorUf({
    codigo: "123",
    precosPorUf: { RS: 0, SP: 9.8765 },
  }, "RS");
  assert.equal(resultado.preco, 9.8765);
  assert.equal(resultado.ufPrecoEfetivo, "SP");
  assert.equal(resultado.precoSubstituidoSp, true);
});

test("consolida publicações estaduais antigas em uma referência nacional", () => {
  const [referencia] = mesclarReferenciasSinapi([
    {
      base: { uf: "RS" },
      referencias: [{ tipo: "insumo", codigo: "1", descricao: "Cimento", preco: 31 }],
    },
    {
      base: { uf: "SP" },
      referencias: [{ tipo: "insumo", codigo: "1", descricao: "Cimento", preco: 29 }],
    },
  ]);
  assert.equal(referencia.precosPorUf.RS, 31);
  assert.equal(referencia.precosPorUf.SP, 29);
});
