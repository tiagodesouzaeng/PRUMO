import test from "node:test";
import assert from "node:assert/strict";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";

async function criarApi() {
  return criarAplicacaoApi({
    repository: criarRepositorioMemoria({
      tenants: [{ id: "EMP-1", nome: "Órgão público", status: "ativo" }],
      memberships: [{
        tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador",
        teamIds: ["EQ-1"], status: "ativo",
      }],
    }),
    authenticate: async () => ({ subject: "ADMIN" }),
  });
}

const headers = (idempotencyKey = "", versao = "") => ({
  "x-prumo-tenant-id": "EMP-1",
  "x-prumo-team-id": "EQ-1",
  ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  ...(versao ? { "if-match": versao } : {}),
});

async function criarUnidade(app, payload, chave) {
  return app.inject({
    method: "POST", url: "/v1/patrimonio/unidades",
    headers: headers(chave), payload,
  });
}

test("patrimônio exige e preserva Cliente > Site > Prédio > Sala", async (t) => {
  const app = await criarApi(); t.after(() => app.close());

  const siteInvalido = await criarUnidade(app, { nivel: "site", codigo: "S-0", nome: "Site órfão" }, "SITE-INVALIDO");
  assert.equal(siteInvalido.statusCode, 422);
  assert.equal(siteInvalido.json().erro.codigo, "HIERARQUIA_PATRIMONIAL_INVALIDA");

  const cliente = await criarUnidade(app, { nivel: "cliente", codigo: "CLI-1", nome: "Cliente institucional" }, "CLI-1");
  assert.equal(cliente.statusCode, 201);
  const site = await criarUnidade(app, { nivel: "site", parentId: cliente.json().id, codigo: "SITE-1", nome: "Campus Centro" }, "SITE-1");
  const predio = await criarUnidade(app, { nivel: "predio", parentId: site.json().id, codigo: "PRED-1", nome: "Bloco Administrativo" }, "PRED-1");
  const sala = await criarUnidade(app, { nivel: "sala", parentId: predio.json().id, codigo: "SALA-101", nome: "Sala 101", areaM2: 42.5 }, "SALA-101");
  assert.equal(sala.statusCode, 201);

  const lista = await app.inject({ method: "GET", url: "/v1/patrimonio/unidades", headers: headers() });
  assert.equal(lista.statusCode, 200);
  assert.deepEqual(lista.json().find((item) => item.id === sala.json().id).caminho.map((item) => item.nivel), ["cliente", "site", "predio", "sala"]);

  const empreendimento = await app.inject({ method: "POST", url: "/v1/empreendimentos", headers: headers("OBRA-PATRIMONIO"), payload: { nome: "Reforma da Sala 101", patrimonioUnidadeId: sala.json().id } });
  assert.equal(empreendimento.statusCode, 201);
  assert.equal(empreendimento.json().patrimonioUnidadeId, sala.json().id);

  const predioComoSala = await app.inject({ method: "POST", url: "/v1/patrimonio/ativos", headers: headers("ATIVO-INVALIDO"), payload: { salaId: predio.json().id, codigo: "EQ-0", nome: "Equipamento inválido" } });
  assert.equal(predioComoSala.statusCode, 422);
  assert.equal(predioComoSala.json().erro.codigo, "SALA_PATRIMONIAL_INVALIDA");
});

