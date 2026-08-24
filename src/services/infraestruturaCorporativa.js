const API_TIMEOUT_MS = 8000;
import { carregarSessao } from "./sessaoPrumo.js";

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
  const sessao = carregarSessao();
  if (!tenantId || (!devUser && !sessao?.accessToken)) return null;
  return {
    tenantId,
    teamId,
    ...(sessao?.accessToken ? { accessToken: sessao.accessToken } : { devUser }),
    usuarioId: sessao?.usuario?.subject || devUser,
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
    verificarProntidaoPublica: () => requisitar("ready", { exigirEmpresa: false }),
    obterContextoCorporativo: () => requisitar("v1/context"),
    listarOrcamentos: () => requisitar("v1/orcamentos"),
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
    listarCentrosCustoFinanceiros: () => requisitar("v1/financeiro/centros-custo"),
    criarCentroCustoFinanceiro: (dados, idempotencyKey) => requisitar("v1/financeiro/centros-custo", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    listarFontesFinanceiras: () => requisitar("v1/financeiro/fontes"),
    criarFonteFinanceira: (dados, idempotencyKey) => requisitar("v1/financeiro/fontes", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    listarOrcamentosFinanceiros: (filtros = {}) => requisitar(`v1/financeiro/orcamentos?${new URLSearchParams(filtros)}`),
    criarOrcamentoFinanceiro: (dados, idempotencyKey) => requisitar("v1/financeiro/orcamentos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    listarCompromissosFinanceiros: (filtros = {}) => requisitar(`v1/financeiro/compromissos?${new URLSearchParams(filtros)}`),
    obterCompromissoFinanceiro: (id) => requisitar(`v1/financeiro/compromissos/${encodeURIComponent(id)}`),
    criarCompromissoFinanceiro: (dados, idempotencyKey) => requisitar("v1/financeiro/compromissos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    registrarMovimentoFinanceiro: (id, dados, versao, idempotencyKey) => requisitar(`v1/financeiro/compromissos/${encodeURIComponent(id)}/movimentos`, { method: "POST", body: JSON.stringify(dados), versao, idempotencyKey }),
    conciliarMovimentoFinanceiro: (id, dados, idempotencyKey) => requisitar(`v1/financeiro/movimentos/${encodeURIComponent(id)}/conciliacoes`, { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    obterResumoFinanceiro: (filtros = {}) => requisitar(`v1/financeiro/resumo?${new URLSearchParams(filtros)}`),
    listarObrasCorporativas: (filtros = {}) => requisitar(`v1/obras?${new URLSearchParams(filtros)}`),
    obterResumoObras: () => requisitar("v1/obras/resumo"),
    obterObraCorporativa: (id) => requisitar(`v1/obras/${encodeURIComponent(id)}`),
    criarObraCorporativa: (dados, idempotencyKey) => requisitar("v1/obras", { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    atualizarObraCorporativa: (id, dados, versao) => requisitar(`v1/obras/${encodeURIComponent(id)}`, { method:"PUT",body:JSON.stringify(dados),versao }),
    decidirObraCorporativa: (id, dados, versao, idempotencyKey) => requisitar(`v1/obras/${encodeURIComponent(id)}/decisoes`, { method:"POST",body:JSON.stringify(dados),versao,idempotencyKey }),
    adicionarItemCronogramaObra: (id, dados, idempotencyKey) => requisitar(`v1/obras/${encodeURIComponent(id)}/cronograma`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    registrarDiarioObra: (id, dados, idempotencyKey) => requisitar(`v1/obras/${encodeURIComponent(id)}/diario`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    listarMedicoesObra: (id) => requisitar(`v1/obras/${encodeURIComponent(id)}/medicoes`),
    criarMedicaoObra: (id, dados, idempotencyKey) => requisitar(`v1/obras/${encodeURIComponent(id)}/medicoes`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    decidirMedicaoObra: (id, dados, versao, idempotencyKey) => requisitar(`v1/medicoes/${encodeURIComponent(id)}/decisoes`, { method:"POST",body:JSON.stringify(dados),versao,idempotencyKey }),
    listarBasesContratadas: (id) => requisitar(`v1/orcamentos/${encodeURIComponent(id)}/bases-contratadas`),
    criarBaseContratada: (id, dados, idempotencyKey) => requisitar(`v1/orcamentos/${encodeURIComponent(id)}/bases-contratadas`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    listarSolicitacoesAditivo: (id) => requisitar(`v1/obras/${encodeURIComponent(id)}/solicitacoes-aditivo`),
    criarSolicitacaoAditivo: (id, dados, idempotencyKey) => requisitar(`v1/obras/${encodeURIComponent(id)}/solicitacoes-aditivo`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    decidirSolicitacaoAditivo: (id, dados, versao, idempotencyKey) => requisitar(`v1/solicitacoes-aditivo/${encodeURIComponent(id)}/decisoes`, { method:"POST",body:JSON.stringify(dados),versao,idempotencyKey }),
    listarPlanosManutencao: (filtros = {}) => requisitar(`v1/manutencao/planos?${new URLSearchParams(filtros)}`),
    criarPlanoManutencao: (dados, idempotencyKey) => requisitar("v1/manutencao/planos", { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    listarChamadosManutencao: (filtros = {}) => requisitar(`v1/manutencao/chamados?${new URLSearchParams(filtros)}`),
    obterChamadoManutencao: (id) => requisitar(`v1/manutencao/chamados/${encodeURIComponent(id)}`),
    criarChamadoManutencao: (dados, idempotencyKey) => requisitar("v1/manutencao/chamados", { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    decidirChamadoManutencao: (id, dados, versao, idempotencyKey) => requisitar(`v1/manutencao/chamados/${encodeURIComponent(id)}/decisoes`, { method:"POST",body:JSON.stringify(dados),versao,idempotencyKey }),
    criarOrdemManutencao: (id, dados, idempotencyKey) => requisitar(`v1/manutencao/chamados/${encodeURIComponent(id)}/ordens`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    adicionarRecursoOrdemManutencao: (id, dados, idempotencyKey) => requisitar(`v1/manutencao/ordens/${encodeURIComponent(id)}/recursos`, { method:"POST",body:JSON.stringify(dados),idempotencyKey }),
    obterResumoManutencao: () => requisitar("v1/manutencao/resumo"),
    listarConvenios: (filtros={}) => requisitar(`v1/convenios?${new URLSearchParams(filtros)}`),
    obterResumoConvenios: () => requisitar("v1/convenios/resumo"),
    obterConvenio: (id) => requisitar(`v1/convenios/${encodeURIComponent(id)}`),
    criarConvenio: (dados,idempotencyKey) => requisitar("v1/convenios",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    decidirConvenio: (id,dados,versao,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/decisoes`,{method:"POST",body:JSON.stringify(dados),versao,idempotencyKey}),
    adicionarMetaConvenio: (id,dados,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/metas`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    registrarRepasseConvenio: (id,dados,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/repasses`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    registrarExecucaoConvenio: (id,dados,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/execucoes`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    criarPrestacaoConvenio: (id,dados,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/prestacoes`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    decidirPrestacaoConvenio: (id,dados,versao,idempotencyKey) => requisitar(`v1/convenios/prestacoes/${encodeURIComponent(id)}/decisoes`,{method:"POST",body:JSON.stringify(dados),versao,idempotencyKey}),
    criarDiligenciaConvenio: (id,dados,idempotencyKey) => requisitar(`v1/convenios/${encodeURIComponent(id)}/diligencias`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    listarRequisitosCompliance: (filtros={}) => requisitar(`v1/regularidade/requisitos?${new URLSearchParams(filtros)}`),
    criarRequisitoCompliance: (dados,idempotencyKey) => requisitar("v1/regularidade/requisitos",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    listarPpcis: (filtros={}) => requisitar(`v1/regularidade/ppci?${new URLSearchParams(filtros)}`),
    obterPpci: (id) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}`),
    criarPpci: (dados,idempotencyKey) => requisitar("v1/regularidade/ppci",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    atualizarPpci: (id,dados,versao) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(dados),versao}),
    criarSistemaPpci: (id,dados,idempotencyKey) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}/sistemas`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    atualizarSistemaPpci: (id,systemId,dados,versao) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}/sistemas/${encodeURIComponent(systemId)}`,{method:"PUT",body:JSON.stringify(dados),versao}),
    removerSistemaPpci: (id,systemId,motivo,versao) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}/sistemas/${encodeURIComponent(systemId)}`,{method:"DELETE",body:JSON.stringify({motivo}),versao}),
    registrarInspecaoPpci: (id,dados,idempotencyKey) => requisitar(`v1/regularidade/ppci/${encodeURIComponent(id)}/inspecoes`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    obterResumoPpci: () => requisitar("v1/regularidade/ppci/resumo"),
    listarResponsaveisCorporativos: () => requisitar("v1/responsaveis"),
    listarMedidoresUtilidades: (filtros={}) => requisitar(`v1/utilidades/medidores?${new URLSearchParams(filtros)}`),
    obterMedidorUtilidade: (id) => requisitar(`v1/utilidades/medidores/${encodeURIComponent(id)}`),
    criarMedidorUtilidade: (dados,idempotencyKey) => requisitar("v1/utilidades/medidores",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    atualizarMedidorUtilidade: (id,dados,versao) => requisitar(`v1/utilidades/medidores/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify(dados),versao}),
    removerMedidorUtilidade: (id,versao) => requisitar(`v1/utilidades/medidores/${encodeURIComponent(id)}`,{method:"DELETE",versao}),
    registrarLeituraUtilidade: (id,dados,idempotencyKey) => requisitar(`v1/utilidades/medidores/${encodeURIComponent(id)}/leituras`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    listarRiscosCompliance: () => requisitar("v1/regularidade/riscos"),
    criarRiscoCompliance: (dados,idempotencyKey) => requisitar("v1/regularidade/riscos",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    criarAcaoCompliance: (id,dados,idempotencyKey) => requisitar(`v1/regularidade/riscos/${encodeURIComponent(id)}/acoes`,{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    registrarAuditoriaCompliance: (dados,idempotencyKey) => requisitar("v1/regularidade/auditorias",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    listarPublicacoesTransparencia: (filtros={}) => requisitar(`v1/regularidade/transparencia?${new URLSearchParams(filtros)}`),
    criarPublicacaoTransparencia: (dados,idempotencyKey) => requisitar("v1/regularidade/transparencia",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    publicarTransparencia: (id,versao) => requisitar(`v1/regularidade/transparencia/${encodeURIComponent(id)}/publicacao`,{method:"POST",versao}),
    obterResumoCompliance: () => requisitar("v1/regularidade/resumo"),
    obterPainelExecutivo: () => requisitar("v1/bi/executivo"),
    listarDefinicoesRelatorios: () => requisitar("v1/relatorios/definicoes"),
    criarDefinicaoRelatorio: (dados,idempotencyKey) => requisitar("v1/relatorios/definicoes",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    listarAcessosPortais: () => requisitar("v1/portais/acessos"),
    criarAcessoPortal: (dados,idempotencyKey) => requisitar("v1/portais/acessos",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    revogarAcessoPortal: (id,versao) => requisitar(`v1/portais/acessos/${encodeURIComponent(id)}/revogacao`,{method:"POST",versao}),
    listarCanaisIntegracao: () => requisitar("v1/integracoes/canais"),
    criarCanalIntegracao: (dados,idempotencyKey) => requisitar("v1/integracoes/canais",{method:"POST",body:JSON.stringify(dados),idempotencyKey}),
    obterObservabilidade: () => requisitar("v1/operacao/observabilidade"),
    obterProntidaoOperacional: () => requisitar("v1/operacao/prontidao"),
    obterEstadoPiloto: () => requisitar("v1/operacao/piloto"),
    atualizarRequisitoPiloto: (itemId, dados) => requisitar(
      `v1/operacao/piloto/requisitos/${encodeURIComponent(itemId)}`,
      { method: "PUT", body: JSON.stringify(dados) },
    ),
    decidirPiloto: (dados) => requisitar("v1/operacao/piloto/decisoes", {
      method: "POST", body: JSON.stringify(dados),
    }),
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
    verificarTransicaoRepositorio: (dominioId, manifesto) => requisitar(
      `v1/repositorios/transicoes/${encodeURIComponent(dominioId)}/verificacao`,
      {
        method: "POST",
        body: JSON.stringify(manifesto),
      },
    ),
    alterarTransicaoRepositorio: (dominioId, dados, versao) => requisitar(
      `v1/repositorios/transicoes/${encodeURIComponent(dominioId)}`,
      {
        method: "PUT",
        body: JSON.stringify(dados),
        versao,
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
    listarDocumentos: (filtros = {}) => requisitar(`v1/documentos?${new URLSearchParams(filtros)}`),
    listarEntidadesDocumentais: () => requisitar("v1/documentos/entidades"),
    criarDocumento: (dados, idempotencyKey) => requisitar("v1/documentos", { method: "POST", body: JSON.stringify(dados), idempotencyKey }),
    adicionarVersaoDocumento: (id, dados) => requisitar(`v1/documentos/${encodeURIComponent(id)}/versoes`, { method: "POST", body: JSON.stringify(dados) }),
    solicitarUploadDocumento: (id, dados) => requisitar(`v1/documentos/${encodeURIComponent(id)}/uploads`, { method: "POST", body: JSON.stringify(dados) }),
    solicitarDownloadDocumento: (id, numero) => requisitar(`v1/documentos/${encodeURIComponent(id)}/versoes/${encodeURIComponent(numero)}/download`),
    vincularDocumento: (id, dados) => requisitar(`v1/documentos/${encodeURIComponent(id)}/vinculos`, { method: "POST", body: JSON.stringify(dados) }),
    decidirDocumento: (id, dados, versao) => requisitar(`v1/documentos/${encodeURIComponent(id)}/decisoes`, { method:"POST",body:JSON.stringify(dados),versao }),
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
