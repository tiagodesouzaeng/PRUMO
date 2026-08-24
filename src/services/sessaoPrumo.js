const CHAVE_SESSAO = "prumo:sessao";

function ler(nome, ambiente = import.meta.env || {}) {
  return String(ambiente[nome] || "").trim();
}

export function obterConfiguracaoAcesso(ambiente = import.meta.env || {}) {
  const apiUrl = ler("VITE_PRUMO_API_URL", ambiente).replace(/\/+$/, "");
  const authUrl = ler("VITE_PRUMO_AUTH_URL", ambiente).replace(/\/+$/, "");
  const producao = ambiente.PROD === true || ambiente.MODE === "production";
  return {
    apiUrl,
    authUrl,
    autenticacaoObrigatoria: producao || ler("VITE_PRUMO_REQUIRE_AUTH", ambiente) === "true",
    loginCorporativoConfigurado: Boolean(authUrl),
  };
}

export function carregarSessao() {
  try {
    const sessao = JSON.parse(globalThis.sessionStorage?.getItem(CHAVE_SESSAO) || "null");
    if (sessao?.expiresAt && Number(sessao.expiresAt) <= Date.now()) {
      limparSessao();
      return null;
    }
    return sessao?.accessToken && sessao?.usuario?.subject ? sessao : null;
  } catch { return null; }
}

export function salvarSessao(sessao) {
  const normalizada = {
    ...sessao,
    expiresAt: sessao?.expiresAt || (sessao?.expiresIn ? Date.now() + Number(sessao.expiresIn) * 1000 : null),
  };
  globalThis.sessionStorage?.setItem(CHAVE_SESSAO, JSON.stringify(normalizada));
  return normalizada;
}

export function limparSessao() {
  globalThis.sessionStorage?.removeItem(CHAVE_SESSAO);
}

async function lerErro(resposta) {
  const corpo = await resposta.json().catch(() => null);
  return corpo?.erro?.mensagem || "Não foi possível autenticar no PRUMO.";
}

export async function obterCapacidadesAcesso(apiUrl) {
  const resposta = await fetch(`${apiUrl}/auth/capabilities`, { headers: { Accept: "application/json" } });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return resposta.json();
}

export async function entrarComContaLocal(apiUrl, usuario, senha) {
  const resposta = await fetch(`${apiUrl}/auth/local/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha }),
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return salvarSessao(await resposta.json());
}

export async function encerrarSessaoLocal(apiUrl, sessao) {
  try {
    await fetch(`${apiUrl}/auth/local/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessao?.accessToken || ""}` },
    });
  } finally { limparSessao(); }
}

export function iniciarLoginCorporativo(authUrl) {
  if (!authUrl) throw new Error("O provedor corporativo ainda não foi configurado.");
  globalThis.location.assign(authUrl);
}
