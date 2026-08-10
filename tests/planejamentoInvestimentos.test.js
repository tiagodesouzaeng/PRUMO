import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { calcularPontuacaoDemanda, resolverTransicaoDemanda } from "../server/domain/planning.js";

const cabecalhos = (chave = "", versao = "") => ({
  "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1",
  ...(chave ? { "idempotency-key": chave } : {}), ...(versao ? { "if-match": versao } : {}),
});

async function criarApi() {
  return criarAplicacaoApi({
    repository: criarRepositorioMemoria({
      tenants: [{ id: "EMP-1", nome: "Órgão público", status: "ativo" }],
      memberships: [{ tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
    }), authenticate: async () => ({ subject: "ADMIN" }),
  });
}

test("pontuação pondera urgência, impacto, risco e alinhamento", () => {
  assert.equal(calcularPontuacaoDemanda({ urgencia: 5, impacto: 5, risco: 5, alinhamento: 5 }), 100);
  assert.equal(calcularPontuacaoDemanda({ urgencia: 1, impacto: 1, risco: 1, alinhamento: 1 }), 20);
  assert.deepEqual(resolverTransicaoDemanda("em_analise", "priorizar"), { statusNovo: "priorizada", permissao: "planejamento.priorizar" });
  assert.throws(() => resolverTransicaoDemanda("rascunho", "aprovar"), /não é permitida/);
});

test("demanda percorre análise, priorização, aprovação e carteira anual", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const unidade = await app.inject({ method: "POST", url: "/v1/patrimonio/unidades", headers: cabecalhos("UNIDADE"), payload: { nivel: "cliente", codigo: "C-001", nome: "Secretaria de Educação" } });
  assert.equal(unidade.statusCode, 201);
  const programa = await app.inject({ method: "POST", url: "/v1/planejamento/programas", headers: cabecalhos("PROGRAMA"), payload: { codigo: "PRG-001", nome: "Modernização predial", objetivo: "Reduzir riscos", anoInicio: 2026, anoFim: 2028, limiteFinanceiro: 1000000 } });
  assert.equal(programa.statusCode, 201);
  const carteira = await app.inject({ method: "POST", url: "/v1/planejamento/carteiras", headers: cabecalhos("CARTEIRA"), payload: { codigo: "CAR-2026-01", nome: "Plano anual 2026", ano: 2026, limiteFinanceiro: 500000 } });
  assert.equal(carteira.statusCode, 201);
  const payload = { patrimonioUnidadeId: unidade.json().id, programaId: programa.json().id, codigo: "D-001", titulo: "Adequação de acessibilidade", categoria: "acessibilidade", valorEstimado: 150000, urgencia: 4, impacto: 5, risco: 3, alinhamento: 5 };
  const demanda = await app.inject({ method: "POST", url: "/v1/planejamento/demandas", headers: cabecalhos("DEMANDA"), payload });
  assert.equal(demanda.statusCode, 201); assert.equal(demanda.json().status, "rascunho"); assert.equal(demanda.json().pontuacao, 86);

  let atual = demanda.json();
  for (const acao of ["enviar_analise", "priorizar", "aprovar"]) {
    const resposta = await app.inject({ method: "POST", url: `/v1/planejamento/demandas/${atual.id}/decisoes`, headers: cabecalhos(`DECISAO-${acao}`, atual.versao), payload: { acao, justificativa: `Decisão ${acao}` } });
    assert.equal(resposta.statusCode, 201); atual = resposta.json().demanda;
  }
  assert.equal(atual.status, "aprovada");
  const incorporacao = await app.inject({ method: "POST", url: `/v1/planejamento/carteiras/${carteira.json().id}/demandas`, headers: cabecalhos("INCORPORAR", atual.versao), payload: { demandId: atual.id, ordem: 1, valorPlanejado: 145000, observacao: "Reserva aprovada" } });
  assert.equal(incorporacao.statusCode, 201); assert.equal(incorporacao.json().demanda.status, "incorporada");
  const lista = await app.inject({ method: "GET", url: "/v1/planejamento/carteiras", headers: cabecalhos() });
  assert.equal(lista.json()[0].itens.length, 1); assert.equal(lista.json()[0].itens[0].valorPlanejado, 145000);
  const historico = await app.inject({ method: "GET", url: `/v1/planejamento/demandas/${atual.id}/decisoes`, headers: cabecalhos() });
  assert.deepEqual(historico.json().map((item) => item.statusNovo), ["incorporada", "aprovada", "priorizada", "em_analise"]);
});

test("governança bloqueia versão antiga, transição indevida e estouro da carteira", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const unidade = (await app.inject({ method: "POST", url: "/v1/patrimonio/unidades", headers: cabecalhos("U2"), payload: { nivel: "cliente", codigo: "C-002", nome: "Federação" } })).json();
  const demanda = (await app.inject({ method: "POST", url: "/v1/planejamento/demandas", headers: cabecalhos("D2"), payload: { patrimonioUnidadeId: unidade.id, codigo: "D-002", titulo: "Reforma emergencial", valorEstimado: 200000 } })).json();
  const direta = await app.inject({ method: "POST", url: `/v1/planejamento/demandas/${demanda.id}/decisoes`, headers: cabecalhos("DIRETA", demanda.versao), payload: { acao: "aprovar" } });
  assert.equal(direta.statusCode, 422); assert.equal(direta.json().erro.codigo, "TRANSICAO_DEMANDA_INVALIDA");
  const enviada = await app.inject({ method: "POST", url: `/v1/planejamento/demandas/${demanda.id}/decisoes`, headers: cabecalhos("ENVIAR", demanda.versao), payload: { acao: "enviar_analise" } });
  const concorrente = await app.inject({ method: "POST", url: `/v1/planejamento/demandas/${demanda.id}/decisoes`, headers: cabecalhos("CONCORRENTE", demanda.versao), payload: { acao: "priorizar" } });
  assert.equal(concorrente.statusCode, 412);
  const rejeicaoSemMotivo = await app.inject({ method: "POST", url: `/v1/planejamento/demandas/${demanda.id}/decisoes`, headers: cabecalhos("REJEITAR", enviada.json().demanda.versao), payload: { acao: "rejeitar", justificativa: "" } });
  assert.equal(rejeicaoSemMotivo.statusCode, 422); assert.equal(rejeicaoSemMotivo.json().erro.codigo, "JUSTIFICATIVA_OBRIGATORIA");
});
