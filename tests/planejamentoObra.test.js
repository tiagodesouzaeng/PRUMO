import test from "node:test";
import assert from "node:assert/strict";
import {
  criarPeriodosMedicao,
  normalizarPlanejamentoObra,
} from "../src/domain/orcamento.js";
import { mapearHierarquiaEap } from "../src/domain/eap.js";

test("gera períodos de medição até a data final da obra", () => {
  const periodos = criarPeriodosMedicao({
    inicioObra: "2026-07-01",
    fimObra: "2026-08-29",
    intervaloMedicaoDias: 30,
  });
  assert.deepEqual(periodos.map(({ inicio, fim }) => [inicio, fim]), [
    ["2026-07-01", "2026-07-30"],
    ["2026-07-31", "2026-08-29"],
  ]);
});

test("normaliza datas invertidas e intervalo recomendado", () => {
  const planejamento = normalizarPlanejamentoObra({
    inicioObra: "2026-09-01",
    fimObra: "2026-08-01",
    intervaloMedicaoDias: "",
  });
  assert.equal(planejamento.inicioObra, "2026-09-01");
  assert.equal(planejamento.intervaloMedicaoDias, 30);
  assert.ok(planejamento.fimObra > planejamento.inicioObra);

  const dataInvalida = normalizarPlanejamentoObra({
    inicioObra: "2026-99-99",
    fimObra: "2026-02-31",
    atualizadoEm: "2026-07-28T12:00:00.000Z",
  });
  assert.equal(dataInvalida.inicioObra, "2026-07-28");
  assert.equal(dataInvalida.fimObra, "2027-07-27");
});

test("mapeia os cinco níveis da EAP para um serviço", () => {
  const itens = [
    { id: "s", tipo: "grupo", descricao: "Site", parentId: "", nivelEap: "site" },
    { id: "p", tipo: "grupo", descricao: "Prédio", parentId: "s", nivelEap: "predio" },
    { id: "a", tipo: "grupo", descricao: "Andar", parentId: "p", nivelEap: "andar" },
    { id: "l", tipo: "grupo", descricao: "Sala", parentId: "a", nivelEap: "sala" },
    { id: "d", tipo: "grupo", descricao: "Disciplina", parentId: "l", nivelEap: "disciplina" },
    { id: "i", tipo: "servico", descricao: "Serviço", parentId: "d" },
  ];
  assert.deepEqual(mapearHierarquiaEap(itens).get("i"), {
    site: "1 · Site",
    predio: "1.1 · Prédio",
    andar: "1.1.1 · Andar",
    sala: "1.1.1.1 · Sala",
    disciplina: "1.1.1.1.1 · Disciplina",
  });
});
