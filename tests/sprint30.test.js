import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { criarAplicacaoApi } from "../server/app.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { classificarSituacaoPpci, resumirPpcis, validarLocalPpci } from "../server/domain/fireSafety.js";

const headers = (idempotencia = "", versao = "") => ({
  "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1",
  ...(idempotencia ? { "idempotency-key": idempotencia } : {}),
  ...(versao !== "" ? { "if-match": String(versao) } : {}),
});

async function api() {
  return criarAplicacaoApi({
    repository: criarRepositorioMemoria({
      tenants: [{ id: "EMP-1", nome: "Federação", status: "ativo" }],
      memberships: [{ tenantId: "EMP-1", subject: "ADMIN", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
      unidadesPatrimoniais: [
        { id: "CLI-1", tenantId: "EMP-1", teamId: "EQ-1", nivel: "cliente", codigo: "C-01", nome: "Cliente", status: "ativo" },
        { id: "SITE-1", tenantId: "EMP-1", teamId: "EQ-1", parentId: "CLI-1", nivel: "site", codigo: "S-01", nome: "Site Centro", status: "ativo" },
        { id: "PRE-1", tenantId: "EMP-1", teamId: "EQ-1", parentId: "SITE-1", nivel: "predio", codigo: "P-01", nome: "Prédio Administrativo", status: "ativo" },
        { id: "SALA-1", tenantId: "EMP-1", teamId: "EQ-1", parentId: "PRE-1", nivel: "sala", codigo: "SL-01", nome: "Sala técnica", status: "ativo" },
      ],
      ativosPatrimoniais: [{ id: "AT-1", tenantId: "EMP-1", teamId: "EQ-1", salaId: "SALA-1", codigo: "AT-01", nome: "Central de alarme", status: "ativo" }],
    }),
    authenticate: async () => ({ subject: "ADMIN" }),
  });
}

test("PPCI aceita Site, Prédio ou Sala e calcula vencimentos", () => {
  assert.throws(() => validarLocalPpci({ nivel: "cliente", status: "ativo" }), /Site, Prédio ou Sala/);
  assert.equal(validarLocalPpci({ nivel: "predio", status: "ativo" }).nivel, "predio");
  assert.equal(classificarSituacaoPpci({ status: "aprovado", dataValidade: "2026-08-01" }, new Date("2026-08-19T00:00:00Z")), "vencido");
  assert.deepEqual(resumirPpcis([{ status: "aprovado", dataValidade: "2027-01-01" }], new Date("2026-08-19T00:00:00Z")), { total: 1, regulares: 1, aVencer: 0, vencidos: 0, emTramitacao: 0 });
});

test("API local governa PPCI, sistemas, ativos e inspeções", async (t) => {
  const app = await api(); t.after(() => app.close());
  const invalido = await app.inject({ method: "POST", url: "/v1/regularidade/ppci", headers: headers("ppci-cliente"), payload: { patrimonioUnidadeId: "CLI-1", codigo: "PPCI-000", titulo: "Inválido" } });
  assert.equal(invalido.statusCode, 422, invalido.body);
  let resposta = await app.inject({ method: "POST", url: "/v1/regularidade/ppci", headers: headers("ppci-1"), payload: { patrimonioUnidadeId: "PRE-1", codigo: "PPCI-001", titulo: "PPCI prédio administrativo", numeroProcesso: "CBM-2026-001", fase: "analise", status: "em_analise", dataValidade: "2027-08-01", responsavel: "Engenharia", dados: {} } });
  assert.equal(resposta.statusCode, 201, resposta.body); let ppci = resposta.json();
  resposta = await app.inject({ method: "POST", url: `/v1/regularidade/ppci/${ppci.id}/sistemas`, headers: headers("sistema-1"), payload: { patrimonioUnidadeId: "SALA-1", ativoId: "AT-1", tipo: "alarme", descricao: "Central de detecção e alarme", quantidade: 1, conformidade: "conforme", dados: {} } });
  assert.equal(resposta.statusCode, 201, resposta.body);
  resposta = await app.inject({ method: "POST", url: `/v1/regularidade/ppci/${ppci.id}/inspecoes`, headers: headers("insp-1"), payload: { dataInspecao: "2026-08-19", tipo: "preventiva", resultado: "conforme", inspetor: "Equipe técnica", evidencias: [] } });
  assert.equal(resposta.statusCode, 201, resposta.body);
  resposta = await app.inject({ method: "GET", url: `/v1/regularidade/ppci/${ppci.id}`, headers: headers() });
  assert.equal(resposta.statusCode, 200); assert.equal(resposta.json().sistemas.length, 1); assert.equal(resposta.json().inspecoes.length, 1);
  ppci = resposta.json();
  resposta = await app.inject({ method: "PUT", url: `/v1/regularidade/ppci/${ppci.id}`, headers: headers("", ppci.versao), payload: { patrimonioUnidadeId: "PRE-1", codigo: "PPCI-001", titulo: "PPCI aprovado", fase: "concluido", status: "aprovado", dataValidade: "2027-08-01", responsavel: "Engenharia", dados: {} } });
  assert.equal(resposta.statusCode, 200, resposta.body); assert.equal(resposta.json().versao, 2);
});

test("Sprint 30 elimina a fonte externa e protege o banco PPCI com RLS", async () => {
  const [hook, migration, tela] = await Promise.all([
    readFile(new URL("../src/hooks/usePPCI.js", import.meta.url), "utf8"),
    readFile(new URL("../server/migrations/037_ppci_local_regularidade_v30.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Regularidade.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(hook, /cliente\.listarPpcis\(\)/); assert.doesNotMatch(hook, /script\.google\.com|getPPCIs/);
  assert.match(migration, /CREATE TABLE app\.fire_safety_plans/); assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
  assert.match(migration, /nivel_local NOT IN\('site','predio','sala'\)/);
  assert.match(tela, /Sistemas preventivos/); assert.match(tela, /Histórico imutável/);
});
