import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularHashConteudo,
  criarPacoteMigracao,
  criarPlanoMigracao,
  inventariarDadosLocais,
  validarPacoteMigracao,
} from "../src/services/migracaoCorporativa.js";

test("hash da migração é determinístico independentemente da ordem das chaves", async () => {
  assert.equal(
    await calcularHashConteudo({ a: 1, b: { c: 2 } }),
    await calcularHashConteudo({ b: { c: 2 }, a: 1 }),
  );
});
test("pacote de migração recebe empresa, integridade e idempotência", async () => {
  const pacote = await criarPacoteMigracao({
    contexto: { tenantId: "EMP-1", teamId: "EQ-1", usuarioId: "USR-1" },
    dados: {
      orcamentos: [{ id: "ORC-1", nome: "Obra" }],
      composicoesProprias: [{ id: "CP-1", nome: "Composição" }],
    },
    criadoEm: "2026-07-30T12:00:00.000Z",
  });
  assert.equal(pacote.dominios[0].registros[0].tenantId, "EMP-1");
  assert.match(pacote.hash, /^[a-f0-9]{64}$/);
  assert.match(pacote.idempotencyKey, /^migracao:EMP-1:/);
  assert.equal(validarPacoteMigracao(pacote).valido, true);
});

test("inventário ordena um plano reversível por prioridade", () => {
  const inventario = inventariarDadosLocais({
    orcamentos: [{ id: "1" }],
    bases: [{ id: "2" }, { id: "3" }],
  });
  const plano = criarPlanoMigracao(inventario);
  assert.equal(plano[0].dominioId, "orcamentos");
  assert.equal(plano[0].permiteRetorno, true);
  assert.equal(plano.find((item) => item.dominioId === "bases-precos").total, 2);
});
