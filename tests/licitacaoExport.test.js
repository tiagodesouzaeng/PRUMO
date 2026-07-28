import test from "node:test";
import assert from "node:assert/strict";
import { ORCAMENTOS_INICIAIS, normalizarOrcamento } from "../src/domain/orcamento.js";
import {
  criarPacoteLicitacao,
  gerarArquivoPacoteLicitacao,
} from "../src/services/licitacaoExport.js";

test("gera o pacote de licitação com seis abas, fórmulas e proteção", async () => {
  const orcamento = normalizarOrcamento({
    ...ORCAMENTOS_INICIAIS[0],
    inicioObra: "2026-07-01",
    fimObra: "2026-08-29",
    intervaloMedicaoDias: 30,
    itens: [
      { id: "site", tipo: "grupo", descricao: "Campus", parentId: "", nivelEap: "site" },
      { id: "predio", tipo: "grupo", descricao: "Prédio A", parentId: "site", nivelEap: "predio" },
      { id: "andar", tipo: "grupo", descricao: "Térreo", parentId: "predio", nivelEap: "andar" },
      { id: "sala", tipo: "grupo", descricao: "Sala 01", parentId: "andar", nivelEap: "sala" },
      { id: "disciplina", tipo: "grupo", descricao: "Arquitetura", parentId: "sala", nivelEap: "disciplina" },
      {
        id: "servico",
        tipo: "servico",
        descricao: "Serviço de teste",
        parentId: "disciplina",
        quantidade: 10,
        unidade: "UN",
        unitario: 25.1234,
        fonte: "Própria · CPU-EAP",
        referenciaCodigo: "CPU-EAP",
      },
    ],
    composicoes: [{
      id: "comp-eap",
      codigo: "CPU-EAP",
      descricao: "Serviço de teste",
      unidade: "UN",
      componentes: [{
        descricao: "Pedreiro",
        unidade: "H",
        coeficiente: 2,
        referenciaTipo: "mao_de_obra",
      }],
    }],
  });
  const workbook = await criarPacoteLicitacao(orcamento);

  assert.deepEqual(workbook.SheetNames, [
    "Instruções",
    "Orçamento Completo",
    "Proposta de Preços",
    "BDI e Encargos",
    "Cronograma",
    "Histograma",
  ]);
  assert.match(workbook.Sheets["Orçamento Completo"].L9.f, /TRUNC/);
  assert.equal(workbook.Sheets["Orçamento Completo"].H9.v, "Própria · CPU-EAP");
  assert.match(workbook.Sheets["Proposta de Preços"].K4.f, /TRUNC/);
  assert.deepEqual(
    ["B4", "C4", "D4", "E4", "F4"].map((endereco) => (
      workbook.Sheets["Proposta de Preços"][endereco].v
    )),
    ["1 · Campus", "1.1 · Prédio A", "1.1.1 · Térreo", "1.1.1.1 · Sala 01", "1.1.1.1.1 · Arquitetura"],
  );
  assert.equal(workbook.Sheets.Cronograma.I3.v, "M01 01/07–30/07");
  assert.equal(workbook.Sheets.Cronograma.J3.v, "M02 31/07–29/08");
  assert.equal(workbook.Sheets.Cronograma.F4.v, "1.1.1.1.1 · Arquitetura");
  assert.equal(workbook.Sheets.Histograma.F4.v, "1.1.1.1.1 · Arquitetura");
  assert.equal(
    workbook.Sheets["Proposta de Preços"].J4.s.protection.locked,
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
  assert.equal(propostaFinal.getCell("J4").protection.locked, false);
  assert.notEqual(propostaFinal.getCell("K4").protection?.locked, false);
  assert.equal(propostaFinal.getCell("J4").fill.fgColor.argb, "FFF2CC");
});

test("gera o XLSX mesmo quando o histograma não possui recurso com EAP", async () => {
  const orcamento = normalizarOrcamento({
    ...ORCAMENTOS_INICIAIS[0],
    itens: [{
      id: "servico-sem-memoria",
      tipo: "servico",
      codigo: "1.1",
      descricao: "Serviço sem composição analítica",
      quantidade: 1,
      unidade: "UN",
      unitario: 100,
      referenciaTipo: "composicao",
      referenciaCodigo: "SEM-MEMORIA",
    }],
    composicoes: [],
  });

  const arquivo = await gerarArquivoPacoteLicitacao(orcamento);
  assert.ok(arquivo.byteLength > 10_000);
});
