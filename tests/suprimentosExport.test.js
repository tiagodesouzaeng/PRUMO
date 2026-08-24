import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { criarRelatorioSuprimentos } from "../src/services/suprimentosExport.js";

function resultadoExemplo() {
  const insumo = {
    chave: "base:CIM:KG",
    codigo: "CIM",
    descricao: "Cimento",
    unidade: "KG",
    base: "SINAPI",
    uf: "RS",
    referencia: "06/2026",
    quantidadeOriginal: 100,
    quantidade: 105,
    fatorConversao: 1,
    perdaPercentual: 5,
    preco: 0.8,
    valorEstimado: 84,
    justificativaEquivalencia: "Perda técnica prevista.",
    origens: ["1.1 · Alvenaria"],
  };
  return {
    insumos: [insumo],
    maoObra: [],
    servicosProcessados: 1,
    composicoesExpandidas: 1,
    pendencias: [],
    valorEstimado: 84,
    rupturas: [{ insumoChave: insumo.chave }],
    planoCompras: [{
      insumoChave: insumo.chave,
      comprarAte: "2026-07-20",
      consumoEm: "2026-08-01",
      periodo: "01/08/2026 a 30/08/2026",
      base: "SINAPI",
      uf: "RS",
      codigo: "CIM",
      descricao: "Cimento",
      unidade: "KG",
      quantidade: 105,
      preco: 0.8,
      valorEstimado: 84,
      antecedenciaDias: 12,
      origens: ["1.1 · Alvenaria"],
    }],
    coberturaPorItem: [{
      insumo,
      demandaTotal: 105,
      estoqueInicial: 5,
      pedidos: [],
      quantidadePedidos: 0,
      saldoProjetado: 0,
      faltaProjetada: 100,
      statusCobertura: "Ruptura",
    }],
  };
}

test("gera relatório de suprimentos com abas protegidas e campos de cotação editáveis", async () => {
  const buffer = await criarRelatorioSuprimentos({
    id: "ORC-001",
    nome: "Obra teste",
    revisao: "R01",
  }, resultadoExemplo());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(
    workbook.worksheets.map((aba) => aba.name),
    ["Resumo", "Demanda", "Calendário", "Cobertura", "Cotação", "Pedidos", "Pendências"],
  );
  workbook.worksheets.forEach((aba) => {
    assert.equal(aba.sheetProtection.sheet, true);
  });

  const cotacao = workbook.getWorksheet("Cotação");
  assert.equal(cotacao.getCell("H5").protection.locked, false);
  assert.notEqual(cotacao.getCell("I5").protection?.locked, false);
  assert.equal(cotacao.getCell("I5").value.formula, "ROUND(D5*H5,2)");
  assert.equal(cotacao.getCell("D5").value, 100);
});
