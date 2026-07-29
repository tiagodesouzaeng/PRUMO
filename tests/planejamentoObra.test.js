import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDataFimPorPrazo,
  calcularPrazoDias,
  calcularSaldosMedicao,
  criarPeriodosMedicao,
  distribuirSaldoInteiroNosVazios,
  distribuirSaldoNosVazios,
  obterCronogramaProposto,
  obterHistogramaInteligente,
  normalizarPlanejamentoObra,
  totalGrupo,
  validarMedicaoAcumulada,
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
  assert.equal(periodos[0].label, "Mês 1 · julho (30d)");
  assert.equal(periodos[0].subLabel, "01/07/26 a 30/07/26");
  assert.equal(periodos[1].label, "Mês 2 · julho – agosto (60d)");
  assert.equal(periodos[1].subLabel, "31/07/26 a 29/08/26");
});

test("distribui somente o saldo nos períodos ainda vazios", () => {
  const periodos = [
    { inicio: "2026-01-01" },
    { inicio: "2026-01-31" },
    { inicio: "2026-03-02" },
  ];
  assert.deepEqual(
    distribuirSaldoNosVazios(12, periodos, { "2026-01-01": 2 }),
    {
      "2026-01-01": 2,
      "2026-01-31": 5,
      "2026-03-02": 5,
    },
  );
  const fracionado = distribuirSaldoNosVazios(10, periodos, { "2026-01-01": 2 });
  assert.equal(
    Object.values(fracionado).reduce((total, valor) => total + valor, 0),
    10,
  );
  assert.deepEqual(
    distribuirSaldoNosVazios(12, periodos, {
      "2026-01-01": 2,
      "2026-01-31": 0,
      "2026-03-02": "",
    }),
    {
      "2026-01-01": 2,
      "2026-01-31": 0,
      "2026-03-02": 10,
    },
  );
});

test("distribui pessoas inteiras no histograma, preserva zero e aceita excedentes", () => {
  const periodos = [
    { inicio: "2026-01-01" },
    { inicio: "2026-02-01" },
    { inicio: "2026-03-01" },
    { inicio: "2026-04-01" },
  ];
  assert.deepEqual(
    distribuirSaldoInteiroNosVazios(8, periodos, {
      "2026-01-01": 0,
      "2026-02-01": "",
      "2026-03-01": "",
      "2026-04-01": "",
    }),
    {
      "2026-01-01": 0,
      "2026-02-01": 3,
      "2026-03-01": 3,
      "2026-04-01": 2,
    },
  );
  assert.deepEqual(
    distribuirSaldoInteiroNosVazios(8, periodos, {
      "2026-01-01": 10,
      "2026-02-01": "",
      "2026-03-01": "",
      "2026-04-01": "",
    }),
    {
      "2026-01-01": 10,
      "2026-02-01": 0,
      "2026-03-01": 0,
      "2026-04-01": 0,
    },
  );
});

test("calcula o saldo acumulado da medição e impede quantidade ou valor acima de 100%", () => {
  const orcamento = {
    itens: [{
      id: "servico-1",
      tipo: "servico",
      codigo: "1.1",
      descricao: "Serviço medido",
      quantidade: 10,
      unitario: 100,
    }],
    medicoes: [{
      id: "MED-001",
      status: "Aprovada",
      itens: [{
        itemId: "servico-1",
        quantidadePeriodo: 6,
        precoUnitario: 100,
      }],
    }],
  };
  const saldo = calcularSaldosMedicao(orcamento).get("servico-1");
  assert.equal(saldo.quantidadeMedidaAnterior, 6);
  assert.equal(saldo.saldoQuantidade, 4);
  assert.equal(saldo.valorMedidoAnterior, 600);
  assert.equal(saldo.saldoValor, 400);

  const excedida = validarMedicaoAcumulada(orcamento, {
    id: "MED-002",
    itens: [{
      itemId: "servico-1",
      quantidadePeriodo: 5,
      precoUnitario: 100,
    }],
  });
  assert.equal(excedida.valida, false);
  assert.equal(excedida.erros.length, 2);

  const noLimite = validarMedicaoAcumulada(orcamento, {
    id: "MED-002",
    itens: [{
      itemId: "servico-1",
      quantidadePeriodo: 4,
      precoUnitario: 100,
    }],
  });
  assert.equal(noLimite.valida, true);
});

test("ao editar uma medição, exclui a própria versão do acumulado", () => {
  const orcamento = {
    itens: [{
      id: "servico-1",
      tipo: "servico",
      quantidade: 10,
      unitario: 100,
    }],
    medicoes: [{
      id: "MED-001",
      status: "Em conferência",
      itens: [{
        itemId: "servico-1",
        quantidadePeriodo: 6,
        precoUnitario: 100,
      }],
    }],
  };
  const saldoEdicao = calcularSaldosMedicao(orcamento, "MED-001").get("servico-1");
  assert.equal(saldoEdicao.saldoQuantidade, 10);
  assert.equal(validarMedicaoAcumulada(orcamento, {
    ...orcamento.medicoes[0],
    itens: [{ itemId: "servico-1", quantidadePeriodo: 10, precoUnitario: 100 }],
  }).valida, true);
});

test("sincroniza prazo em dias corridos com a data final nos dois sentidos", () => {
  assert.equal(calcularDataFimPorPrazo("2026-08-12", 90), "2026-11-10");
  assert.equal(calcularPrazoDias("2026-08-12", "2026-11-10"), 90);
  const planejamento = normalizarPlanejamentoObra({
    inicioObra: "2026-08-12",
    fimObra: "2026-11-10",
    intervaloMedicaoDias: 30,
  });
  assert.equal(planejamento.prazoDias, 90);
});

test("distribui meses de profissional e identifica sobreposição de equipe", () => {
  const orcamento = {
    inicioObra: "2026-01-01",
    fimObra: "2026-12-31",
    intervaloMedicaoDias: 31,
    itens: [{
      id: "eng",
      codigo: "1.1",
      tipo: "servico",
      descricao: "Engenheiro residente",
      unidade: "MÊS",
      quantidade: 18,
      unitario: 1,
      referenciaCodigo: "",
    }],
    composicoes: [],
  };
  const cronograma = obterCronogramaProposto(orcamento);
  const quantidades = Object.values(cronograma.servicos[0].quantidades);
  assert.equal(quantidades.reduce((total, valor) => total + valor, 0), 18);
  assert.ok(quantidades.some((valor) => valor === 2));
  const histograma = obterHistogramaInteligente(orcamento);
  assert.equal(histograma.funcoes[0].funcao, "Engenheiro");
  assert.ok(histograma.funcoes[0].totalHoras > 0);
  assert.ok(Object.values(histograma.funcoes[0].quantidades).some((valor) => valor === 2));
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

test("totaliza a EAP por todos os descendentes do nível", () => {
  const itens = [
    { tipo: "grupo", codigo: "2" },
    { tipo: "grupo", codigo: "2.1" },
    { tipo: "servico", codigo: "2.1.1", quantidade: 2, unitario: 10 },
    { tipo: "grupo", codigo: "2.2" },
    { tipo: "grupo", codigo: "2.2.3" },
    { tipo: "servico", codigo: "2.2.3.1", quantidade: 3, unitario: 20 },
    { tipo: "servico", codigo: "3.1", quantidade: 99, unitario: 99 },
  ];
  assert.equal(totalGrupo(itens, "2"), 80);
  assert.equal(totalGrupo(itens, "2.2"), 60);
  assert.equal(totalGrupo(itens, "2.2.3"), 60);
});