test("ativos são versionados, movimentados entre salas e auditados", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const cliente = (await criarUnidade(app, { nivel: "cliente", codigo: "CLI-1", nome: "Cliente" }, "C1")).json();
  const site = (await criarUnidade(app, { nivel: "site", parentId: cliente.id, codigo: "SITE-1", nome: "Site" }, "S1")).json();
  const predio = (await criarUnidade(app, { nivel: "predio", parentId: site.id, codigo: "P-1", nome: "Prédio" }, "P1")).json();
  const salaA = (await criarUnidade(app, { nivel: "sala", parentId: predio.id, codigo: "A", nome: "Sala A" }, "SA")).json();
  const salaB = (await criarUnidade(app, { nivel: "sala", parentId: predio.id, codigo: "B", nome: "Sala B" }, "SB")).json();

  const ativo = await app.inject({ method: "POST", url: "/v1/patrimonio/ativos", headers: headers("AT-1"), payload: { salaId: salaA.id, codigo: "AR-001", nome: "Ar-condicionado", numeroPatrimonio: "PAT-900" } });
  assert.equal(ativo.statusCode, 201);

  const trocaSemMovimento = await app.inject({ method: "PUT", url: `/v1/patrimonio/ativos/${ativo.json().id}`, headers: headers("", ativo.json().versao), payload: { salaId: salaB.id, codigo: ativo.json().codigo, nome: ativo.json().nome, categoria: ativo.json().categoria, numeroPatrimonio: ativo.json().numeroPatrimonio, status: ativo.json().status } });
  assert.equal(trocaSemMovimento.statusCode, 422);
  assert.equal(trocaSemMovimento.json().erro.codigo, "MOVIMENTACAO_OBRIGATORIA");

  const desativacaoBloqueada = await app.inject({ method: "PUT", url: `/v1/patrimonio/unidades/${salaA.id}`, headers: headers("", salaA.versao), payload: { nivel: "sala", parentId: predio.id, codigo: salaA.codigo, nome: salaA.nome, status: "inativo" } });
  assert.equal(desativacaoBloqueada.statusCode, 422);
  assert.equal(desativacaoBloqueada.json().erro.codigo, "UNIDADE_PATRIMONIAL_EM_USO");

  const movimento = await app.inject({ method: "POST", url: `/v1/patrimonio/ativos/${ativo.json().id}/movimentacoes`, headers: headers("MOV-1"), payload: { destinoSalaId: salaB.id, motivo: "Remanejamento operacional" } });
  assert.equal(movimento.statusCode, 201);
  assert.equal(movimento.json().origemSalaId, salaA.id);
  assert.equal(movimento.json().destinoSalaId, salaB.id);

  const ativos = await app.inject({ method: "GET", url: "/v1/patrimonio/ativos", headers: headers() });
  assert.equal(ativos.json()[0].salaId, salaB.id);
  assert.equal(ativos.json()[0].versao, 2);
  const historico = await app.inject({ method: "GET", url: `/v1/patrimonio/ativos/${ativo.json().id}/movimentacoes`, headers: headers() });
  assert.equal(historico.json().length, 1);

  const auditoria = await app.inject({ method: "GET", url: "/v1/auditoria?moduleId=patrimonio", headers: headers() });
  assert.equal(auditoria.statusCode, 200);
  assert.ok(auditoria.json().itens.some((item) => item.acao === "patrimonio.ativo-movimentado"));
  assert.equal(auditoria.json().integridade.ok, true);
});

test("controle de versão e contrato modular protegem o patrimônio", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const unidade = (await criarUnidade(app, { nivel: "cliente", codigo: "CLI", nome: "Cliente" }, "CLI")).json();
  const atualizada = await app.inject({ method: "PUT", url: `/v1/patrimonio/unidades/${unidade.id}`, headers: headers("", unidade.versao), payload: { nivel: "cliente", codigo: "CLI", nome: "Cliente atualizado" } });
  assert.equal(atualizada.statusCode, 200);
  assert.equal(atualizada.json().versao, 2);
  const concorrente = await app.inject({ method: "PUT", url: `/v1/patrimonio/unidades/${unidade.id}`, headers: headers("", unidade.versao), payload: { nivel: "cliente", codigo: "CLI", nome: "Edição antiga" } });
  assert.equal(concorrente.statusCode, 412);

  const bloqueioDependencia = await app.inject({ method: "PUT", url: "/v1/produto-modular/modulos/patrimonio", headers: headers(), payload: { habilitado: false } });
  assert.equal(bloqueioDependencia.statusCode, 422);
  assert.equal(bloqueioDependencia.json().erro.codigo, "MODULO_POSSUI_DEPENDENTES");
});

test("nível patrimonial pode ser corrigido e unidade sem vínculos pode ser excluída", async (t) => {
  const app = await criarApi(); t.after(() => app.close());
  const cliente = (await criarUnidade(app, { nivel: "cliente", codigo: "CLI", nome: "Cliente" }, "CLI-CORRECAO")).json();
  const cadastroIncorreto = (await criarUnidade(app, { nivel: "site", parentId: cliente.id, codigo: "P-EX", nome: "Prédio de exemplo" }, "PREDIO-INCORRETO")).json();
  const siteCorreto = (await criarUnidade(app, { nivel: "site", parentId: cliente.id, codigo: "SITE", nome: "Site correto" }, "SITE-CORRETO")).json();

  const corrigido = await app.inject({
    method: "PUT", url: `/v1/patrimonio/unidades/${cadastroIncorreto.id}`,
    headers: headers("", cadastroIncorreto.versao),
    payload: { nivel: "predio", parentId: siteCorreto.id, codigo: cadastroIncorreto.codigo, nome: cadastroIncorreto.nome },
  });
  assert.equal(corrigido.statusCode, 200);
  assert.equal(corrigido.json().nivel, "predio");
  assert.equal(corrigido.json().parentId, siteCorreto.id);

  const exclusao = await app.inject({
    method: "DELETE", url: `/v1/patrimonio/unidades/${cadastroIncorreto.id}`,
    headers: headers("", corrigido.json().versao),
  });
  assert.equal(exclusao.statusCode, 204);
  const ausente = await app.inject({ method: "GET", url: `/v1/patrimonio/unidades/${cadastroIncorreto.id}`, headers: headers() });
  assert.equal(ausente.statusCode, 404);

  const exclusaoComFilho = await app.inject({
    method: "DELETE", url: `/v1/patrimonio/unidades/${cliente.id}`,
    headers: headers("", cliente.versao),
  });
  assert.equal(exclusaoComFilho.statusCode, 422);
  assert.equal(exclusaoComFilho.json().erro.codigo, "UNIDADE_PATRIMONIAL_EM_USO");
});
