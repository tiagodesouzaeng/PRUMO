import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, jwtVerify, SignJWT } from "jose";
import { ApiError } from "../errors.js";

const TIPO_TOKEN_LOCAL = "prumo-local+jwt";
const EMISSOR_LOCAL = "prumo:contingencia";

function bufferHex(valor, nome) {
  if (!/^[0-9a-f]+$/i.test(valor || "") || valor.length % 2) {
    throw new Error(`${nome} deve estar codificado em hexadecimal.`);
  }
  return Buffer.from(valor, "hex");
}

export function derivarHashSenhaLocal(senha, saltHex) {
  return scryptSync(String(senha), bufferHex(saltHex, "O salt"), 64).toString("hex");
}

export function criarAutenticacaoLocal({
  habilitada = false,
  usuario = "admin",
  subject = "local-admin",
  passwordHash = "",
  passwordSalt = "",
  sessionSecret = "",
  expiresMinutes = 30,
} = {}) {
  if (!habilitada) return { habilitada: false };
  const hashEsperado = bufferHex(passwordHash, "O hash da senha local");
  if (hashEsperado.length !== 64) throw new Error("O hash da senha local deve possuir 64 bytes.");
  const segredo = Buffer.from(sessionSecret, "base64url");
  if (segredo.length < 32) throw new Error("O segredo da sessão local deve possuir ao menos 32 bytes.");
  bufferHex(passwordSalt, "O salt da senha local");
  const revogados = new Map();

  function limparRevogados() {
    const agora = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of revogados) if (exp <= agora) revogados.delete(jti);
  }

  async function autenticarCredenciais(usuarioInformado, senhaInformada) {
    const usuarioOk = String(usuarioInformado || "") === usuario;
    const calculado = Buffer.from(derivarHashSenhaLocal(senhaInformada || "", passwordSalt), "hex");
    const senhaOk = calculado.length === hashEsperado.length && timingSafeEqual(calculado, hashEsperado);
    if (!usuarioOk || !senhaOk) {
      throw new ApiError(401, "CREDENCIAIS_INVALIDAS", "Usuário ou senha inválidos.");
    }
    const jti = randomUUID();
    const accessToken = await new SignJWT({ nome: "Administrador local", modo: "contingencia" })
      .setProtectedHeader({ alg: "HS256", typ: TIPO_TOKEN_LOCAL })
      .setIssuer(EMISSOR_LOCAL)
      .setAudience("prumo-api")
      .setSubject(subject)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${expiresMinutes}m`)
      .sign(segredo);
    return { accessToken, expiresIn: expiresMinutes * 60, usuario: { subject, nome: "Administrador local", modo: "contingencia" } };
  }

  async function verificarToken(token) {
    try {
      limparRevogados();
      const { payload } = await jwtVerify(token, segredo, { issuer: EMISSOR_LOCAL, audience: "prumo-api" });
      if (!payload.sub || !payload.jti || revogados.has(payload.jti)) throw new Error("Sessão inválida.");
      return { subject: payload.sub, nome: String(payload.nome || "Administrador local"), email: "", modo: "contingencia", jti: payload.jti };
    } catch {
      throw new ApiError(401, "SESSAO_LOCAL_INVALIDA", "A sessão local é inválida ou expirou.");
    }
  }

  async function revogarToken(token) {
    try {
      const { payload } = await jwtVerify(token, segredo, { issuer: EMISSOR_LOCAL, audience: "prumo-api" });
      if (payload.jti) revogados.set(payload.jti, Number(payload.exp) || Math.floor(Date.now() / 1000) + 3600);
    } catch {
      // Encerramento idempotente: tokens inválidos já não concedem acesso.
    }
  }

  function reconheceToken(token) {
    try { return decodeProtectedHeader(token).typ === TIPO_TOKEN_LOCAL; }
    catch { return false; }
  }

  return { habilitada: true, usuario, subject, autenticarCredenciais, verificarToken, revogarToken, reconheceToken };
}

export function extrairTokenBearer(cabecalho = "") {
  return String(cabecalho).match(/^Bearer\s+(.+)$/i)?.[1] || "";
}
