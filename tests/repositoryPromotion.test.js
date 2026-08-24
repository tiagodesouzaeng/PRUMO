import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { criarManifestoLocalOrcamentos } from "../src/services/repositorioCorporativo.js";
import {
  compararManifestosRepositorio,
  criarManifestoCorporativoOrcamentos,
  validarManifestoLocal,
} from "../server/domain/repositoryTransition.js";

test("manifestos local e corporativo comprovam a mesma origem sem considerar metadados técnicos", async () => {
  const local = [{ id: "ORC-2", nome: "Escola", itens: [{ id: "I-1", unitario: 125.45 }] }];
  const manifestoLocal = await criarManifestoLocalOrcamentos(local);
  const manifestoCorporativo = criarManifestoCorporativoOrcamentos([{
    id: "9e00a03f-bc61-4a19-afaf-902f8bbebd70",
    nome: "Escola",
    dados: {
      ...local[0],
      tenantId: "EMP-1",
      teamId: "EQ-A",
      idOrigemMigracao: "ORC-2",
      loteMigracaoId: "LOTE-1",
      atualizadoEm: "2026-08-19T12:00:00.000Z",
    },
  }]);

  assert.deepEqual(compararManifestosRepositorio(manifestoLocal, manifestoCorporativo), {
    conforme: true, ausentes: [], excedentes: [], divergentes: [],
  });
});

test("paridade identifica registros ausentes, excedentes e alterados", async () => {
  const local = await criarManifestoLocalOrcamentos([
    { id: "ORC-1", nome: "Original" },
    { id: "ORC-2", nome: "Ausente" },
  ]);
  const corporativo = criarManifestoCorporativoOrcamentos([
    { id: "DB-1", nome: "Alterado", dados: { id: "ORC-1", nome: "Alterado" } },
    { id: "DB-3", nome: "Excedente", dados: { id: "ORC-3", nome: "Excedente" } },
  ]);
  const resultado = compararManifestosRepositorio(local, corporativo);
  assert.equal(resultado.conforme, false);
  assert.deepEqual(resultado.ausentes, ["ORC-2"]);
  assert.deepEqual(resultado.excedentes, ["ORC-3"]);
  assert.deepEqual(resultado.divergentes, ["ORC-1"]);
});

test("servidor rejeita manifesto adulterado ou com identificador duplicado", async () => {
  const manifesto = await criarManifestoLocalOrcamentos([{ id: "ORC-1", nome: "Teste" }]);
  assert.throws(() => validarManifestoLocal({ ...manifesto, total: 2 }), /contagem/i);
  assert.throws(() => validarManifestoLocal({ ...manifesto, hash: "0".repeat(64) }), /consolidado/i);
  const duplicado = { ...manifesto, total: 2, registros: [manifesto.registros[0], manifesto.registros[0]] };
  assert.throws(() => validarManifestoLocal(duplicado), /duplicados/i);
});

test("migrações da promoção preservam RLS, imutabilidade e retorno controlado", async () => {
  const sql = await readFile(new URL("../server/migrations/035_promocao_repositorios_v29.sql", import.meta.url), "utf8");
  const correcao = await readFile(new URL("../server/migrations/036_correcao_limpeza_promocao_v29.sql", import.meta.url), "utf8");
  assert.match(sql, /repository_transition_verifications/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /repository_transition_verifications_imutaveis/);
  assert.match(sql, /24 hours/);
  assert.match(sql, /motivo_retorno/);
  assert.match(correcao, /prumo_migrator/);
  assert.match(correcao, /app\.team_id/);
});
