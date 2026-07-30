import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "../errors.js";

function tokenBearer(cabecalho = "") {
  const correspondencia = String(cabecalho).match(/^Bearer\s+(.+)$/i);
  return correspondencia?.[1] || "";
}
export function criarAutenticadorOidc({ issuer, audience, jwksUrl } = {}) {
  if (!issuer || !audience || !jwksUrl) {
    return async () => {
      throw new ApiError(
        503,
        "AUTENTICACAO_NAO_CONFIGURADA",
        "O provedor corporativo de identidade ainda não foi configurado.",
      );
    };
  }
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  return async (request) => {
    const token = tokenBearer(request.headers.authorization);
    if (!token) {
      throw new ApiError(401, "TOKEN_AUSENTE", "Informe um token de acesso válido.");
    }
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience });
      if (!payload.sub) throw new Error("Token sem subject.");
      return {
        subject: payload.sub,
        nome: String(payload.name || ""),
        email: String(payload.email || ""),
      };
    } catch {
      throw new ApiError(401, "TOKEN_INVALIDO", "O token de acesso é inválido ou expirou.");
    }
  };
}

export function criarAutenticadorDesenvolvimento() {
  return async (request) => {
    const subject = String(request.headers["x-prumo-dev-user"] || "").trim();
    if (!subject) {
      throw new ApiError(
        401,
        "IDENTIDADE_DESENVOLVIMENTO_AUSENTE",
        "Informe X-Prumo-Dev-User no ambiente local.",
      );
    }
    return { subject, nome: subject, email: "" };
  };
}
