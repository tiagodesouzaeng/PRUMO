const API_TIMEOUT_MS = 8000;

function lerVariavel(nome, ambiente = import.meta.env || {}) {
  return String(ambiente[nome] || "").trim();
}

export function obterConfiguracaoInfraestrutura(ambiente = import.meta.env || {}) {
  const apiUrl = lerVariavel("VITE_PRUMO_API_URL", ambiente).replace(/\/+$/, "");
  const autenticacaoUrl = lerVariavel("VITE_PRUMO_AUTH_URL", ambiente).replace(/\/+$/, "");

  return {
    modo: apiUrl ? "corporativo" : "local",
    apiUrl,
    autenticacaoUrl,
    apiConfigurada: Boolean(apiUrl),
    autenticacaoConfigurada: Boolean(autenticacaoUrl),
    timeoutMs: API_TIMEOUT_MS,
  };
}

export function obterContextoDesenvolvimento(ambiente = import.meta.env || {}) {
  const tenantId = lerVariavel("VITE_PRUMO_TENANT_ID", ambiente);
  const teamId = lerVariavel("VITE_PRUMO_TEAM_ID", ambiente);
  const devUser = lerVariavel("VITE_PRUMO_DEV_USER", ambiente);
  if (!tenantId || !devUser) return null;
  return {
    tenantId,
    teamId,
    devUser,
    usuarioId: devUser,
  };
}

export function diagnosticarInfraestrutura(configuracao = obterConfiguracaoInfraestrutura()) {
  return [
    {
      id: "api",
      titulo: "API corporativa",
      status: configuracao.apiConfigurada ? "Configurada" : "Aguardando configuração",
      detalhe: configuracao.apiConfigurada
        ? configuracao.apiUrl
        : "Defina VITE_PRUMO_API_URL para conectar o servidor do PRUMO.",
    },
    {
      id: "autenticacao",
      titulo: "Autenticação",
      status: configuracao.autenticacaoConfigurada ? "Configurada" : "Aguardando backend",
      detalhe: configuracao.autenticacaoConfigurada
        ? configuracao.autenticacaoUrl
        : "Nenhuma credencial ou senha é armazenada no frontend.",
    },
    {
      id: "orcamentos",
      titulo: "Orçamentos e revisões",
      status: configuracao.apiConfigurada ? "Migração pendente" : "Persistência local",
      detalhe: "Dados atuais preservados no navegador até a migração assistida.",
    },
    {
      id: "bases",
      titulo: "Bases de preços",
      status: configuracao.apiConfigurada ? "Migração pendente" : "IndexedDB local",
      detalhe: "Catálogos, composições analíticas e arquivos-fonte precisam de armazenamento corporativo.",
    },
    {
      id: "auditoria",
      titulo: "Auditoria",
      status: "Estrutura preparada",
      detalhe: "A trilha imutável será ativada quando identidade e API estiverem disponíveis.",
    },
    {
      id: "multiempresa",
      titulo: "Isolamento multiempresa",
      status: "Contrato preparado",
      detalhe: "Empresa, equipe e propriedade dos registros definidos para validação obrigatória no backend e no banco.",
    },
  ];
}

