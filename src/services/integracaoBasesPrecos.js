const STORAGE_CONFIG = "prumo-integracoes-bases-v1";
const STORAGE_AUDITORIA = "prumo-integracoes-bases-auditoria-v1";
const EXTENSOES_SUPORTADAS = /\.(zip|xlsx|xls|csv)$/i;

export const INTEGRACOES_PADRAO = [
  {
    id: "sinapi",
    fonte: "SINAPI",
    nome: "SINAPI — CAIXA",
    paginaOficial: "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx",
    urlArquivo: "",
    periodicidade: "Mensal",
    referencia: new Date().toISOString().slice(0, 7),
    uf: "RS",
    regime: "DESONERADO",
    ativa: false,
    modo: "Arquivo oficial por URL",
  },
  {
    id: "pleo",
    fonte: "PLEO",
    nome: "PLEO",
    paginaOficial: "",
    urlArquivo: "",
    periodicidade: "Mensal",
    referencia: new Date().toISOString().slice(0, 7),
    uf: "RS",
    regime: "PADRAO",
    ativa: false,
    modo: "Arquivo tabular por URL",
  },
  {
    id: "sbc",
    fonte: "SBC",
    nome: "SBC",
    paginaOficial: "",
    urlArquivo: "",
    periodicidade: "Mensal",
    referencia: new Date().toISOString().slice(0, 7),
    uf: "GERAL",
    regime: "PADRAO",
    ativa: false,
    modo: "Arquivo tabular por URL",
  },
  {
    id: "orse",
    fonte: "ORSE",
    nome: "ORSE",
    paginaOficial: "",
    urlArquivo: "",
    periodicidade: "Mensal",
    referencia: new Date().toISOString().slice(0, 7),
    uf: "SE",
    regime: "PADRAO",
    ativa: false,
    modo: "Arquivo tabular por URL",
  },
];

function armazenamentoDisponivel() {
  return typeof globalThis.localStorage !== "undefined";
}

export function validarUrlIntegracao(valor) {
  let url;
  try {
    url = new URL(String(valor || "").trim());
  } catch {
    throw new Error("Informe uma URL válida para o arquivo da publicação.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("A integração aceita HTTPS ou endereço local de desenvolvimento.");
  }
  const nome = decodeURIComponent(url.pathname.split("/").pop() || "");
  if (!EXTENSOES_SUPORTADAS.test(nome)) {
    throw new Error("A URL deve apontar diretamente para um arquivo ZIP, XLSX, XLS ou CSV.");
  }
  return url.toString();
}

export function nomeArquivoRemoto(url, contentDisposition = "") {
  const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const simples = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  const caminho = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  return decodeURIComponent(utf8 || simples || caminho || "base-precos.zip");
}

export function carregarIntegracoesBases() {
  if (!armazenamentoDisponivel()) return INTEGRACOES_PADRAO.map((item) => ({ ...item }));
  try {
    const salvas = JSON.parse(globalThis.localStorage.getItem(STORAGE_CONFIG) || "[]");
    return INTEGRACOES_PADRAO.map((padrao) => ({
      ...padrao,
      ...(salvas.find((item) => item.id === padrao.id) || {}),
    }));
  } catch {
    return INTEGRACOES_PADRAO.map((item) => ({ ...item }));
  }
}

export function salvarIntegracoesBases(integracoes) {
  if (armazenamentoDisponivel()) {
    globalThis.localStorage.setItem(STORAGE_CONFIG, JSON.stringify(integracoes));
  }
  return integracoes;
}

export function carregarAuditoriaIntegracoes() {
  if (!armazenamentoDisponivel()) return [];
  try {
    return JSON.parse(globalThis.localStorage.getItem(STORAGE_AUDITORIA) || "[]");
  } catch {
    return [];
  }
}

export function registrarAuditoriaIntegracao(evento) {
  const registro = {
    id: globalThis.crypto?.randomUUID?.() || `sync-${Date.now()}`,
    data: new Date().toISOString(),
    ...evento,
  };
  const auditoria = [registro, ...carregarAuditoriaIntegracoes()].slice(0, 50);
  if (armazenamentoDisponivel()) {
    globalThis.localStorage.setItem(STORAGE_AUDITORIA, JSON.stringify(auditoria));
  }
  return auditoria;
}

export async function baixarArquivoIntegracao(integracao) {
  const url = validarUrlIntegracao(integracao.urlArquivo);
  const resposta = await fetch(url, {
    method: "GET",
    credentials: "omit",
    redirect: "follow",
    cache: "no-store",
  });
  if (!resposta.ok) {
    throw new Error(`A fonte respondeu com o código HTTP ${resposta.status}.`);
  }
  const tamanho = Number(resposta.headers.get("content-length") || 0);
  if (tamanho > 600 * 1024 * 1024) {
    throw new Error("O arquivo excede o limite de segurança de 600 MB.");
  }
  const blob = await resposta.blob();
  if (!blob.size) throw new Error("A fonte retornou um arquivo vazio.");
  const nome = nomeArquivoRemoto(url, resposta.headers.get("content-disposition") || "");
  if (!EXTENSOES_SUPORTADAS.test(nome)) {
    throw new Error("O arquivo recebido não possui formato ZIP, XLSX, XLS ou CSV.");
  }
  return new File([blob], nome, {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
