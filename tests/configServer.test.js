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
  assert.throws(
    () => carregarConfiguracaoServidor({
      NODE_ENV: "production",
      PRUMO_API_STORAGE: "postgres",
      PRUMO_DATABASE_URL: "postgresql://localhost/prumo",
      PRUMO_OIDC_ISSUER: "https://id.example.test",
      PRUMO_OIDC_AUDIENCE: "prumo-api",
      PRUMO_OIDC_JWKS_URL: "https://id.example.test/.well-known/jwks.json",
    }),
    /exige storage GED/,
  );
  const configuracao = carregarConfiguracaoServidor({
    NODE_ENV: "production",
    PRUMO_API_STORAGE: "postgres",
    PRUMO_DATABASE_URL: "postgresql://localhost/prumo",
    PRUMO_OIDC_ISSUER: "https://id.example.test",
    PRUMO_OIDC_AUDIENCE: "prumo-api",
    PRUMO_OIDC_JWKS_URL: "https://id.example.test/.well-known/jwks.json",
    PRUMO_OBJECT_STORAGE_PROVIDER: "s3",
    PRUMO_OBJECT_STORAGE_REGION: "sa-east-1",
    PRUMO_OBJECT_STORAGE_BUCKET: "prumo-documentos",
    PRUMO_CORS_ORIGINS: "https://prumo.example.test",
  });
  assert.equal(configuracao.armazenamento, "postgres");
  assert.equal(configuracao.permitirIdentidadeDesenvolvimento, false);
  assert.equal(configuracao.storageProvider, "s3");
});

test("produção recusa origens, identidade e storage sem HTTPS", () => {
  const base = {
    NODE_ENV: "production",
    PRUMO_API_STORAGE: "postgres",
    PRUMO_DATABASE_URL: "postgres://local/teste",
    PRUMO_OIDC_ISSUER: "https://id.example.test",
    PRUMO_OIDC_AUDIENCE: "prumo",
    PRUMO_OIDC_JWKS_URL: "https://id.example.test/jwks",
    PRUMO_OBJECT_STORAGE_PROVIDER: "s3",
    PRUMO_OBJECT_STORAGE_REGION: "sa-east-1",
    PRUMO_OBJECT_STORAGE_BUCKET: "prumo",
    PRUMO_CORS_ORIGINS: "http://inseguro.example.test",
  };
  assert.throws(() => carregarConfiguracaoServidor(base), /CORS.*HTTPS/);
  assert.throws(() => carregarConfiguracaoServidor({ ...base, PRUMO_CORS_ORIGINS: "https://app.example.test", PRUMO_OIDC_ISSUER: "http://id.example.test" }), /OIDC.*HTTPS/);
  assert.throws(() => carregarConfiguracaoServidor({ ...base, PRUMO_CORS_ORIGINS: "https://app.example.test", PRUMO_OBJECT_STORAGE_ENDPOINT: "http://storage.example.test" }), /storage.*HTTPS/);
});
