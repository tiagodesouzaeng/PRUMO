import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { resolverTransicaoContratacao, validarPesquisaPrecos } from "../server/domain/procurement.js";

const headers = (idempotencyKey = "", versao = "") => ({
  "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1",
  ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  ...(versao ? { "if-match": String(versao) } : {}),
});

async function criarApi() {
  return criarAplicacaoApi({
    repository: criarRepositorioMemoria({
      tenants: [{ id: "EMP-1", nome: "Órgão público", status: "ativo" }],
      memberships: [{ tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
      demandasInvestimento: [{ id: "DEM-1", tenantId: "EMP-1", teamId: "EQ-1", codigo: "D-001", titulo: "Aquisição", status: "incorporada", versao: 5 }],
    }),
    authenticate: async () => ({ subject: "ADMIN" }),
  });
}

test("fluxo de suprimentos exige etapas e calcula memória de preços", () => {
  assert.deepEqual(resolverTransicaoContratacao("rascunho", "iniciar_planejamento"), { statusNovo: "planejamento", permissao: "suprimentos.editar" });
  assert.throws(() => resolverTransicaoContratacao("rascunho", "aprovar"), /não é permitida/);
  assert.deepEqual(validarPesquisaPrecos([{ valorTotal: 120 }, { valorTotal: 100 }, { valorTotal: 110 }]), { quantidade: 3, menor: 100, maior: 120, mediana: 110, media: 110 });
});

test("processo percorre planejamento, pesquisa, seleção, pedido e recebimento", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const fornecedor = await app.inject({ method: "POST", url: "/v1/suprimentos/fornecedores", headers: headers("FORN-1"), payload: { codigo: "F-001", razaoSocial: "Fornecedor Um", documento: "12345678000100", qualificacao: "qualificado" } });
  assert.equal(fornecedor.statusCode, 201);
  const processo = await app.inject({ method: "POST", url: "/v1/suprimentos/processos", headers: headers("PROC-1"), payload: { demandId: "DEM-1", codigo: "PC-001", titulo: "Compra de materiais", objeto: "Materiais para adequação", tipo: "material", regime: "publico", valorEstimado: 150000, estudoTecnico: { necessidade: "Atender demanda" }, riscos: [], termoReferencia: { escopo: "Fornecimento" } } });
  assert.equal(processo.statusCode, 201); let atual = processo.json();
  for (const acao of ["iniciar_planejamento", "abrir_pesquisa"]) {
    const resposta = await app.inject({ method: "POST", url: `/v1/suprimentos/processos/${atual.id}/decisoes`, headers: headers(`DEC-${acao}`, atual.versao), payload: { acao, dados: {} } });
    assert.equal(resposta.statusCode, 201); atual = resposta.json().processo;
  }
  const cotacao = await app.inject({ method: "POST", url: `/v1/suprimentos/processos/${atual.id}/cotacoes`, headers: headers("COT-1"), payload: { supplierId: fornecedor.json().id, valorTotal: 140000, prazoEntregaDias: 20 } });
  assert.equal(cotacao.statusCode, 201);
  for (const acao of ["iniciar_selecao", "aprovar"]) {
    const resposta = await app.inject({ method: "POST", url: `/v1/suprimentos/processos/${atual.id}/decisoes`, headers: headers(`DEC-${acao}`, atual.versao), payload: { acao, dados: {} } });
    assert.equal(resposta.statusCode, 201); atual = resposta.json().processo;
  }
  assert.equal(atual.status, "aprovada");
  const pedido = await app.inject({ method: "POST", url: `/v1/suprimentos/processos/${atual.id}/pedidos`, headers: headers("PED-1", atual.versao), payload: { supplierId: fornecedor.json().id, quoteId: cotacao.json().id, codigo: "PED-001", valorTotal: 140000 } });
  assert.equal(pedido.statusCode, 201); assert.equal(pedido.json().processo.status, "pedido_emitido");
  const recebimento = await app.inject({ method: "POST", url: `/v1/suprimentos/pedidos/${pedido.json().pedido.id}/recebimentos`, headers: headers("REC-1"), payload: { valorRecebido: 140000, aceite: "aceito" } });
  assert.equal(recebimento.statusCode, 201); assert.equal(recebimento.json().pedido.status, "recebido"); assert.equal(recebimento.json().processo.status, "concluida");
  const detalhe = await app.inject({ method: "GET", url: `/v1/suprimentos/processos/${atual.id}`, headers: headers() });
  assert.equal(detalhe.json().cotacoes[0].status, "vencedora"); assert.equal(detalhe.json().decisoes.length, 6);
});

test("governança bloqueia origem não incorporada e recebimento acima do saldo", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const semOrigem = await app.inject({ method: "POST", url: "/v1/suprimentos/processos", headers: headers("SEM-ORIGEM"), payload: { codigo: "PC-002", titulo: "Sem origem", objeto: "Objeto sem demanda" } });
  assert.equal(semOrigem.statusCode, 422); assert.equal(semOrigem.json().erro.codigo, "ORIGEM_CONTRATACAO_OBRIGATORIA");
});
