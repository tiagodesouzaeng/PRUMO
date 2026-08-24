import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { calcularSaldoBaseContratada, criarBaseContratada, resolverTransicaoSolicitacaoAditivo } from "../shared/budgetContracting.js";

const headers = (chave = "", versao = "") => ({ "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1", ...(chave ? { "idempotency-key": chave } : {}), ...(versao !== "" ? { "if-match": String(versao) } : {}) });

test("desconto vencedor gera preços contratados sem alterar preços publicados", () => {
  const entrada = [{ id: "I-1", codigo: "1.1", descricao: "Serviço A", unidade: "UN", quantidade: 3, precoPublicadoUnitario: 100.1299 }];
  const base = criarBaseContratada({ orcamentoId: "ORC-1", fornecedor: "Construtora", descontoPercentual: 10, justificativa: "Proposta vencedora homologada", itens: entrada, criadoEm: "2026-08-18T00:00:00.000Z" });
  assert.equal(base.itens[0].precoPublicadoUnitario, 100.1299);
  assert.equal(base.itens[0].precoContratadoUnitario, 90.1169);
  assert.equal(base.valorPublicado, 300.38);
  assert.equal(base.valorContratado, 270.35);
  assert.equal(entrada[0].precoPublicadoUnitario, 100.1299);
  assert.deepEqual(calcularSaldoBaseContratada(base, [{ status: "aprovada", valorBruto: 70.35 }]), { valorContratado: 270.35, valorMedido: 70.35, saldo: 200 });
});

test("solicitação de aditivo segue da obra para análise de custos", () => {
  assert.equal(resolverTransicaoSolicitacaoAditivo("rascunho", "submeter").para, "submetida");
  assert.equal(resolverTransicaoSolicitacaoAditivo("em_analise", "aprovar").permissao, "orcamento.analisar-aditivo");
  assert.throws(() => resolverTransicaoSolicitacaoAditivo("rascunho", "aprovar"), /não é permitida/);
});

test("migrações do ciclo contratado forçam RLS e preservam históricos", async () => {
  const sql = await readFile(new URL("../server/migrations/031_ciclo_orcamento_contratado_v27.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE app\.budget_contract_baselines/);
  assert.match(sql, /CREATE TABLE app\.work_change_requests/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/g);
  assert.match(sql, /budget_contract_baselines_immutable/);
  assert.match(sql, /orcamento\.analisar-aditivo/);
});

test("API homologa base, mede seu saldo e governa pedido de aditivo", async (t) => {
  const repository = criarRepositorioMemoria({
    tenants: [{ id: "EMP-1", nome: "Órgão", status: "ativo" }],
    memberships: [{ tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
    unidadesPatrimoniais: [{ id: "SALA-1", tenantId: "EMP-1", teamId: "EQ-1", nivel: "sala", codigo: "SL-01", nome: "Sala", status: "ativo", versao: 1 }],
    orcamentos: [{ id: "ORC-1", tenantId: "EMP-1", teamId: "EQ-1", nome: "Orçamento original", dados: { status: "Aprovado", total: 1000 }, versao: 1 }],
    contratosGestao: [{ id: "CT-1", tenantId: "EMP-1", teamId: "EQ-1", numero: "1/2026", titulo: "Contrato", status: "vigente", valorAtual: 900, versao: 1 }],
  });
  const app = await criarAplicacaoApi({ repository, authenticate: async () => ({ subject: "ADMIN" }) });
  t.after(() => app.close());
  const homologada = await app.inject({ method: "POST", url: "/v1/orcamentos/ORC-1/bases-contratadas", headers: headers("BASE-1"), payload: { fornecedor: "Construtora", descontoPercentual: 10, justificativa: "Resultado homologado", itens: [{ itemId: "I-1", codigo: "1.1", descricao: "Serviço", unidade: "UN", quantidade: 1, precoPublicadoUnitario: 1000 }] } });
  assert.equal(homologada.statusCode, 201, homologada.body);
  assert.equal(homologada.json().valorContratado, 900);
  const obraCriada = await app.inject({ method: "POST", url: "/v1/obras", headers: headers("OBRA-1"), payload: { patrimonioUnidadeId: "SALA-1", contractId: "CT-1", orcamentoId: "ORC-1", codigo: "OB-001", nome: "Reforma", dataInicio: "2026-08-01", dataFimPrevista: "2026-12-01", valorPrevisto: 1000, dados: {} } });
  assert.equal(obraCriada.statusCode, 201, obraCriada.body);
  const obra = obraCriada.json();
  const medicao = await app.inject({ method: "POST", url: `/v1/obras/${obra.id}/medicoes`, headers: headers("MED-1"), payload: { numero: 1, periodoInicio: "2026-08-01", periodoFim: "2026-08-31", valorBruto: 300, itens: [], dados: {} } });
  assert.equal(medicao.statusCode, 201, medicao.body);
  assert.equal(medicao.json().baseContratadaId, homologada.json().id);
  const criada = await app.inject({ method: "POST", url: `/v1/obras/${obra.id}/solicitacoes-aditivo`, headers: headers("SA-1"), payload: { tipo: "aditivo_valor", descricao: "Serviço adicional identificado", justificativa: "Condição técnica superveniente", impactoValor: 120, impactoPrazoDias: 5 } });
  assert.equal(criada.statusCode, 201, criada.body);
  let solicitacao = criada.json();
  for (const [acao, parecer] of [["submeter", ""], ["iniciar_analise", ""], ["aprovar", "Composição e preços validados pela engenharia de custos"]]) {
    const decisao = await app.inject({ method: "POST", url: `/v1/solicitacoes-aditivo/${solicitacao.id}/decisoes`, headers: headers(`SA-${acao}`, solicitacao.versao), payload: { acao, parecer } });
    assert.equal(decisao.statusCode, 201, decisao.body);
    solicitacao = decisao.json().solicitacao;
  }
  assert.equal(solicitacao.status, "aprovada");
  const original = await app.inject({ method: "GET", url: "/v1/orcamentos/ORC-1", headers: headers() });
  assert.equal(original.json().dados.total, 1000);
});
