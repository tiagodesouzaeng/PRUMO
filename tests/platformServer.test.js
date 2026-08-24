import test from "node:test";
import assert from "node:assert/strict";
import {
  MODULOS_PLATAFORMA,
  obterModulosPermitidos,
  obterPermissoesPerfil,
} from "../server/domain/platform.js";

test("catálogo corporativo mantém todos os módulos previstos no PRUMO", () => {
  const ids = new Set(MODULOS_PLATAFORMA.map((item) => item.id));
  [
    "obras",
    "orcamentos",
    "suprimentos",
    "contratos",
    "medicoes",
    "manutencao",
    "utilidades",
    "documentos",
    "relatorios",
    "administracao",
  ].forEach((id) => assert.equal(ids.has(id), true, `Módulo ausente: ${id}`));
  assert.equal(ids.has("bases-precos"), false);
  assert.equal(ids.has("ppci"), false);
});

test("módulos visíveis são derivados das permissões do perfil", () => {
  const fiscal = obterPermissoesPerfil("fiscal");
  const modulos = obterModulosPermitidos(fiscal).map((item) => item.id);
  assert.equal(modulos.includes("medicoes"), true);
  assert.equal(modulos.includes("documentos"), true);
  assert.equal(modulos.includes("bases-precos"), false);
  assert.equal(obterPermissoesPerfil("administrador").length > fiscal.length, true);
});
