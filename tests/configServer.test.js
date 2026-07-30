import test from "node:test";
import assert from "node:assert/strict";
import { carregarConfiguracaoServidor } from "../server/config.js";

test("configuração local admite memória somente fora de produção", () => {
  const configuracao = carregarConfiguracaoServidor({
    NODE_ENV: "development",
    PRUMO_API_STORAGE: "memory",
    PRUMO_DEV_IDENTITY: "true",
  });
  assert.equal(configuracao.armazenamento, "memory");
  assert.equal(configuracao.permitirIdentidadeDesenvolvimento, true);
  assert.equal(configuracao.port, 8787);
});

test("produção exige PostgreSQL e provedor OIDC", () => {
  assert.throws(
    () => carregarConfiguracaoServidor({
      NODE_ENV: "production",
      PRUMO_API_STORAGE: "memory",
    }),
    /exige armazenamento PostgreSQL/,
  );
  assert.throws(
    () => carregarConfiguracaoServidor({
      NODE_ENV: "production",
      PRUMO_API_STORAGE: "postgres",
      PRUMO_DATABASE_URL: "postgresql://localhost/prumo",
    }),
    /exige OIDC/,
  );
  const configuracao = carregarConfiguracaoServidor({
    NODE_ENV: "production",
    PRUMO_API_STORAGE: "postgres",
    PRUMO_DATABASE_URL: "postgresql://localhost/prumo",
    PRUMO_OIDC_ISSUER: "https://id.example.test",
    PRUMO_OIDC_AUDIENCE: "prumo-api",
    PRUMO_OIDC_JWKS_URL: "https://id.example.test/.well-known/jwks.json",
  });
  assert.equal(configuracao.armazenamento, "postgres");
  assert.equal(configuracao.permitirIdentidadeDesenvolvimento, false);
});
