const ambiente = process.env;
const verificacoes = [];

function verificar(nome, ok, detalhe) {
  verificacoes.push({ nome, ok: Boolean(ok), detalhe });
}

function definida(nome) {
  return Boolean(String(ambiente[nome] || "").trim());
}

function urlHttps(nome) {
  try {
    return new URL(String(ambiente[nome] || "")).protocol === "https:";
  } catch {
    return false;
  }
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
verificar("Node.js", nodeMajor >= 20, nodeMajor >= 20 ? "compatível" : "requer versão 20 ou superior");
verificar("Modo de execução", ambiente.NODE_ENV === "production", "NODE_ENV=production");
verificar("PostgreSQL", definida("PRUMO_DATABASE_URL"), "conexão definida sem exibir credenciais");
verificar(
  "OIDC corporativo",
  ["PRUMO_OIDC_ISSUER", "PRUMO_OIDC_AUDIENCE", "PRUMO_OIDC_JWKS_URL"].every(definida)
    && urlHttps("PRUMO_OIDC_ISSUER")
    && urlHttps("PRUMO_OIDC_JWKS_URL"),
  "issuer, audience e JWKS HTTPS",
);
verificar(
  "Storage GED",
  ambiente.PRUMO_OBJECT_STORAGE_PROVIDER === "s3"
    && definida("PRUMO_OBJECT_STORAGE_REGION")
    && definida("PRUMO_OBJECT_STORAGE_BUCKET"),
  "provedor S3 compatível, região e bucket",
);
const origens = String(ambiente.PRUMO_CORS_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
verificar("CORS de produção", origens.length > 0 && origens.every((item) => item.startsWith("https://")), "somente origens HTTPS explícitas");
verificar("API pública do frontend", urlHttps("VITE_PRUMO_API_URL"), "VITE_PRUMO_API_URL deve usar HTTPS");
verificar("Autenticação do frontend", urlHttps("VITE_PRUMO_AUTH_URL"), "VITE_PRUMO_AUTH_URL deve usar HTTPS");

for (const item of verificacoes) {
  console.info(`[${item.ok ? "OK" : "PENDENTE"}] ${item.nome}: ${item.detalhe}`);
}

const pendencias = verificacoes.filter((item) => !item.ok);
console.info(`Resultado: ${verificacoes.length - pendencias.length}/${verificacoes.length} verificações aprovadas.`);
if (pendencias.length) process.exitCode = 1;
