import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarPropriedadeCorporativa,
  criarChaveObjetoCorporativo,
  criarContextoCorporativo,
  validarIsolamentoRegistro,
  validarSelecaoEmpresa,
} from "../src/domain/multiempresa.js";

const vinculos = [
  {
    tenantId: "EMP-1",
    tenantNome: "Empresa 1",
    perfilId: "gestor",
    equipes: ["EQ-A", "EQ-B"],
  },
  {
    tenantId: "EMP-2",
    tenantNome: "Empresa 2",
    perfilId: "consulta",
    equipes: ["EQ-C"],
    status: "inativo",
  },
];

test("contexto corporativo aceita somente empresa e equipe vinculadas", () => {
  assert.deepEqual(criarContextoCorporativo({ vinculos, teamId: "EQ-A" }), {
    tenantId: "EMP-1",
    tenantNome: "Empresa 1",
    teamId: "EQ-A",
    perfilId: "gestor",
  });
  assert.throws(() => validarSelecaoEmpresa(vinculos, "EMP-2"), /não possui vínculo ativo/);
  assert.throws(() => validarSelecaoEmpresa(vinculos, "EMP-1", "EQ-C"), /não pertence/);
});
test("registros recebem proprietário e nunca atravessam empresas", () => {
  const contexto = { tenantId: "EMP-1", teamId: "EQ-A" };
  const registro = aplicarPropriedadeCorporativa(
    { id: "ORC-1", nome: "Obra" },
    contexto,
    { criadoPor: "USR-1", agora: "2026-07-30T12:00:00.000Z" },
  );
  assert.equal(registro.tenantId, "EMP-1");
  assert.equal(registro.teamId, "EQ-A");
  assert.equal(validarIsolamentoRegistro(registro, contexto).permitido, true);
  assert.equal(
    validarIsolamentoRegistro(registro, { tenantId: "EMP-2", teamId: "EQ-A" }).permitido,
    false,
  );
});

test("chave do armazenamento fica segregada pela empresa", () => {
  assert.equal(
    criarChaveObjetoCorporativo(
      { tenantId: "EMP-1" },
      "Bases de preços",
      "SINAPI 06/2026.zip",
    ),
    "tenants/EMP-1/bases-de-pre-os/SINAPI-06-2026.zip",
  );
});
