import test from "node:test";
import assert from "node:assert/strict";
import { ORCAMENTOS_INICIAIS, normalizarOrcamento } from "../src/domain/orcamento.js";
import {
  criarPacoteLicitacao,
  gerarArquivoPacoteLicitacao,
} from "../src/services/licitacaoExport.js";

test("gera o pacote de licitação com seis abas, fórmulas e proteção", async () => {
  const orcamento = normalizarOrcamento(ORCAMENTOS_INICIAIS[0]);
  const workbook = await criarPacoteLicitacao(orcamento);

  assert.deepEqual(workbook.SheetNames, [
    "Instruções",
    "Orçamento Completo",
    "Proposta de Preços",
    "BDI e Encargos",
    "Cronograma",
    "Histograma",
  ]);
  assert.match(workbook.Sheets["Orçamento Completo"].G5.f, /TRUNC/);
  assert.match(workbook.Sheets["Proposta de Preços"].F4.f, /TRUNC/);
  assert.equal(
    workbook.Sheets["Proposta de Preços"].E4.s.protection.locked,
    false,
  );
  assert.equal(workbook.Sheets["Proposta de Preços"]["!protect"].password, "PRUMO");

  const arquivo = await gerarArquivoPacoteLicitacao(orcamento);
  assert.ok(arquivo.byteLength > 10_000);
  const moduloExcelJs = await import("exceljs");
  const ExcelJS = moduloExcelJs.default || moduloExcelJs;
  const arquivoFinal = new ExcelJS.Workbook();
  await arquivoFinal.xlsx.load(arquivo);
  const propostaFinal = arquivoFinal.getWorksheet("Proposta de Preços");
  assert.equal(propostaFinal.model.sheetProtection.sheet, true);
  assert.equal(propostaFinal.getCell("E4").protection.locked, false);
  assert.notEqual(propostaFinal.getCell("F4").protection?.locked, false);
  assert.equal(propostaFinal.getCell("E4").fill.fgColor.argb, "FFF2CC");
});