export function criarClientePrumo({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = API_TIMEOUT_MS,
  obterContexto = () => null,
} = {}) {
  const urlNormalizada = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!urlNormalizada) throw new Error("A URL da API corporativa não foi configurada.");
  if (typeof fetchImpl !== "function") throw new Error("O ambiente não oferece um cliente HTTP.");

  async function requisitar(caminho, opcoes = {}) {
    const contexto = obterContexto?.() || null;
    const {
      exigirEmpresa = caminho !== "health",
      idempotencyKey = "",
      versao = "",
      ...opcoesFetch
    } = opcoes;
    if (exigirEmpresa && !contexto?.tenantId) {
      throw new Error("Selecione uma empresa ativa antes de acessar dados corporativos.");
    }
    const controlador = new AbortController();
    const temporizador = globalThis.setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const resposta = await fetchImpl(`${urlNormalizada}/${String(caminho).replace(/^\/+/, "")}`, {
        ...opcoesFetch,
        headers: {
          Accept: "application/json",
          ...(opcoesFetch.body ? { "Content-Type": "application/json" } : {}),
          ...(contexto?.accessToken ? { Authorization: `Bearer ${contexto.accessToken}` } : {}),
          ...(contexto?.devUser ? { "X-Prumo-Dev-User": contexto.devUser } : {}),
          ...(contexto?.tenantId ? { "X-Prumo-Tenant-Id": contexto.tenantId } : {}),
          ...(contexto?.teamId ? { "X-Prumo-Team-Id": contexto.teamId } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          ...(versao ? { "If-Match": String(versao) } : {}),
          ...(opcoesFetch.headers || {}),
        },
        signal: controlador.signal,
      });
      if (!resposta.ok) {
        if (resposta.status === 409 || resposta.status === 412) {
          throw new Error("O registro foi alterado por outro usuário. Atualize os dados antes de tentar novamente.");
        }
        throw new Error(`A API do PRUMO respondeu com o código ${resposta.status}.`);
      }
      return resposta.status === 204 ? null : resposta.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("A API do PRUMO não respondeu dentro do prazo.");
      }
      throw error;
    } finally {
      globalThis.clearTimeout(temporizador);
    }
  }

  return {
    verificarSaude: () => requisitar("health"),
    obterContextoCorporativo: () => requisitar("v1/context"),
    listarModulos: () => requisitar("v1/modules"),
    listarEmpreendimentos: () => requisitar("v1/empreendimentos"),
    criarEmpreendimento: (dados, idempotencyKey) => requisitar("v1/empreendimentos", {
      method: "POST",
      body: JSON.stringify(dados),
      idempotencyKey,
    }),
    listarRevisoes: (orcamentoId) => requisitar(
      `v1/orcamentos/${encodeURIComponent(orcamentoId)}/revisoes`,
    ),
    criarRevisao: (orcamentoId, dados, idempotencyKey) => requisitar(
      `v1/orcamentos/${encodeURIComponent(orcamentoId)}/revisoes`,
      {
        method: "POST",
        body: JSON.stringify(dados),
        idempotencyKey,
      },
    ),
    listarMedicoes: (orcamentoId) => requisitar(
      `v1/orcamentos/${encodeURIComponent(orcamentoId)}/medicoes`,
    ),
    criarMedicao: (orcamentoId, dados, idempotencyKey) => requisitar(
      `v1/orcamentos/${encodeURIComponent(orcamentoId)}/medicoes`,
      {
        method: "POST",
        body: JSON.stringify(dados),
        idempotencyKey,
      },
    ),
    listarPublicacoesCatalogo: (filtros = {}) => requisitar(
      `v1/catalogo/publicacoes?${new URLSearchParams(filtros)}`,
    ),
    criarPublicacaoCatalogo: (dados, idempotencyKey) => requisitar(
      "v1/catalogo/publicacoes",
      {
        method: "POST",
        body: JSON.stringify(dados),
        idempotencyKey,
      },
    ),
    salvarItensCatalogo: (publicacaoId, itens, idempotencyKey) => requisitar(
      `v1/catalogo/publicacoes/${encodeURIComponent(publicacaoId)}/itens`,
      {
        method: "POST",
        body: JSON.stringify({ itens }),
        idempotencyKey,
      },
    ),
    listarItensCatalogo: (publicacaoId, filtros = {}) => requisitar(
      `v1/catalogo/publicacoes/${encodeURIComponent(publicacaoId)}/itens?${new URLSearchParams(filtros)}`,
    ),
    listarComponentesCatalogo: (publicacaoId, codigo, filtros = {}) => requisitar(
      `v1/catalogo/publicacoes/${encodeURIComponent(publicacaoId)}/composicoes/${encodeURIComponent(codigo)}/componentes?${new URLSearchParams(filtros)}`,
    ),
    listarLotesMigracao: () => requisitar("v1/migracoes"),
    receberLoteMigracao: (pacote) => requisitar("v1/migracoes", {
      method: "POST",
      body: JSON.stringify(pacote),
      idempotencyKey: pacote.idempotencyKey,
    }),
    validarLoteMigracao: (loteId) => requisitar(
      `v1/migracoes/${encodeURIComponent(loteId)}/validacao`,
      { method: "POST" },
    ),
    homologarLoteMigracao: (loteId) => requisitar(
      `v1/migracoes/${encodeURIComponent(loteId)}/homologacao`,
      { method: "POST" },
    ),
    listarTrabalhos: (filtros = {}) => requisitar(
      `v1/trabalhos?${new URLSearchParams(filtros)}`,
    ),
    criarTrabalho: (dados, idempotencyKey) => requisitar("v1/trabalhos", {
      method: "POST",
      body: JSON.stringify(dados),
      idempotencyKey,
    }),
    reprocessarTrabalho: (trabalhoId) => requisitar(
      `v1/trabalhos/${encodeURIComponent(trabalhoId)}/reprocessamento`,
      { method: "POST" },
    ),
    listarTransicoesRepositorio: () => requisitar("v1/repositorios/transicoes"),
    alterarTransicaoRepositorio: (dominioId, modo) => requisitar(
      `v1/repositorios/transicoes/${encodeURIComponent(dominioId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ modo }),
      },
    ),
    listar: (recurso) => requisitar(`v1/${recurso}`),
    obter: (recurso, id) => requisitar(`v1/${recurso}/${encodeURIComponent(id)}`),
    salvar: (recurso, dados) => requisitar(`v1/${recurso}`, {
      method: "POST",
      body: JSON.stringify(dados),
    }),
    criar: (recurso, dados, idempotencyKey) => requisitar(`v1/${recurso}`, {
      method: "POST",
      body: JSON.stringify(dados),
      idempotencyKey,
    }),
    atualizar: (recurso, id, dados, versao) => requisitar(
      `v1/${recurso}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(dados),
        versao,
      },
    ),
    remover: (recurso, id, versao) => requisitar(
      `v1/${recurso}/${encodeURIComponent(id)}`,
      { method: "DELETE", versao },
    ),
  };
}

export async function verificarInfraestrutura(configuracao = obterConfiguracaoInfraestrutura()) {
  if (!configuracao.apiConfigurada) {
    return {
      ok: true,
      modo: "local",
      mensagem: "Modo local ativo. A API corporativa ainda não foi configurada.",
    };
  }

  const inicio = Date.now();
  try {
    const resposta = await criarClientePrumo({
      baseUrl: configuracao.apiUrl,
      timeoutMs: configuracao.timeoutMs,
    }).verificarSaude();
    return {
      ok: true,
      modo: "corporativo",
      latenciaMs: Date.now() - inicio,
      versao: resposta?.versao || "",
      armazenamento: resposta?.armazenamento || "",
      banco: resposta?.banco?.banco || "",
      mensagem: resposta?.mensagem || (
        resposta?.armazenamento
          ? `API corporativa disponível · ${resposta.armazenamento}.`
          : "API corporativa disponível."
      ),
    };
  } catch (error) {
    return {
      ok: false,
      modo: "corporativo",
      latenciaMs: Date.now() - inicio,
      mensagem: error.message,
    };
  }
}
