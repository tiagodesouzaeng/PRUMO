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
      status: configuracao.apiConfigurada ? "Transição assistida" : "Persistência local",
      detalhe: "API e PostgreSQL disponíveis; dados locais permanecem preservados até a homologação de cada lote.",
    },
    {
      id: "bases",
      titulo: "Bases de preços",
      status: configuracao.apiConfigurada ? "Catálogo corporativo disponível" : "IndexedDB local",
      detalhe: "PostgreSQL disponível com migração assistida; o IndexedDB permanece como origem temporária homologável.",
    },
    {
      id: "auditoria",
      titulo: "Auditoria",
      status: configuracao.apiConfigurada ? "Ativa" : "Estrutura preparada",
      detalhe: configuracao.apiConfigurada ? "Trilha imutável, exportação, retenção e recuperação registradas." : "A trilha será ativada quando identidade e API estiverem disponíveis.",
    },
    {
      id: "multiempresa",
      titulo: "Isolamento multiempresa",
      status: configuracao.apiConfigurada ? "Validado" : "Contrato preparado",
      detalhe: configuracao.apiConfigurada ? "RLS real e tentativas de invasão entre empresas e equipes validadas." : "Empresa, equipe e propriedade dos registros preparados para validação no backend.",
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
      tipoResposta = "json",
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
        const corpo = typeof resposta.json === "function"
          ? await resposta.json().catch(() => null)
          : null;
        throw new Error(corpo?.erro?.mensagem || `A API do PRUMO respondeu com o código ${resposta.status}.`);
      }
      if (resposta.status === 204) return null;
      return tipoResposta === "text" ? resposta.text() : resposta.json();
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
    listarUnidadesPatrimoniais: (filtros = {}) => requisitar(
      `v1/patrimonio/unidades?${new URLSearchParams(filtros)}`,
    ),
    obterUnidadePatrimonial: (id) => requisitar(`v1/patrimonio/unidades/${encodeURIComponent(id)}`),
    criarUnidadePatrimonial: (dados, idempotencyKey) => requisitar("v1/patrimonio/unidades", {
      method: "POST", body: JSON.stringify(dados), idempotencyKey,
    }),
    atualizarUnidadePatrimonial: (id, dados, versao) => requisitar(
      `v1/patrimonio/unidades/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(dados), versao },
    ),
    excluirUnidadePatrimonial: (id, versao) => requisitar(
      `v1/patrimonio/unidades/${encodeURIComponent(id)}`,
      { method: "DELETE", versao },
    ),
    listarAtivosPatrimoniais: (filtros = {}) => requisitar(
      `v1/patrimonio/ativos?${new URLSearchParams(filtros)}`,
    ),
    criarAtivoPatrimonial: (dados, idempotencyKey) => requisitar("v1/patrimonio/ativos", {
      method: "POST", body: JSON.stringify(dados), idempotencyKey,
    }),
    atualizarAtivoPatrimonial: (id, dados, versao) => requisitar(
      `v1/patrimonio/ativos/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(dados), versao },
    ),
    listarMovimentacoesPatrimoniais: (id) => requisitar(
      `v1/patrimonio/ativos/${encodeURIComponent(id)}/movimentacoes`,
    ),
    movimentarAtivoPatrimonial: (id, dados, idempotencyKey) => requisitar(
      `v1/patrimonio/ativos/${encodeURIComponent(id)}/movimentacoes`,
      { method: "POST", body: JSON.stringify(dados), idempotencyKey },
    ),
    listarProgramasInvestimento: () => requisitar("v1/planejamento/programas"),
    criarProgramaInvestimento: (dados, idempotencyKey) => requisitar("v1/planejamento/programas", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarProgramaInvestimento: (id, dados, versao) => requisitar(`v1/planejamento/programas/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    listarCarteirasInvestimento: () => requisitar("v1/planejamento/carteiras"),
    criarCarteiraInvestimento: (dados, idempotencyKey) => requisitar("v1/planejamento/carteiras", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarCarteiraInvestimento: (id, dados, versao) => requisitar(`v1/planejamento/carteiras/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    incorporarDemandaCarteira: (carteiraId, dados, versao, idempotencyKey) => requisitar(`v1/planejamento/carteiras/${encodeURIComponent(carteiraId)}/demandas`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    listarDemandasInvestimento: (filtros = {}) => requisitar(`v1/planejamento/demandas?${new URLSearchParams(filtros)}`),
    obterDemandaInvestimento: (id) => requisitar(`v1/planejamento/demandas/${encodeURIComponent(id)}`),
    criarDemandaInvestimento: (dados, idempotencyKey) => requisitar("v1/planejamento/demandas", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarDemandaInvestimento: (id, dados, versao) => requisitar(`v1/planejamento/demandas/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    listarDecisoesDemanda: (id) => requisitar(`v1/planejamento/demandas/${encodeURIComponent(id)}/decisoes`),
    decidirDemandaInvestimento: (id, dados, versao, idempotencyKey) => requisitar(`v1/planejamento/demandas/${encodeURIComponent(id)}/decisoes`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    listarFornecedores: (filtros = {}) => requisitar(`v1/suprimentos/fornecedores?${new URLSearchParams(filtros)}`),
    criarFornecedor: (dados, idempotencyKey) => requisitar("v1/suprimentos/fornecedores", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarFornecedor: (id, dados, versao) => requisitar(`v1/suprimentos/fornecedores/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    listarProcessosContratacao: (filtros = {}) => requisitar(`v1/suprimentos/processos?${new URLSearchParams(filtros)}`),
    obterProcessoContratacao: (id) => requisitar(`v1/suprimentos/processos/${encodeURIComponent(id)}`),
    criarProcessoContratacao: (dados, idempotencyKey) => requisitar("v1/suprimentos/processos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarProcessoContratacao: (id, dados, versao) => requisitar(`v1/suprimentos/processos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    registrarCotacao: (id, dados, idempotencyKey) => requisitar(`v1/suprimentos/processos/${encodeURIComponent(id)}/cotacoes`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    decidirProcessoContratacao: (id, dados, versao, idempotencyKey) => requisitar(`v1/suprimentos/processos/${encodeURIComponent(id)}/decisoes`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    emitirPedidoCompra: (id, dados, versao, idempotencyKey) => requisitar(`v1/suprimentos/processos/${encodeURIComponent(id)}/pedidos`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    listarPedidosCompra: (filtros = {}) => requisitar(`v1/suprimentos/pedidos?${new URLSearchParams(filtros)}`),
    registrarRecebimentoPedido: (id, dados, idempotencyKey) => requisitar(`v1/suprimentos/pedidos/${encodeURIComponent(id)}/recebimentos`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    listarContratos: (filtros = {}) => requisitar(`v1/contratos?${new URLSearchParams(filtros)}`),
    obterContrato: (id) => requisitar(`v1/contratos/${encodeURIComponent(id)}`),
    criarContrato: (dados, idempotencyKey) => requisitar("v1/contratos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    atualizarContrato: (id, dados, versao) => requisitar(`v1/contratos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados), versao }),
    decidirContrato: (id, dados, versao, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/decisoes`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    adicionarResponsavelContrato: (id, dados, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/responsaveis`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    registrarAditivoContrato: (id, dados, versao, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/aditivos`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    registrarGarantiaContrato: (id, dados, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/garantias`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    registrarOcorrenciaContrato: (id, dados, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/ocorrencias`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    aplicarSancaoContrato: (id, dados, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/sancoes`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    registrarExecucaoContrato: (id, dados, idempotencyKey) => requisitar(`v1/contratos/${encodeURIComponent(id)}/execucoes`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
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
    listarAuditoria: (filtros = {}) => requisitar(
      `v1/auditoria?${new URLSearchParams(filtros)}`,
    ),
    exportarAuditoria: (filtros = {}) => requisitar(
      `v1/auditoria/exportacao.csv?${new URLSearchParams(filtros)}`,
      { tipoResposta: "text" },
    ),
    obterPoliticaAuditoria: () => requisitar("v1/auditoria/politica"),
    atualizarPoliticaAuditoria: (dados) => requisitar("v1/auditoria/politica", {
      method: "PUT",
      body: JSON.stringify(dados),
    }),
    listarDocumentos: () => requisitar("v1/documentos"),
    criarDocumento: (dados, idempotencyKey) => requisitar("v1/documentos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    adicionarVersaoDocumento: (id, dados) => requisitar(`v1/documentos/${encodeURIComponent(id)}/versoes`, { method: "POST", body: JSON.stringify(dados) }),
    vincularDocumento: (id, dados) => requisitar(`v1/documentos/${encodeURIComponent(id)}/vinculos`, { method: "POST", body: JSON.stringify(dados) }),
    listarIntegracoes: () => requisitar("v1/integracoes"),
    criarIntegracao: (dados, idempotencyKey) => requisitar("v1/integracoes", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    registrarExecucaoIntegracao: (id, dados) => requisitar(`v1/integracoes/${encodeURIComponent(id)}/execucoes`, { method: "POST", body: JSON.stringify(dados) }),
    obterProdutoModular: () => requisitar("v1/produto-modular"),
    atualizarPerfilProduto: (dados) => requisitar("v1/produto-modular/perfil", { method: "PUT", body: JSON.stringify(dados) }),
    atualizarContratoModulo: (id, dados) => requisitar(`v1/produto-modular/modulos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(dados) }),
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
