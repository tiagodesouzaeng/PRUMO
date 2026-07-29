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
        custoMaoObra: 10,
        custoMaterial: 15.1234,
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
  const completa = workbook.Sheets["Orçamento Completo"];
  assert.equal(completa.B3.v, "REFERÊNCIA DA BASE");
  assert.equal(completa.C3.v, "DESCRIÇÃO");
  assert.equal(completa.B9.v, "Própria · CPU-EAP");
  assert.equal(completa.F9.v, 10);
  assert.equal(completa.G9.v, 15.1234);
  assert.equal(completa.H9.f, "SUM(F9:G9)");
  assert.match(completa.I9.f, /TRUNC/);
  assert.match(completa.L9.f, /'BDI e Encargos'/);
  assert.match(completa.M9.f, /1\+L9/);
  assert.match(completa.N9.f, /E9\*M9/);
  assert.equal(completa.N8.f, "SUM(N9)");
  assert.equal(completa.N4.f, "SUM(N5)");

  const proposta = workbook.Sheets["Proposta de Preços"];
  assert.equal(proposta.B3.v, "REFERÊNCIA DA BASE");
  assert.equal(proposta.C3.v, "DESCRIÇÃO");
  assert.equal(proposta.F9.v, "");
  assert.equal(proposta.G9.v, "");
  assert.equal(proposta.H9.f, "SUM(F9:G9)");
  assert.match(proposta.L9.f, /'BDI e Encargos'/);
  assert.match(proposta.N9.f, /E9\*M9/);
  assert.equal(proposta.N4.f, "SUM(N5)");

  assert.equal(workbook.Sheets.Cronograma.E3.v, "Mês 1 · julho (30d)\n01/07/26 a 30/07/26");
  assert.equal(workbook.Sheets.Cronograma.F3.v, "Mês 2 · julho – agosto (60d)\n31/07/26 a 29/08/26");
  assert.equal(workbook.Sheets.Cronograma.C9.v, "Serviço de teste");
  assert.match(workbook.Sheets.Cronograma.D9.f, /'Orçamento Completo'!N9/);
  assert.equal(workbook.Sheets.Histograma.F4.v, "1.1.1.1.1 · Arquitetura");
  assert.match(workbook.Sheets.Histograma.J4.f, /'Cronograma'!E9/);
  assert.equal(
    proposta.F9.s.protection.locked,
    false,
  );
  assert.equal(proposta["!protect"].password, "PRUMO");

  const arquivo = await gerarArquivoPacoteLicitacao(orcamento);
  assert.ok(arquivo.byteLength > 10_000);
  const moduloExcelJs = await import("exceljs");
  const ExcelJS = moduloExcelJs.default || moduloExcelJs;
  const arquivoFinal = new ExcelJS.Workbook();
  await arquivoFinal.xlsx.load(arquivo);
  const propostaFinal = arquivoFinal.getWorksheet("Proposta de Preços");
  const completaFinal = arquivoFinal.getWorksheet("Orçamento Completo");
  const cronogramaFinal = arquivoFinal.getWorksheet("Cronograma");
  assert.equal(propostaFinal.model.sheetProtection.sheet, true);
  assert.equal(propostaFinal.getCell("F9").protection.locked, false);
  assert.equal(propostaFinal.getCell("G9").protection.locked, false);
  assert.notEqual(propostaFinal.getCell("E9").protection?.locked, false);
  assert.notEqual(propostaFinal.getCell("L9").protection?.locked, false);
  assert.equal(propostaFinal.getCell("F9").fill.fgColor.argb, "FFF2CC");
  assert.equal(completaFinal.getCell("L9").protection.locked, false);
  assert.equal(completaFinal.getCell("L9").fill.fgColor.argb, "FFF2CC");
  assert.equal(cronogramaFinal.getCell("E9").protection.locked, false);
  assert.notEqual(cronogramaFinal.getCell("E4").protection?.locked, false);

  const moduloZip = await import("jszip");
  const JSZip = moduloZip.default || moduloZip;
  const pacote = await JSZip.loadAsync(arquivo);
  for (let indice = 1; indice <= 6; indice += 1) {
    const xmlAba = await pacote.file(`xl/worksheets/sheet${indice}.xml`).async("string");
    assert.match(
      xmlAba,
      /<sheetFormatPr\b[^>]*\bdefaultRowHeight="[^"]+"/,
      `A aba ${indice} precisa declarar a altura padrão exigida pelo Excel`,
    );
  }
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

test("exporta somente as planilhas selecionadas e preserva a proteção", async () => {
  const orcamento = normalizarOrcamento(ORCAMENTOS_INICIAIS[0]);
  const arquivo = await gerarArquivoPacoteLicitacao(
    orcamento,
    ["Orçamento Completo", "BDI e Encargos"],
  );
  const moduloExcelJs = await import("exceljs");
  const ExcelJS = moduloExcelJs.default || moduloExcelJs;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arquivo);
  assert.deepEqual(workbook.worksheets.map((aba) => aba.name), [
    "Orçamento Completo",
    "BDI e Encargos",
  ]);
  assert.equal(workbook.getWorksheet("Orçamento Completo").model.sheetProtection.sheet, true);
});
