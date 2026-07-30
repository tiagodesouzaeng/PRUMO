import test from "node:test";
import assert from "node:assert/strict";
import {
  criarAutenticadorDesenvolvimento,
  criarAutenticadorOidc,
} from "../server/auth/oidc.js";

test("autenticador recusa rotas protegidas enquanto OIDC não estiver configurado", async () => {
  const autenticar = criarAutenticadorOidc({});
  await assert.rejects(
    autenticar({ headers: {} }),
    (error) => error.statusCode === 503 && error.code === "AUTENTICACAO_NAO_CONFIGURADA",
  );
});
test("identidade de desenvolvimento exige cabeçalho explícito", async () => {
  const autenticar = criarAutenticadorDesenvolvimento();
  await assert.rejects(
    autenticar({ headers: {} }),
    (error) => error.statusCode === 401,
  );
  assert.deepEqual(
    await autenticar({ headers: { "x-prumo-dev-user": "dev-user" } }),
    { subject: "dev-user", nome: "dev-user", email: "" },
  );
});
