import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularCoberturaSuprimentos,
  consolidarDemandaSuprimentos,
} from "../src/services/suprimentos.js";

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
        { referenciaTipo: "insumo", referenciaCodigo: "PED", descricao: "Pedreiro", unidade: "H", coeficiente: 1.5, preco: 28 },
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
  assert.equal(resultado.maoObra.length, 1);
  assert.equal(resultado.maoObra[0].quantidade, 15);
  assert.equal(resultado.maoObra[0].origensDetalhadas[0].servicoId, "servico");
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

test("resolve a base pelo nome para orçamentos legados sem basePrecoId", async () => {
  const chamadas = [];
  const resultado = await consolidarDemandaSuprimentos({
    itens: [{
      id: "servico-legado",
      tipo: "servico",
      codigo: "1.1",
      descricao: "Serviço SINAPI legado",
      fonte: "SINAPI · 99999",
      quantidade: 2,
      unidade: "M²",
      referenciaTipo: "composicao",
      referenciaCodigo: "99999",
    }],
    composicoes: [],
  }, async (baseId, codigo, uf) => {
    chamadas.push({ baseId, codigo, uf });
    return [{
      referenciaTipo: "mao_obra",
      referenciaCodigo: "00001",
      descricao: "Pedreiro",
      unidade: "H",
      coeficiente: 3,
    }];
  }, [{
    id: "sinapi-nacional-2026-06",
    titulo: "SINAPI 06/2026",
    fonte: "SINAPI",
    uf: "NACIONAL",
    referencia: "06/2026",
    ufsDisponiveis: ["RS", "SP"],
  }]);

  assert.deepEqual(chamadas, [{
    baseId: "sinapi-nacional-2026-06",
    codigo: "99999",
    uf: "RS",
  }]);
  assert.equal(resultado.maoObra[0].descricao, "Pedreiro");
  assert.equal(resultado.maoObra[0].quantidade, 6);
  assert.equal(resultado.pendencias.length, 0);
});

test("distribui insumos pelo cronograma e calcula a data recomendada de compra", async () => {
  const resultado = await consolidarDemandaSuprimentos({
    inicioObra: "2026-08-01",
    fimObra: "2026-09-29",
    intervaloMedicaoDias: 30,
    suprimentosConfig: {
      antecedenciaPadraoDias: 10,
      antecedenciasPorItem: {},
    },
    cronogramaQuantidades: {
      servico: {
        "2026-08-01": 5,
        "2026-08-31": 5,
      },
    },
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
      componentes: [{
        referenciaTipo: "insumo",
        referenciaCodigo: "CIM",
        descricao: "Cimento",
        unidade: "KG",
        coeficiente: 2,
        preco: 1,
      }],
    }],
  });

  assert.equal(resultado.planoCompras.length, 2);
  assert.deepEqual(
    resultado.planoCompras.map((item) => ({
      consumo: item.consumoEm,
      compra: item.comprarAte,
      quantidade: item.quantidade,
    })),
    [
      { consumo: "2026-08-01", compra: "2026-07-22", quantidade: 10 },
      { consumo: "2026-08-31", compra: "2026-08-21", quantidade: 10 },
    ],
  );
  assert.equal(
    resultado.planoCompras.reduce((total, item) => total + item.quantidade, 0),
    resultado.insumos[0].quantidade,
  );
});

test("projeta cobertura com estoque e pedidos entregues antes do consumo", () => {
  const plano = [
    { insumoChave: "cimento", descricao: "Cimento", consumoEm: "2026-08-01", quantidade: 10 },
    { insumoChave: "cimento", descricao: "Cimento", consumoEm: "2026-09-01", quantidade: 10 },
  ];
  const cobertura = calcularCoberturaSuprimentos(plano, {
    estoquesPorItem: { cimento: 8 },
    pedidos: [{
      id: "pedido-1",
      insumoChave: "cimento",
      quantidade: 7,
      entregaEm: "2026-08-20",
      status: "Emitido",
    }],
  });

  assert.equal(cobertura[0].faltaProjetada, 2);
  assert.equal(cobertura[0].statusCobertura, "Ruptura");
  assert.equal(cobertura[1].pedidosRecebidos, 7);
  assert.equal(cobertura[1].faltaProjetada, 5);
  assert.equal(cobertura[1].saldoProjetado, 0);
});

test("aplica conversão, perda e equivalência mantendo a rastreabilidade", async () => {
  const resultado = await consolidarDemandaSuprimentos({
    inicioObra: "2026-08-01",
    fimObra: "2026-08-30",
    intervaloMedicaoDias: 30,
    cronogramaQuantidades: { servico: { "2026-08-01": 10 } },
    suprimentosConfig: {
      regrasPorItem: {
        "Base própria:CIM:KG": {
          fatorConversao: 0.5,
          perdaPercentual: 10,
          codigoSubstituto: "CIM-EQ",
          descricaoSubstituto: "Cimento equivalente",
          unidadeDestino: "SC",
          baseSubstituta: "Fornecedor homologado",
          precoSubstituto: 40,
          justificativa: "Conversão de quilogramas para sacos.",
        },
      },
    },
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
      componentes: [{
        referenciaTipo: "insumo",
        referenciaCodigo: "CIM",
        descricao: "Cimento",
        unidade: "KG",
        coeficiente: 2,
        preco: 1,
      }],
    }],
  });

  const [insumo] = resultado.insumos;
  assert.equal(insumo.codigo, "CIM-EQ");
  assert.equal(insumo.descricao, "Cimento equivalente");
  assert.equal(insumo.unidade, "SC");
  assert.equal(insumo.base, "Fornecedor homologado");
  assert.equal(insumo.quantidadeOriginal, 20);
  assert.equal(insumo.quantidadeConvertida, 10);
  assert.equal(insumo.quantidade, 11);
  assert.equal(insumo.valorEstimado, 440);
  assert.equal(insumo.regrasAplicadas.length, 1);
  assert.equal(insumo.origensDetalhadas[0].quantidadeOriginal, 20);
  assert.equal(resultado.planoCompras[0].quantidade, 11);
});
