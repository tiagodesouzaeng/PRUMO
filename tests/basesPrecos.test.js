import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarPrecoPorUf,
  gerarRelatorioPrecosPorUf,
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

test("transforma os preços estaduais em relatório com situação e referência de SP", () => {
  const relatorio = gerarRelatorioPrecosPorUf({ RS: 100, SP: 120 }, ["RS", "SC", "SP"]);
  assert.equal(relatorio.publicados, 2);
  assert.equal(relatorio.referenciasSp, 1);
  assert.equal(relatorio.semPreco, 0);
  assert.deepEqual(relatorio.linhas.map((linha) => [linha.uf, linha.situacao, linha.precoUtilizado]), [
    ["RS", "publicado", 100],
    ["SC", "referencia_sp", 120],
    ["SP", "publicado", 120],
  ]);
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

test("decompõe o custo SINAPI da composição entre mão de obra e material por estado", () => {
  const resultado = aplicarPrecoPorUf({
    codigo: "94964",
    tipo: "composicao",
    precosPorUf: { RS: 100, SP: 120 },
    percentuaisMaoObraPorUf: { RS: 0.3, SP: 0.25 },
  }, "RS");
  assert.equal(resultado.percentualMaoObra, 0.3);
  assert.equal(resultado.custoMaoObra, 30);
  assert.equal(resultado.custoMaterial, 70);
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
