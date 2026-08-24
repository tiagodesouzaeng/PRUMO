function texto(ambiente, nome, padrao = "") {
  return String(ambiente[nome] || padrao).trim();
}
function inteiro(ambiente, nome, padrao) {
  const valor = Number(texto(ambiente, nome, padrao));
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${nome} deve ser um número inteiro positivo.`);
  }
  return valor;
}
function urlSegura(valor) {
  try { return new URL(valor).protocol === "https:"; }
  catch { return false; }
}

export function carregarConfiguracaoServidor(ambiente = process.env) {
  const nodeEnv = texto(ambiente, "NODE_ENV", "development");
  const armazenamento = texto(
    ambiente,
    "PRUMO_API_STORAGE",
    nodeEnv === "test" ? "memory" : "postgres",
  ).toLowerCase();
  const configuracao = {
    nodeEnv,
    host: texto(ambiente, "PRUMO_API_HOST", "127.0.0.1"),
    port: inteiro(ambiente, "PRUMO_API_PORT", "8787"),
    logLevel: texto(ambiente, "PRUMO_API_LOG_LEVEL", "info"),
    corsOrigins: texto(ambiente, "PRUMO_CORS_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    armazenamento,
    databaseUrl: texto(ambiente, "PRUMO_DATABASE_URL"),
    databaseSsl: texto(ambiente, "PRUMO_DATABASE_SSL", "false") === "true",
    oidcIssuer: texto(ambiente, "PRUMO_OIDC_ISSUER"),
    oidcAudience: texto(ambiente, "PRUMO_OIDC_AUDIENCE"),
    oidcJwksUrl: texto(ambiente, "PRUMO_OIDC_JWKS_URL"),
    localAdminEnabled: texto(ambiente, "PRUMO_LOCAL_ADMIN_ENABLED", "false") === "true",
    localAdminUser: texto(ambiente, "PRUMO_LOCAL_ADMIN_USER", "admin"),
    localAdminSubject: texto(ambiente, "PRUMO_LOCAL_ADMIN_SUBJECT", "local-admin"),
    localAdminPasswordHash: texto(ambiente, "PRUMO_LOCAL_ADMIN_PASSWORD_HASH"),
    localAdminPasswordSalt: texto(ambiente, "PRUMO_LOCAL_ADMIN_PASSWORD_SALT"),
    localAdminSessionSecret: texto(ambiente, "PRUMO_LOCAL_ADMIN_SESSION_SECRET"),
    localAdminSessionMinutes: inteiro(ambiente, "PRUMO_LOCAL_ADMIN_SESSION_MINUTES", "30"),
    storageProvider: texto(ambiente, "PRUMO_OBJECT_STORAGE_PROVIDER", "disabled").toLowerCase(),
    storageRegion: texto(ambiente, "PRUMO_OBJECT_STORAGE_REGION"),
    storageBucket: texto(ambiente, "PRUMO_OBJECT_STORAGE_BUCKET"),
    storageEndpoint: texto(ambiente, "PRUMO_OBJECT_STORAGE_ENDPOINT"),
    storageForcePathStyle: texto(ambiente, "PRUMO_OBJECT_STORAGE_FORCE_PATH_STYLE", "false") === "true",
    storageAccessKeyId: texto(ambiente, "PRUMO_OBJECT_STORAGE_ACCESS_KEY_ID"),
    storageSecretAccessKey: texto(ambiente, "PRUMO_OBJECT_STORAGE_SECRET_ACCESS_KEY"),
    storageSessionToken: texto(ambiente, "PRUMO_OBJECT_STORAGE_SESSION_TOKEN"),
    storageSignedUrlTtl: inteiro(ambiente, "PRUMO_OBJECT_STORAGE_SIGNED_URL_TTL", "300"),
    permitirIdentidadeDesenvolvimento:
      nodeEnv !== "production"
      && texto(ambiente, "PRUMO_DEV_IDENTITY", "false") === "true",
  };

  if (!["memory", "postgres"].includes(armazenamento)) {
    throw new Error("PRUMO_API_STORAGE deve ser memory ou postgres.");
  }
  if (!["disabled", "s3"].includes(configuracao.storageProvider)) {
    throw new Error("PRUMO_OBJECT_STORAGE_PROVIDER deve ser disabled ou s3.");
  }
  if (configuracao.storageProvider === "s3" && (
    !configuracao.storageRegion
    || !configuracao.storageBucket
  )) {
    throw new Error("O storage S3 exige região e bucket.");
  }
  if (nodeEnv === "production" && armazenamento !== "postgres") {
    throw new Error("O modo de produção exige armazenamento PostgreSQL.");
  }
  if (armazenamento === "postgres" && !configuracao.databaseUrl) {
    throw new Error("PRUMO_DATABASE_URL é obrigatória no modo PostgreSQL.");
  }
  if (nodeEnv === "production" && (
    !configuracao.oidcIssuer
    || !configuracao.oidcAudience
    || !configuracao.oidcJwksUrl
  )) {
    throw new Error("O modo de produção exige OIDC issuer, audience e JWKS URL.");
  }
  if (configuracao.localAdminEnabled && (
    !configuracao.localAdminPasswordHash
    || !configuracao.localAdminPasswordSalt
    || !configuracao.localAdminSessionSecret
  )) {
    throw new Error("A conta administrativa local exige hash, salt e segredo de sessão.");
  }
  if (nodeEnv === "production" && configuracao.storageProvider !== "s3") {
    throw new Error("O modo de produção exige storage GED S3 compatível.");
  }
  if (nodeEnv === "production" && !configuracao.corsOrigins.length) {
    throw new Error("O modo de produção exige ao menos uma origem CORS explícita.");
  }
  if (nodeEnv === "production" && configuracao.corsOrigins.some((origem) => !urlSegura(origem))) {
    throw new Error("As origens CORS de produção devem usar HTTPS.");
  }
  if (nodeEnv === "production" && (!urlSegura(configuracao.oidcIssuer) || !urlSegura(configuracao.oidcJwksUrl))) {
    throw new Error("OIDC issuer e JWKS devem usar HTTPS em produção.");
  }
  if (nodeEnv === "production" && configuracao.storageEndpoint && !urlSegura(configuracao.storageEndpoint)) {
    throw new Error("O endpoint do storage deve usar HTTPS em produção.");
  }
  if (nodeEnv === "production" && configuracao.storageSignedUrlTtl > 900) {
    throw new Error("URLs temporárias do GED não podem exceder 900 segundos em produção.");
  }
  return configuracao;
}
