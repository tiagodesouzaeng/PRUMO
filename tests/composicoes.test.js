import test from "node:test";
import assert from "node:assert/strict";
import {
  avaliarComponenteComposicao,
  resumirQualidadeComposicao,
} from "../src/domain/composicoes.js";

const trilha = [
  { basePrecoId: "SINAPI", codigo: "100" },
  { basePrecoId: "SINAPI", codigo: "200" },
];

test("detecta retorno para uma composição ancestral", () => {
  const resultado = avaliarComponenteComposicao({
    basePrecoId: "SINAPI",
    referenciaTipo: "composicao",
    referenciaCodigo: "100",
    coeficiente: 1,
    preco: 10,
  }, trilha);
  assert.equal(resultado.ciclo, true);
  assert.match(resultado.pendencias.join(" "), /Ciclo/);
});

test("sinaliza código, coeficiente e preço ausentes", () => {
  const resultado = avaliarComponenteComposicao({
    referenciaTipo: "insumo",
    coeficiente: 0,
    preco: 0,
  }, trilha);
  assert.equal(resultado.valido, false);
  assert.equal(resultado.pendencias.length, 3);
});

test("aprova composição completa sem ciclos", () => {
  const resumo = resumirQualidadeComposicao([{
    basePrecoId: "SINAPI",
    referenciaTipo: "insumo",
    referenciaCodigo: "300",
    coeficiente: 2.5,
    preco: 4.75,
  }], trilha);
  assert.equal(resumo.completa, true);
  assert.equal(resumo.pendencias, 0);
});
