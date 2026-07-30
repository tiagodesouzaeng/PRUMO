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
    permitirIdentidadeDesenvolvimento:
      nodeEnv !== "production"
      && texto(ambiente, "PRUMO_DEV_IDENTITY", "false") === "true",
  };

  if (!["memory", "postgres"].includes(armazenamento)) {
    throw new Error("PRUMO_API_STORAGE deve ser memory ou postgres.");
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
  return configuracao;
}
