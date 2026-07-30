import test from "node:test";
import assert from "node:assert/strict";
import {
  BDI_DIFERENCIADO_COMPONENTES_PADRAO,
  calcularBdiDetalhado,
  calcularTotais,
  normalizarOrcamento,
  obterBdi,
  obterBdiDiferenciado,
  obterBdiItem,
  validarBdiDiferenciadoItem,
  validarOrcamento,
} from "../src/domain/orcamento.js";

const memoriaValida = {
  inviabilidadeParcelamento: true,
  naturezaEspecifica: true,
  fornecedorEspecializado: true,
  impactoSignificativo: true,
  meraIntermediacao: true,
  servicosAssociadosSeparados: true,
  responsavel: "Responsável técnico",
  justificativa: "Fornecimento específico relevante, separado dos serviços de instalação.",
};

function criarOrcamentoTeste(itens) {
  return normalizarOrcamento({
    id: "ORC-BDI",
    nome: "Teste de BDI",
    inicioObra: "2026-01-01",
    fimObra: "2026-02-01",
    intervaloMedicaoDias: 30,
    itens,
    composicoes: [],
    revisoes: [],
  });
}

test("configuração diferenciada usa componentes médios do Acórdão 2622/2013", () => {
  const taxa = calcularBdiDetalhado(BDI_DIFERENCIADO_COMPONENTES_PADRAO);
  assert.ok(taxa >= 11.1);
  assert.ok(taxa <= 16.8);
  assert.equal(BDI_DIFERENCIADO_COMPONENTES_PADRAO.faixaReferencia.medio, 14.02);
});

test("BDI reduzido somente é aplicado quando todas as condições estão comprovadas", () => {
  const itemIncompleto = {
    tipo: "servico",
    bdiTipo: "diferenciado",
    bdiDiferenciado: { ...memoriaValida, impactoSignificativo: false },
  };
  const itemValido = {
    ...itemIncompleto,
    bdiDiferenciado: memoriaValida,
  };
  const orcamento = criarOrcamentoTeste([]);
  assert.equal(validarBdiDiferenciadoItem(itemIncompleto).elegivel, false);
  assert.equal(obterBdiItem(orcamento, itemIncompleto), obterBdi(orcamento));
  assert.equal(validarBdiDiferenciadoItem(itemValido).elegivel, true);
  assert.equal(obterBdiItem(orcamento, itemValido), obterBdiDiferenciado(orcamento));
});

test("totalização separa as bases e valores dos dois tipos de BDI", () => {
  const orcamento = criarOrcamentoTeste([
    {
      id: "padrao",
      codigo: "1",
      tipo: "servico",
      descricao: "Serviço executado",
      quantidade: 10,
      unidade: "UN",
      unitario: 100,
      bdiTipo: "padrao",
    },
    {
      id: "fornecimento",
      codigo: "2",
      tipo: "servico",
      descricao: "Equipamento específico",
      quantidade: 1,
      unidade: "UN",
      unitario: 1000,
      bdiTipo: "diferenciado",
      bdiDiferenciado: memoriaValida,
    },
  ]);
  const totais = calcularTotais(orcamento);
  assert.equal(totais.baseBdiPadrao, 1000);
  assert.equal(totais.baseBdiDiferenciado, 1000);
  assert.equal(totais.itensBdiDiferenciado, 1);
  assert.ok(totais.valorBdiPadrao > totais.valorBdiDiferenciado);
  assert.ok(Math.abs(
    totais.precoTotal - (totais.custoDireto + totais.valorBdi),
  ) < 0.001);
});

test("orçamento aponta item diferenciado sem memória completa", () => {
  const orcamento = criarOrcamentoTeste([{
    id: "pendente",
    codigo: "1",
    tipo: "servico",
    descricao: "Fornecimento pendente",
    quantidade: 1,
    unidade: "UN",
    unitario: 100,
    bdiTipo: "diferenciado",
    bdiDiferenciado: { ...memoriaValida, justificativa: "" },
  }]);
  assert.ok(validarOrcamento(orcamento).some(
    (problema) => problema.mensagem.includes("BDI diferenciado incompleto"),
  ));
});
