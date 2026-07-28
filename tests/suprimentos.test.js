import test from "node:test";
import assert from "node:assert/strict";
import { consolidarDemandaSuprimentos } from "../src/services/suprimentos.js";

test("explode composições recursivas e consolida insumos equivalentes", async () => {
  const orcamento = {
    itens: [{
      id: "servico",
      tipo: "servico",
      codigo: "1.1",
      descricao: "Alvenaria",
      quantidade: 10,
      referenciaTipo: "composicao",
      referenciaCodigo: "CPU-01",
    }],
    composicoes: [{
      codigo: "CPU-01",
      componentes: [
        { referenciaTipo: "insumo", referenciaCodigo: "CIM", descricao: "Cimento", unidade: "KG", coeficiente: 2, preco: 0.8 },
        { referenciaTipo: "composicao", referenciaCodigo: "CPU-02", coeficiente: 3 },
      ],
    }, {
      codigo: "CPU-02",
      componentes: [
        { referenciaTipo: "insumo", referenciaCodigo: "CIM", descricao: "Cimento", unidade: "KG", coeficiente: 0.5, preco: 0.8 },
      ],
    }],
  };

  const resultado = await consolidarDemandaSuprimentos(orcamento);
  assert.equal(resultado.insumos.length, 1);
  assert.equal(resultado.insumos[0].quantidade, 35);
  assert.equal(resultado.insumos[0].valorEstimado, 28);
  assert.equal(resultado.composicoesExpandidas, 2);
  assert.equal(resultado.pendencias.length, 0);
});

test("sinaliza ciclos e composições sem memória sem interromper a consolidação", async () => {
  const resultado = await consolidarDemandaSuprimentos({
    itens: [
      { tipo: "servico", codigo: "1", descricao: "Cíclico", quantidade: 1, referenciaTipo: "composicao", referenciaCodigo: "A" },
      { tipo: "servico", codigo: "2", descricao: "Ausente", quantidade: 1, referenciaTipo: "composicao", referenciaCodigo: "X" },
    ],
    composicoes: [
      { codigo: "A", componentes: [{ referenciaTipo: "composicao", referenciaCodigo: "A", coeficiente: 1 }] },
    ],
  });

  assert.deepEqual(
    resultado.pendencias.map((item) => item.tipo).sort(),
    ["ciclo", "composicao_sem_memoria"],
  );
});
