import { randomUUID } from "node:crypto";
import { ApiError } from "../errors.js";
import {
  MODULOS_PLATAFORMA,
  PERMISSOES_PLATAFORMA,
  obterModulosPermitidos,
  obterPermissoesPerfil,
} from "../domain/platform.js";
import { validarPacoteNoServidor } from "../domain/migration.js";
import { validarSolicitacaoTrabalho } from "../domain/jobs.js";
import { calcularPontuacaoDemanda, resolverTransicaoDemanda } from "../domain/planning.js";
import { resolverTransicaoContratacao, validarPesquisaPrecos } from "../domain/procurement.js";
import { calcularAditivoContrato, calcularSaldoContrato, resolverTransicaoContrato, validarVigenciaContrato } from "../domain/contracts.js";
import {
  criarHashAuditoria,
  normalizarFiltrosAuditoria,
  sanitizarDadosAuditoria,
} from "../domain/audit.js";

function copiar(valor) {
  return structuredClone(valor);
}

const DEPENDENCIAS_MODULOS = [
  ["obras", "patrimonio"],
  ["planejamento", "patrimonio"],
  ["bases-precos", "orcamentos"], ["suprimentos", "orcamentos"], ["contratos", "suprimentos"],
  ["medicoes", "obras"], ["documentos", "visao-geral"],
  ["relatorios", "visao-geral"], ["administracao", "visao-geral"],
];

export function criarRepositorioMemoria({
  tenants = [{ id: "EMP-PRUMO-DEMO", nome: "PRUMO Engenharia", status: "ativo" }],
  memberships = [{
    tenantId: "EMP-PRUMO-DEMO",
    subject: "dev-user",
    perfilId: "administrador",
    teamIds: ["EQ-ORCAMENTOS", "EQ-OBRAS"],
    status: "ativo",
  }],
  orcamentos = [],
  empreendimentos = [],
  revisoes = [],
  medicoes = [],
  publicacoesCatalogo = [],
  lotesMigracao = [],
  trabalhos = [],
  transicoesRepositorio = [],
  auditoria = [],
  politicasAuditoria = [],
  documentos = [],
  integracoes = [],
  perfilProduto = null,
  contratosModulos = [],
  unidadesPatrimoniais = [],
  ativosPatrimoniais = [],
  movimentacoesPatrimoniais = [],
  programasInvestimento = [],
  carteirasInvestimento = [],
  demandasInvestimento = [],
  decisoesDemandas = [],
  itensCarteira = [],
  fornecedores = [],
  processosContratacao = [],
  cotacoesContratacao = [],
  decisoesContratacao = [],
  pedidosCompra = [],
  recebimentosCompra = [],
  contratosGestao = [],
  responsaveisContratos = [],
  aditivosContratos = [],
  garantiasContratos = [],
  ocorrenciasContratos = [],
  sancoesContratos = [],
  execucoesContratos = [],
  decisoesContratos = [],
} = {}) {
  const registros = new Map(orcamentos.map((item) => [item.id, {
    ...copiar(item),
    versao: Number(item.versao) || 1,
  }]));
  const idempotencia = new Map();
  const registrosEmpreendimentos = new Map(
    empreendimentos.map((item) => [item.id, { ...copiar(item), versao: Number(item.versao) || 1 }]),
  );
  const registrosRevisoes = new Map(revisoes.map((item) => [item.id, copiar(item)]));
  const registrosMedicoes = new Map(medicoes.map((item) => [item.id, copiar(item)]));
  const registrosPublicacoes = new Map(
    publicacoesCatalogo.map((item) => [item.id, copiar(item)]),
  );
  const itensCatalogo = new Map();
  const registrosLotes = new Map(lotesMigracao.map((item) => [item.id, copiar(item)]));
  const composicoesProprias = new Map();
  const configuracoes = new Map();
  const registrosTrabalhos = new Map(trabalhos.map((item) => [item.id, copiar(item)]));
  const transicoes = new Map(
    transicoesRepositorio.map((item) => [`${item.tenantId}:${item.dominioId}`, copiar(item)]),
  );
  const registrosAuditoria = auditoria.map(copiar);
  const politicas = new Map(
    politicasAuditoria.map((item) => [item.tenantId, copiar(item)]),
  );
  const registrosDocumentos = new Map(documentos.map((item) => [item.id, {
    ...copiar(item), versoes: copiar(item.versoes || []), vinculos: copiar(item.vinculos || []),
  }]));
  const registrosIntegracoes = new Map(integracoes.map((item) => [item.id, copiar(item)]));
  const perfisProduto = new Map(perfilProduto ? [[perfilProduto.tenantId, copiar(perfilProduto)]] : []);
  const contratos = new Map(contratosModulos.map((item) => [`${item.tenantId}:${item.moduleId}`, copiar(item)]));
  const unidadesPatrimonio = new Map(unidadesPatrimoniais.map((item) => [item.id, copiar(item)]));
  const ativosPatrimonio = new Map(ativosPatrimoniais.map((item) => [item.id, copiar(item)]));
  const movimentacoesPatrimonio = movimentacoesPatrimoniais.map(copiar);
  const programasPlanejamento = new Map(programasInvestimento.map((item) => [item.id, copiar(item)]));
  const carteirasPlanejamento = new Map(carteirasInvestimento.map((item) => [item.id, copiar(item)]));
  const demandasPlanejamento = new Map(demandasInvestimento.map((item) => [item.id, copiar(item)]));
  const decisoesPlanejamento = decisoesDemandas.map(copiar);
  const itensCarteiraPlanejamento = itensCarteira.map(copiar);
  const fornecedoresSuprimentos = new Map(fornecedores.map((item) => [item.id, copiar(item)]));
  const processosSuprimentos = new Map(processosContratacao.map((item) => [item.id, copiar(item)]));
  const cotacoesSuprimentos = cotacoesContratacao.map(copiar);
  const decisoesSuprimentos = decisoesContratacao.map(copiar);
  const pedidosSuprimentos = new Map(pedidosCompra.map((item) => [item.id, copiar(item)]));
  const recebimentosSuprimentos = recebimentosCompra.map(copiar);
  const contratosOperacionais = new Map(contratosGestao.map((item) => [item.id, copiar(item)]));
  const responsaveisGestao = responsaveisContratos.map(copiar);
  const aditivosGestao = aditivosContratos.map(copiar);
  const garantiasGestao = garantiasContratos.map(copiar);
  const ocorrenciasGestao = ocorrenciasContratos.map(copiar);
  const sancoesGestao = sancoesContratos.map(copiar);
  const execucoesGestao = execucoesContratos.map(copiar);
  const decisoesGestao = decisoesContratos.map(copiar);

  function validarContexto({ identity, tenantId, teamId = "" }) {
    const tenant = tenants.find((item) => item.id === tenantId && item.status === "ativo");
    const membership = memberships.find((item) => (
      item.tenantId === tenantId
      && item.subject === identity?.subject
      && item.status === "ativo"
    ));
    if (!tenant || !membership) {
      throw new ApiError(403, "EMPRESA_NAO_AUTORIZADA", "O usuário não pertence à empresa selecionada.");
    }
    if (teamId && !membership.teamIds.includes(teamId)) {
      throw new ApiError(403, "EQUIPE_NAO_AUTORIZADA", "O usuário não pertence à equipe selecionada.");
    }
    const permissoes = membership.permissoes || obterPermissoesPerfil(membership.perfilId);
    const modulosContratados = MODULOS_PLATAFORMA.filter((modulo) => {
      const contrato = contratos.get(`${tenantId}:${modulo.id}`);
      return !contrato || (contrato.disponivel !== false && contrato.contratado !== false && contrato.habilitado !== false);
    });
    return {
      tenantId,
      tenantNome: tenant.nome,
      teamId,
      perfilId: membership.perfilId,
      usuarioId: identity.subject,
      permissoes,
      modulos: obterModulosPermitidos(permissoes, modulosContratados),
    };
  }

  function exigirPermissao(contexto, permissao) {
    if (!contexto.permissoes.includes(permissao)) {
      throw new ApiError(403, "PERMISSAO_NEGADA", "O perfil não permite executar esta operação.");
    }
    const moduloId = PERMISSOES_PLATAFORMA.find((item) => item.id === permissao)?.moduloId;
    if (moduloId && !contexto.modulos.some((item) => item.id === moduloId)) {
      throw new ApiError(403, "MODULO_NAO_HABILITADO", "O módulo não está contratado e habilitado para esta organização.");
    }
  }

  function visivel(registro, contexto) {
    return registro.tenantId === contexto.tenantId
      && (!registro.teamId || registro.teamId === contexto.teamId);
  }

  function exigirEquipe(contexto) {
    if (!contexto.teamId) {
      throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar o patrimônio.");
    }
  }

  function validarUnidadePatrimonial(contexto, dados, idAtual = "") {
    exigirEquipe(contexto);
    const paiEsperado = { cliente: null, site: "cliente", predio: "site", sala: "predio" }[dados.nivel];
    if (paiEsperado === undefined) {
      throw new ApiError(422, "NIVEL_PATRIMONIAL_INVALIDO", "O nível patrimonial informado é inválido.");
    }
    if (!paiEsperado && dados.parentId) {
      throw new ApiError(422, "HIERARQUIA_PATRIMONIAL_INVALIDA", "Cliente não pode possuir unidade pai.");
    }
    if (paiEsperado) {
      const pai = unidadesPatrimonio.get(dados.parentId);
      if (!pai || !visivel(pai, contexto) || pai.nivel !== paiEsperado || pai.status !== "ativo") {
        throw new ApiError(422, "HIERARQUIA_PATRIMONIAL_INVALIDA", `${dados.nivel} deve pertencer a ${paiEsperado} ativo.`);
      }
    }
    const duplicado = [...unidadesPatrimonio.values()].find((item) => (
      item.id !== idAtual && visivel(item, contexto) && item.nivel === dados.nivel
      && item.codigo.toLocaleUpperCase("pt-BR") === dados.codigo.trim().toLocaleUpperCase("pt-BR")
    ));
    if (duplicado) throw new ApiError(409, "CODIGO_PATRIMONIAL_DUPLICADO", "Já existe uma unidade com esse código e nível.");
  }

  function caminhoUnidade(item, contexto) {
    const caminho = [];
    let atual = item;
    while (atual) {
      caminho.unshift({ id: atual.id, nivel: atual.nivel, codigo: atual.codigo, nome: atual.nome });
      atual = atual.parentId ? unidadesPatrimonio.get(atual.parentId) : null;
      if (atual && !visivel(atual, contexto)) break;
    }
    return caminho;
  }

  function registrarAuditoria(contexto, {
    moduleId,
    action,
    entityType,
    entityId,
    result = "sucesso",
    before = null,
    after = null,
    metadata = {},
  }) {
    const anterior = [...registrosAuditoria]
      .reverse()
      .find((item) => item.tenantId === contexto.tenantId);
    const hashAnterior = anterior?.hash || "0".repeat(64);
    const criadoEm = new Date().toISOString();
    const base = {
      tenantId: contexto.tenantId,
      teamId: contexto.teamId || "",
      moduleId,
      action,
      entityType,
      entityId: String(entityId),
      actorId: contexto.usuarioId,
      result,
      before: sanitizarDadosAuditoria(before),
      after: sanitizarDadosAuditoria(after),
      metadata: sanitizarDadosAuditoria(metadata),
      createdAt: criadoEm,
    };
    const evento = {
      id: randomUUID(),
      tenantId: base.tenantId,
      teamId: base.teamId,
      sequencia: registrosAuditoria.length + 1,
      moduleId,
      acao: action,
      entidadeTipo: entityType,
      entidadeId: base.entityId,
      usuarioId: contexto.usuarioId,
      resultado: result,
      antes: base.before,
      depois: base.after,
      metadados: base.metadata,
      hashAnterior,
      hash: criarHashAuditoria(base, hashAnterior),
      criadoEm,
    };
    registrosAuditoria.push(evento);
    return evento;
  }

  return {
    tipo: "memory",
    async health() {
      return { ok: true, banco: "memória de desenvolvimento" };
    },
    async validarContexto(contexto) {
      return validarContexto(contexto);
    },
    async listarAuditoria(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "auditoria.consultar");
      const consulta = normalizarFiltrosAuditoria(filtros);
      const filtrados = registrosAuditoria
        .filter((item) => item.tenantId === contexto.tenantId)
        .filter((item) => !consulta.moduleId || item.moduleId === consulta.moduleId)
        .filter((item) => !consulta.action || item.acao.toLocaleLowerCase("pt-BR").includes(consulta.action.toLocaleLowerCase("pt-BR")))
        .filter((item) => !consulta.actorId || item.usuarioId.toLocaleLowerCase("pt-BR").includes(consulta.actorId.toLocaleLowerCase("pt-BR")))
        .filter((item) => !consulta.entityType || item.entidadeTipo === consulta.entityType)
        .filter((item) => !consulta.entityId || item.entidadeId === consulta.entityId)
        .filter((item) => !consulta.dataInicial || item.criadoEm >= consulta.dataInicial)
        .filter((item) => !consulta.dataFinal || item.criadoEm <= consulta.dataFinal)
        .sort((a, b) => b.sequencia - a.sequencia);
      const itens = filtrados.slice(
        consulta.deslocamento,
        consulta.deslocamento + consulta.limite,
      );
      const invalidos = itens.filter((item) => criarHashAuditoria({
        tenantId: item.tenantId,
        teamId: item.teamId,
        moduleId: item.moduleId,
        action: item.acao,
        entityType: item.entidadeTipo,
        entityId: item.entidadeId,
        actorId: item.usuarioId,
        result: item.resultado,
        before: item.antes,
        after: item.depois,
        metadata: item.metadados,
        createdAt: item.criadoEm,
      }, item.hashAnterior) !== item.hash);
      return {
        itens: copiar(itens),
        total: filtrados.length,
        limite: consulta.limite,
        deslocamento: consulta.deslocamento,
        integridade: { ok: invalidos.length === 0, invalidos: invalidos.length },
      };
    },
    async obterPoliticaAuditoria(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "auditoria.consultar");
      if (!politicas.has(contexto.tenantId)) {
        const agora = new Date().toISOString();
        politicas.set(contexto.tenantId, {
          tenantId: contexto.tenantId,
          retencaoDias: 2555,
          frequenciaBackup: "diario",
          ultimoBackupEm: "",
          ultimoBackupHash: "",
          ultimoTesteRestauracaoEm: "",
          ultimoTesteRestauracaoOk: null,
          atualizadoPor: contexto.usuarioId,
          atualizadoEm: agora,
        });
      }
      return copiar(politicas.get(contexto.tenantId));
    },
    async atualizarPoliticaAuditoria(contextoBruto, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "auditoria.administrar");
      const anterior = politicas.get(contexto.tenantId) || null;
      const politica = {
        ...(anterior || {}),
        tenantId: contexto.tenantId,
        retencaoDias: Number(dados.retencaoDias),
        frequenciaBackup: dados.frequenciaBackup,
        ultimoBackupEm: dados.ultimoBackupEm ?? anterior?.ultimoBackupEm ?? "",
        ultimoBackupHash: dados.ultimoBackupHash ?? anterior?.ultimoBackupHash ?? "",
        ultimoTesteRestauracaoEm: dados.ultimoTesteRestauracaoEm
          ?? anterior?.ultimoTesteRestauracaoEm ?? "",
        ultimoTesteRestauracaoOk: dados.ultimoTesteRestauracaoOk
          ?? anterior?.ultimoTesteRestauracaoOk ?? null,
        atualizadoPor: contexto.usuarioId,
        atualizadoEm: new Date().toISOString(),
      };
      politicas.set(contexto.tenantId, politica);
      registrarAuditoria(contexto, {
        moduleId: "administracao",
        action: dados.ultimoTesteRestauracaoEm
          ? "auditoria.recuperacao-registrada"
          : "auditoria.politica-atualizada",
        entityType: "politica-auditoria",
        entityId: contexto.tenantId,
        before: anterior,
        after: politica,
      });
      return copiar(politica);
    },
    async listarDocumentos(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.consultar");
      return [...registrosDocumentos.values()].filter((item) => visivel(item, contexto)).map(copiar);
    },
    async criarDocumento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.editar");
      const anterior = idempotencia.get(`${contexto.tenantId}:documento:${idempotencyKey}`);
      if (anterior) return copiar(anterior);
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId,
        titulo: dados.titulo, tipo: dados.tipo || "documento_tecnico",
        status: dados.status || "rascunho", versaoAtual: 0,
        metadados: copiar(dados.metadados || {}), versoes: [], vinculos: [],
        criadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora,
      };
      registrosDocumentos.set(item.id, item);
      idempotencia.set(`${contexto.tenantId}:documento:${idempotencyKey}`, item);
      registrarAuditoria(contexto, { moduleId: "documentos", action: "documento.criado", entityType: "documento", entityId: item.id, after: item });
      return copiar(item);
    },
    async vincularDocumento(contextoBruto, documentoId, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.editar");
      const item = registrosDocumentos.get(documentoId);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento não encontrado.");
      const existente = item.vinculos.find((vinculo) => (
        vinculo.moduleId === dados.moduleId
        && vinculo.entidadeTipo === dados.entidadeTipo
        && vinculo.entidadeId === dados.entidadeId
      ));
      if (existente) return copiar(existente);
      const vinculo = { ...copiar(dados), criadoEm: new Date().toISOString() };
      item.vinculos.push(vinculo);
      item.atualizadoEm = vinculo.criadoEm;
      registrarAuditoria(contexto, { moduleId: "documentos", action: "documento.vinculado", entityType: "documento", entityId: item.id, metadata: vinculo });
      return copiar(vinculo);
    },
    async adicionarVersaoDocumento(contextoBruto, documentoId, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.editar");
      const item = registrosDocumentos.get(documentoId);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento não encontrado.");
      const versao = {
        numero: item.versaoAtual + 1, nomeArquivo: dados.nomeArquivo,
        tipoMime: dados.tipoMime || "application/octet-stream",
        tamanhoBytes: Number(dados.tamanhoBytes) || 0, sha256: dados.sha256,
        storageKey: dados.storageKey, responsavel: contexto.usuarioId,
        metadados: copiar(dados.metadados || {}), criadoEm: new Date().toISOString(),
      };
      item.versoes.push(versao);
      item.versaoAtual = versao.numero;
      item.atualizadoEm = versao.criadoEm;
      registrarAuditoria(contexto, { moduleId: "documentos", action: "documento.versao-adicionada", entityType: "documento", entityId: item.id, metadata: { numero: versao.numero, sha256: versao.sha256 } });
      return copiar(item);
    },
    async listarIntegracoes(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "integracoes.consultar");
      return [...registrosIntegracoes.values()]
        .filter((item) => item.tenantId === contexto.tenantId)
        .map((item) => copiar({ ...item, credentialReference: item.credentialReference ? "configurada" : "" }));
    },
    async criarIntegracao(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "integracoes.administrar");
      const agora = new Date().toISOString();
      const item = { id: randomUUID(), tenantId: contexto.tenantId, nome: dados.nome, provedor: dados.provedor, status: dados.status || "inativa", credentialReference: dados.credentialReference || "", configuracao: copiar(dados.configuracao || {}), execucoes: [], criadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      registrosIntegracoes.set(item.id, item);
      const resposta = { ...item, credentialReference: item.credentialReference ? "configurada" : "" };
      idempotencia.set(`${contexto.tenantId}:integracao:${idempotencyKey}`, resposta);
      registrarAuditoria(contexto, { moduleId: "administracao", action: "integracao.criada", entityType: "integracao", entityId: item.id, after: { ...item, credentialReference: item.credentialReference ? "[REFERÊNCIA CONFIGURADA]" : "" } });
      return copiar(resposta);
    },
    async registrarExecucaoIntegracao(contextoBruto, integracaoId, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "integracoes.administrar");
      const item = registrosIntegracoes.get(integracaoId);
      if (!item || item.tenantId !== contexto.tenantId) throw new ApiError(404, "INTEGRACAO_NAO_ENCONTRADA", "Integração não encontrada.");
      const execucao = { id: randomUUID(), status: dados.status || "iniciada", direcao: dados.direcao || "entrada", contagens: copiar(dados.contagens || {}), erroSanitizado: dados.erroSanitizado || "", executadoPor: contexto.usuarioId, iniciadoEm: new Date().toISOString() };
      item.execucoes.unshift(execucao);
      registrarAuditoria(contexto, { moduleId: "administracao", action: "integracao.executada", entityType: "integracao", entityId: item.id, metadata: execucao });
      return copiar(execucao);
    },
    async obterProdutoModular(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "produto-modular.consultar");
      const perfil = perfisProduto.get(contexto.tenantId) || { tenantId: contexto.tenantId, perfil: "publico", terminologia: {}, templates: {} };
      const modulos = MODULOS_PLATAFORMA.map((modulo) => ({ ...modulo, ...(contratos.get(`${contexto.tenantId}:${modulo.id}`) || { disponivel: true, contratado: true, habilitado: true, pacote: "plataforma", limites: {} }) }));
      return { versaoCatalogo: 1, perfil: copiar(perfil), modulos };
    },
    async atualizarPerfilProduto(contextoBruto, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "produto-modular.administrar");
      const perfil = { tenantId: contexto.tenantId, perfil: dados.perfil, terminologia: copiar(dados.terminologia || {}), templates: copiar(dados.templates || {}), atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      perfisProduto.set(contexto.tenantId, perfil);
      registrarAuditoria(contexto, { moduleId: "administracao", action: "produto.perfil-atualizado", entityType: "perfil-produto", entityId: contexto.tenantId, after: perfil });
      return copiar(perfil);
    },
    async atualizarContratoModulo(contextoBruto, moduleId, dados) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "produto-modular.administrar");
      if (!MODULOS_PLATAFORMA.some((item) => item.id === moduleId)) throw new ApiError(404, "MODULO_NAO_ENCONTRADO", "Módulo não encontrado.");
      const chave = `${contexto.tenantId}:${moduleId}`;
      const anterior = contratos.get(chave) || { tenantId: contexto.tenantId, moduleId, disponivel: true, contratado: true, habilitado: true, pacote: "plataforma", limites: {} };
      const contrato = { ...anterior, ...copiar(dados), tenantId: contexto.tenantId, moduleId, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      if (contrato.habilitado && (!contrato.disponivel || !contrato.contratado)) throw new ApiError(422, "MODULO_NAO_CONTRATADO", "Somente módulos disponíveis e contratados podem ser habilitados.");
      const habilitado = (id) => (contratos.get(`${contexto.tenantId}:${id}`)?.habilitado ?? true);
      if (contrato.habilitado && DEPENDENCIAS_MODULOS.some(([modulo, dependencia]) => modulo === moduleId && !habilitado(dependencia))) throw new ApiError(422, "DEPENDENCIA_NAO_HABILITADA", "Uma dependência obrigatória do módulo está suspensa.");
      if (!contrato.habilitado && DEPENDENCIAS_MODULOS.some(([dependente, dependencia]) => dependencia === moduleId && habilitado(dependente))) throw new ApiError(422, "MODULO_POSSUI_DEPENDENTES", "O módulo possui dependentes obrigatórios habilitados.");
      contratos.set(chave, contrato);
      registrarAuditoria(contexto, { moduleId: "administracao", action: "produto.modulo-atualizado", entityType: "contrato-modulo", entityId: moduleId, before: anterior, after: contrato });
      return copiar(contrato);
    },
    async listarUnidadesPatrimoniais(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.consultar");
      return [...unidadesPatrimonio.values()]
        .filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.nivel || item.nivel === filtros.nivel)
        .filter((item) => !filtros.parentId || item.parentId === filtros.parentId)
        .filter((item) => !filtros.status || item.status === filtros.status)
        .map((item) => ({ ...item, caminho: caminhoUnidade(item, contexto) }))
        .sort((a, b) => caminhoUnidade(a, contexto).map((parte) => parte.nome).join("/").localeCompare(caminhoUnidade(b, contexto).map((parte) => parte.nome).join("/"), "pt-BR"))
        .map(copiar);
    },
    async obterUnidadePatrimonial(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.consultar");
      const item = unidadesPatrimonio.get(id);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
      const filhos = [...unidadesPatrimonio.values()].filter((filho) => filho.parentId === id && visivel(filho, contexto)).length;
      const ativos = [...ativosPatrimonio.values()].filter((ativo) => ativo.salaId === id && visivel(ativo, contexto)).length;
      return copiar({ ...item, caminho: caminhoUnidade(item, contexto), totais: { filhos, ativos } });
    },
    async criarUnidadePatrimonial(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.editar");
      const chave = `${contexto.tenantId}:patrimonio-unidade:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      validarUnidadePatrimonial(contexto, dados);
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId,
        parentId: dados.parentId || "", nivel: dados.nivel, codigo: dados.codigo.trim(),
        nome: dados.nome.trim(), status: dados.status || "ativo", endereco: copiar(dados.endereco || {}),
        areaM2: dados.areaM2 ?? null, responsavel: dados.responsavel || "", ocupacao: dados.ocupacao || "",
        dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId,
        atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora,
      };
      unidadesPatrimonio.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, { moduleId: "patrimonio", action: "patrimonio.unidade-criada", entityType: `unidade-${item.nivel}`, entityId: item.id, after: item });
      return copiar({ ...item, caminho: caminhoUnidade(item, contexto) });
    },
    async atualizarUnidadePatrimonial(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.editar");
      const anterior = unidadesPatrimonio.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A unidade foi alterada por outro usuário.");
      validarUnidadePatrimonial(contexto, dados, id);
      if (anterior.nivel !== dados.nivel) {
        const possuiDependencias = [...unidadesPatrimonio.values()].some((item) => item.parentId === id)
          || [...ativosPatrimonio.values()].some((item) => item.salaId === id)
          || [...registrosEmpreendimentos.values()].some((item) => item.patrimonioUnidadeId === id)
          || movimentacoesPatrimonio.some((item) => item.origemSalaId === id || item.destinoSalaId === id);
        if (possuiDependencias) {
          throw new ApiError(422, "UNIDADE_PATRIMONIAL_EM_USO", "O nível só pode ser alterado quando a unidade não possui registros vinculados.");
        }
      }
      if (anterior.status === "ativo" && dados.status === "inativo") {
        const filhoAtivo = [...unidadesPatrimonio.values()].some((item) => item.parentId === id && item.status === "ativo");
        const ativoEmOperacao = anterior.nivel === "sala" && [...ativosPatrimonio.values()].some((item) => item.salaId === id && !["inativo", "baixado"].includes(item.status));
        if (filhoAtivo || ativoEmOperacao) throw new ApiError(422, "UNIDADE_PATRIMONIAL_EM_USO", "Desative as unidades filhas e os ativos em operação antes desta unidade.");
      }
      const atualizado = {
        ...anterior, parentId: dados.parentId || "", nivel: dados.nivel, codigo: dados.codigo.trim(), nome: dados.nome.trim(),
        status: dados.status || "ativo", endereco: copiar(dados.endereco || {}), areaM2: dados.areaM2 ?? null,
        responsavel: dados.responsavel || "", ocupacao: dados.ocupacao || "", dados: copiar(dados.dados || {}),
        versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString(),
      };
      unidadesPatrimonio.set(id, atualizado);
      registrarAuditoria(contexto, { moduleId: "patrimonio", action: "patrimonio.unidade-atualizada", entityType: `unidade-${atualizado.nivel}`, entityId: id, before: anterior, after: atualizado });
      return copiar({ ...atualizado, caminho: caminhoUnidade(atualizado, contexto) });
    },
    async excluirUnidadePatrimonial(contextoBruto, id, versaoEsperada) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.editar");
      const anterior = unidadesPatrimonio.get(id);
      if (!anterior || !visivel(anterior, contexto)) {
        throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
      }
      if (anterior.versao !== versaoEsperada) {
        throw new ApiError(412, "VERSAO_DIVERGENTE", "A unidade foi alterada por outro usuário.");
      }
      const possuiDependencias = [...unidadesPatrimonio.values()].some((item) => item.parentId === id && visivel(item, contexto))
        || [...ativosPatrimonio.values()].some((item) => item.salaId === id && visivel(item, contexto))
        || [...registrosEmpreendimentos.values()].some((item) => item.patrimonioUnidadeId === id && visivel(item, contexto))
        || movimentacoesPatrimonio.some((item) => (item.origemSalaId === id || item.destinoSalaId === id) && visivel(item, contexto));
      if (possuiDependencias) {
        throw new ApiError(422, "UNIDADE_PATRIMONIAL_EM_USO", "Exclua ou transfira primeiro as unidades, ativos e demais registros vinculados.");
      }
      unidadesPatrimonio.delete(id);
      registrarAuditoria(contexto, {
        moduleId: "patrimonio", action: "patrimonio.unidade-excluida",
        entityType: `unidade-${anterior.nivel}`, entityId: id, before: anterior, after: null,
      });
      return copiar(anterior);
    },
    async listarAtivosPatrimoniais(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.consultar");
      return [...ativosPatrimonio.values()]
        .filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.salaId || item.salaId === filtros.salaId)
        .filter((item) => !filtros.status || item.status === filtros.status)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map(copiar);
    },
    async criarAtivoPatrimonial(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.editar");
      exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:patrimonio-ativo:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const sala = unidadesPatrimonio.get(dados.salaId);
      if (!sala || !visivel(sala, contexto) || sala.nivel !== "sala" || sala.status !== "ativo") throw new ApiError(422, "SALA_PATRIMONIAL_INVALIDA", "O ativo deve pertencer a uma sala ativa.");
      const duplicado = [...ativosPatrimonio.values()].some((item) => visivel(item, contexto) && item.codigo.toLocaleUpperCase("pt-BR") === dados.codigo.trim().toLocaleUpperCase("pt-BR"));
      if (duplicado) throw new ApiError(409, "CODIGO_ATIVO_DUPLICADO", "Já existe um ativo com esse código.");
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, salaId: dados.salaId,
        codigo: dados.codigo.trim(), nome: dados.nome.trim(), categoria: dados.categoria || "equipamento",
        numeroPatrimonio: dados.numeroPatrimonio || "", fabricante: dados.fabricante || "", modelo: dados.modelo || "",
        numeroSerie: dados.numeroSerie || "", status: dados.status || "ativo", dados: copiar(dados.dados || {}),
        versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora,
      };
      ativosPatrimonio.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, { moduleId: "patrimonio", action: "patrimonio.ativo-criado", entityType: "ativo-patrimonial", entityId: item.id, after: item });
      return copiar(item);
    },
    async atualizarAtivoPatrimonial(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.editar");
      const anterior = ativosPatrimonio.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O ativo foi alterado por outro usuário.");
      if (anterior.salaId !== dados.salaId) throw new ApiError(422, "MOVIMENTACAO_OBRIGATORIA", "Use a movimentação patrimonial para trocar o ativo de sala.");
      const sala = unidadesPatrimonio.get(dados.salaId);
      if (!sala || !visivel(sala, contexto) || sala.nivel !== "sala" || sala.status !== "ativo") throw new ApiError(422, "SALA_PATRIMONIAL_INVALIDA", "O ativo deve pertencer a uma sala ativa.");
      const atualizado = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), nome: dados.nome.trim(), versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      ativosPatrimonio.set(id, atualizado);
      registrarAuditoria(contexto, { moduleId: "patrimonio", action: "patrimonio.ativo-atualizado", entityType: "ativo-patrimonial", entityId: id, before: anterior, after: atualizado });
      return copiar(atualizado);
    },
    async listarMovimentacoesPatrimoniais(contextoBruto, ativoId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.consultar");
      const ativo = ativosPatrimonio.get(ativoId);
      if (!ativo || !visivel(ativo, contexto)) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
      return movimentacoesPatrimonio.filter((item) => item.assetId === ativoId && visivel(item, contexto)).sort((a, b) => b.movimentadoEm.localeCompare(a.movimentadoEm)).map(copiar);
    },
    async movimentarAtivoPatrimonial(contextoBruto, ativoId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "patrimonio.movimentar");
      const chave = `${contexto.tenantId}:patrimonio-movimento:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const ativo = ativosPatrimonio.get(ativoId);
      if (!ativo || !visivel(ativo, contexto)) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
      const destino = unidadesPatrimonio.get(dados.destinoSalaId);
      if (!destino || !visivel(destino, contexto) || destino.nivel !== "sala" || destino.status !== "ativo") throw new ApiError(422, "SALA_PATRIMONIAL_INVALIDA", "O destino deve ser uma sala ativa.");
      if (ativo.salaId === destino.id) throw new ApiError(422, "MOVIMENTACAO_SEM_ALTERACAO", "O ativo já está na sala informada.");
      const movimento = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, assetId: ativo.id, origemSalaId: ativo.salaId, destinoSalaId: destino.id, motivo: dados.motivo.trim(), movimentadoPor: contexto.usuarioId, movimentadoEm: new Date().toISOString() };
      const antes = copiar(ativo);
      ativo.salaId = destino.id; ativo.versao += 1; ativo.atualizadoPor = contexto.usuarioId; ativo.atualizadoEm = movimento.movimentadoEm;
      movimentacoesPatrimonio.push(movimento); idempotencia.set(chave, movimento);
      registrarAuditoria(contexto, { moduleId: "patrimonio", action: "patrimonio.ativo-movimentado", entityType: "ativo-patrimonial", entityId: ativo.id, before: antes, after: ativo, metadata: movimento });
      return copiar(movimento);
    },
    async listarProgramasInvestimento(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "planejamento.consultar");
      return [...programasPlanejamento.values()]
        .filter((item) => visivel(item, contexto))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
        .map(copiar);
    },
    async criarProgramaInvestimento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "planejamento.editar");
      exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:programa-investimento:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const duplicado = [...programasPlanejamento.values()].some((item) => visivel(item, contexto)
        && item.codigo.toLocaleUpperCase("pt-BR") === dados.codigo.trim().toLocaleUpperCase("pt-BR"));
      if (duplicado) throw new ApiError(409, "CODIGO_PROGRAMA_DUPLICADO", "Já existe um programa com esse código.");
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId,
        codigo: dados.codigo.trim(), nome: dados.nome.trim(), objetivo: dados.objetivo || "",
        anoInicio: dados.anoInicio ?? null, anoFim: dados.anoFim ?? null,
        limiteFinanceiro: Number(dados.limiteFinanceiro) || 0, status: dados.status || "ativo",
        dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId,
        atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora,
      };
      programasPlanejamento.set(item.id, item); idempotencia.set(chave, item);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.programa-criado", entityType: "programa-investimento", entityId: item.id, after: item });
      return copiar(item);
    },
    async atualizarProgramaInvestimento(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "planejamento.editar");
      const anterior = programasPlanejamento.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "PROGRAMA_NAO_ENCONTRADO", "Programa de investimento não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O programa foi alterado por outro usuário.");
      const atualizado = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), nome: dados.nome.trim(), objetivo: dados.objetivo || "", limiteFinanceiro: Number(dados.limiteFinanceiro) || 0, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      programasPlanejamento.set(id, atualizado);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.programa-atualizado", entityType: "programa-investimento", entityId: id, before: anterior, after: atualizado });
      return copiar(atualizado);
    },
    async listarCarteirasInvestimento(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "planejamento.consultar");
      return [...carteirasPlanejamento.values()].filter((item) => visivel(item, contexto)).map((item) => ({
        ...item,
        itens: itensCarteiraPlanejamento.filter((vinculo) => vinculo.portfolioId === item.id && visivel(vinculo, contexto)).sort((a, b) => a.ordem - b.ordem).map(copiar),
      })).sort((a, b) => b.ano - a.ano || a.codigo.localeCompare(b.codigo, "pt-BR")).map(copiar);
    },
    async criarCarteiraInvestimento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "planejamento.editar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:carteira-investimento:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const agora = new Date().toISOString();
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, codigo: dados.codigo.trim(), nome: dados.nome.trim(), ano: Number(dados.ano), limiteFinanceiro: Number(dados.limiteFinanceiro) || 0, status: dados.status || "elaboracao", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      carteirasPlanejamento.set(item.id, item); idempotencia.set(chave, item);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.carteira-criada", entityType: "carteira-investimento", entityId: item.id, after: item });
      return copiar({ ...item, itens: [] });
    },
    async atualizarCarteiraInvestimento(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.editar");
      const anterior = carteirasPlanejamento.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CARTEIRA_NAO_ENCONTRADA", "Carteira de investimentos não encontrada.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A carteira foi alterada por outro usuário.");
      const atualizado = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), nome: dados.nome.trim(), ano: Number(dados.ano), limiteFinanceiro: Number(dados.limiteFinanceiro) || 0, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      carteirasPlanejamento.set(id, atualizado);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.carteira-atualizada", entityType: "carteira-investimento", entityId: id, before: anterior, after: atualizado });
      return copiar(atualizado);
    },
    async listarDemandasInvestimento(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.consultar");
      return [...demandasPlanejamento.values()].filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.status || item.status === filtros.status)
        .filter((item) => !filtros.programaId || item.programaId === filtros.programaId)
        .filter((item) => !filtros.patrimonioUnidadeId || item.patrimonioUnidadeId === filtros.patrimonioUnidadeId)
        .sort((a, b) => b.pontuacao - a.pontuacao || b.atualizadoEm.localeCompare(a.atualizadoEm)).map(copiar);
    },
    async obterDemandaInvestimento(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.consultar");
      const item = demandasPlanejamento.get(id);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "DEMANDA_NAO_ENCONTRADA", "Demanda de investimento não encontrada.");
      return copiar({ ...item, decisoes: decisoesPlanejamento.filter((decisao) => decisao.demandId === id && visivel(decisao, contexto)).sort((a, b) => b.decididoEm.localeCompare(a.decididoEm)) });
    },
    async criarDemandaInvestimento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.editar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:demanda-investimento:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const unidade = unidadesPatrimonio.get(dados.patrimonioUnidadeId);
      if (!unidade || !visivel(unidade, contexto) || unidade.status !== "ativo") throw new ApiError(422, "REFERENCIA_PATRIMONIAL_INVALIDA", "A demanda deve estar vinculada a uma unidade patrimonial ativa.");
      if (dados.programaId) {
        const programa = programasPlanejamento.get(dados.programaId);
        if (!programa || !visivel(programa, contexto) || programa.status !== "ativo") throw new ApiError(422, "PROGRAMA_INVALIDO", "O programa selecionado não está ativo nesta equipe.");
      }
      const agora = new Date().toISOString();
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, patrimonioUnidadeId: dados.patrimonioUnidadeId, programaId: dados.programaId || "", codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), descricao: dados.descricao || "", solicitante: dados.solicitante || "", categoria: dados.categoria || "obra_reforma", valorEstimado: Number(dados.valorEstimado) || 0, dataDesejada: dados.dataDesejada || "", urgencia: Number(dados.urgencia) || 3, impacto: Number(dados.impacto) || 3, risco: Number(dados.risco) || 3, alinhamento: Number(dados.alinhamento) || 3, pontuacao: calcularPontuacaoDemanda(dados), status: "rascunho", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      demandasPlanejamento.set(item.id, item); idempotencia.set(chave, item);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.demanda-criada", entityType: "demanda-investimento", entityId: item.id, after: item });
      return copiar(item);
    },
    async atualizarDemandaInvestimento(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.editar");
      const anterior = demandasPlanejamento.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "DEMANDA_NAO_ENCONTRADA", "Demanda de investimento não encontrada.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A demanda foi alterada por outro usuário.");
      if (!['rascunho', 'em_analise', 'rejeitada'].includes(anterior.status)) throw new ApiError(422, "DEMANDA_NAO_EDITAVEL", "A demanda não pode ser editada neste estágio.");
      const unidade = unidadesPatrimonio.get(dados.patrimonioUnidadeId);
      if (!unidade || !visivel(unidade, contexto) || unidade.status !== "ativo") throw new ApiError(422, "REFERENCIA_PATRIMONIAL_INVALIDA", "A demanda deve estar vinculada a uma unidade patrimonial ativa.");
      const atualizado = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), programaId: dados.programaId || "", valorEstimado: Number(dados.valorEstimado) || 0, urgencia: Number(dados.urgencia) || 3, impacto: Number(dados.impacto) || 3, risco: Number(dados.risco) || 3, alinhamento: Number(dados.alinhamento) || 3, pontuacao: calcularPontuacaoDemanda(dados), status: anterior.status, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      demandasPlanejamento.set(id, atualizado);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.demanda-atualizada", entityType: "demanda-investimento", entityId: id, before: anterior, after: atualizado });
      return copiar(atualizado);
    },
    async decidirDemandaInvestimento(contextoBruto, id, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      const chave = `${contexto.tenantId}:decisao-demanda:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const anterior = demandasPlanejamento.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "DEMANDA_NAO_ENCONTRADA", "Demanda de investimento não encontrada.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A demanda foi alterada por outro usuário.");
      const transicao = resolverTransicaoDemanda(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao);
      if (dados.acao === "rejeitar" && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa da rejeição.");
      const agora = new Date().toISOString();
      const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, demandId: id, acao: dados.acao, statusAnterior: anterior.status, statusNovo: transicao.statusNovo, justificativa: String(dados.justificativa || "").trim(), decididoPor: contexto.usuarioId, decididoEm: agora };
      const atualizado = { ...anterior, status: transicao.statusNovo, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora };
      demandasPlanejamento.set(id, atualizado); decisoesPlanejamento.push(decisao);
      const resposta = { demanda: copiar(atualizado), decisao: copiar(decisao) }; idempotencia.set(chave, resposta);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: `planejamento.demanda-${dados.acao}`, entityType: "demanda-investimento", entityId: id, before: anterior, after: atualizado, metadata: decisao });
      return resposta;
    },
    async listarDecisoesDemanda(contextoBruto, id) {
      const demanda = await this.obterDemandaInvestimento(contextoBruto, id);
      return demanda.decisoes;
    },
    async incorporarDemandaCarteira(contextoBruto, portfolioId, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "planejamento.aprovar");
      const chave = `${contexto.tenantId}:incorporacao-demanda:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const carteira = carteirasPlanejamento.get(portfolioId); const demanda = demandasPlanejamento.get(dados.demandId);
      if (!carteira || !visivel(carteira, contexto)) throw new ApiError(404, "CARTEIRA_NAO_ENCONTRADA", "Carteira de investimentos não encontrada.");
      if (!demanda || !visivel(demanda, contexto)) throw new ApiError(404, "DEMANDA_NAO_ENCONTRADA", "Demanda de investimento não encontrada.");
      if (demanda.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A demanda foi alterada por outro usuário.");
      resolverTransicaoDemanda(demanda.status, "incorporar");
      if (!['elaboracao', 'em_aprovacao'].includes(carteira.status)) throw new ApiError(422, "CARTEIRA_FECHADA", "A carteira não aceita novas demandas neste estágio.");
      const total = itensCarteiraPlanejamento.filter((item) => item.portfolioId === portfolioId && visivel(item, contexto)).reduce((soma, item) => soma + Number(item.valorPlanejado || 0), 0) + Number(dados.valorPlanejado || 0);
      if (carteira.limiteFinanceiro > 0 && total > carteira.limiteFinanceiro) throw new ApiError(422, "LIMITE_CARTEIRA_EXCEDIDO", "A inclusão ultrapassa o limite financeiro da carteira.");
      const agora = new Date().toISOString();
      const vinculo = { tenantId: contexto.tenantId, teamId: contexto.teamId, portfolioId, demandId: demanda.id, ordem: Number(dados.ordem), valorPlanejado: Number(dados.valorPlanejado) || 0, observacao: dados.observacao || "", incorporadoPor: contexto.usuarioId, incorporadoEm: agora };
      itensCarteiraPlanejamento.push(vinculo);
      const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, demandId: demanda.id, acao: "incorporar", statusAnterior: demanda.status, statusNovo: "incorporada", justificativa: dados.observacao || "", decididoPor: contexto.usuarioId, decididoEm: agora };
      const atualizada = { ...demanda, status: "incorporada", versao: demanda.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora };
      demandasPlanejamento.set(demanda.id, atualizada); decisoesPlanejamento.push(decisao);
      const resposta = { vinculo: copiar(vinculo), demanda: copiar(atualizada), decisao: copiar(decisao) }; idempotencia.set(chave, resposta);
      registrarAuditoria(contexto, { moduleId: "planejamento", action: "planejamento.demanda-incorporada", entityType: "demanda-investimento", entityId: demanda.id, before: demanda, after: atualizada, metadata: vinculo });
      return resposta;
    },
    async listarFornecedores(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.consultar");
      const busca = String(filtros.busca || "").toLocaleLowerCase("pt-BR");
      return [...fornecedoresSuprimentos.values()].filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.status || item.status === filtros.status)
        .filter((item) => !busca || `${item.codigo} ${item.razaoSocial} ${item.documento}`.toLocaleLowerCase("pt-BR").includes(busca))
        .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR")).map(copiar);
    },
    async criarFornecedor(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.editar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:fornecedor:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const duplicado = [...fornecedoresSuprimentos.values()].some((item) => visivel(item, contexto) && (item.codigo.toUpperCase() === dados.codigo.trim().toUpperCase() || (dados.documento && item.documento === dados.documento)));
      if (duplicado) throw new ApiError(409, "FORNECEDOR_DUPLICADO", "Já existe um fornecedor com esse código ou documento.");
      const agora = new Date().toISOString();
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, codigo: dados.codigo.trim(), razaoSocial: dados.razaoSocial.trim(), nomeFantasia: dados.nomeFantasia || "", documento: dados.documento || "", email: dados.email || "", telefone: dados.telefone || "", status: dados.status || "ativo", qualificacao: dados.qualificacao || "pendente", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      fornecedoresSuprimentos.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.fornecedor-criado", entityType: "fornecedor", entityId: item.id, after: item }); return copiar(item);
    },
    async atualizarFornecedor(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.editar"); const anterior = fornecedoresSuprimentos.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "FORNECEDOR_NAO_ENCONTRADO", "Fornecedor não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O fornecedor foi alterado por outro usuário.");
      const item = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), razaoSocial: dados.razaoSocial.trim(), versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      fornecedoresSuprimentos.set(id, item); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.fornecedor-atualizado", entityType: "fornecedor", entityId: id, before: anterior, after: item }); return copiar(item);
    },
    async listarProcessosContratacao(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.consultar");
      return [...processosSuprimentos.values()].filter((item) => visivel(item, contexto)).filter((item) => !filtros.status || item.status === filtros.status).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).map(copiar);
    },
    async obterProcessoContratacao(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.consultar"); const item = processosSuprimentos.get(id);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "PROCESSO_CONTRATACAO_NAO_ENCONTRADO", "Processo de contratação não encontrado.");
      return copiar({ ...item, cotacoes: cotacoesSuprimentos.filter((x) => x.processId === id && visivel(x, contexto)), decisoes: decisoesSuprimentos.filter((x) => x.processId === id && visivel(x, contexto)).sort((a, b) => b.decididoEm.localeCompare(a.decididoEm)), pedidos: [...pedidosSuprimentos.values()].filter((x) => x.processId === id && visivel(x, contexto)) });
    },
    async criarProcessoContratacao(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.editar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:processo-contratacao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const demanda = dados.demandId ? demandasPlanejamento.get(dados.demandId) : null; const orcamento = dados.orcamentoId ? registros.get(dados.orcamentoId) : null;
      if (!dados.demandId && !dados.orcamentoId) throw new ApiError(422, "ORIGEM_CONTRATACAO_OBRIGATORIA", "Vincule uma demanda incorporada ou um orçamento.");
      if (dados.demandId && (!demanda || !visivel(demanda, contexto) || demanda.status !== "incorporada")) throw new ApiError(422, "DEMANDA_NAO_INCORPORADA", "Somente demandas incorporadas podem originar contratações.");
      if (dados.orcamentoId && (!orcamento || !visivel(orcamento, contexto))) throw new ApiError(422, "ORCAMENTO_INVALIDO", "O orçamento não pertence à equipe selecionada.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, demandId: dados.demandId || "", orcamentoId: dados.orcamentoId || "", codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), objeto: dados.objeto.trim(), tipo: dados.tipo || "servico", regime: dados.regime || "publico", criterioJulgamento: dados.criterioJulgamento || "menor_preco", valorEstimado: Number(dados.valorEstimado) || 0, status: "rascunho", estudoTecnico: copiar(dados.estudoTecnico || {}), riscos: copiar(dados.riscos || []), termoReferencia: copiar(dados.termoReferencia || {}), dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      processosSuprimentos.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.processo-criado", entityType: "processo-contratacao", entityId: item.id, after: item }); return copiar(item);
    },
    async atualizarProcessoContratacao(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.editar"); const anterior = processosSuprimentos.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "PROCESSO_CONTRATACAO_NAO_ENCONTRADO", "Processo de contratação não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O processo foi alterado por outro usuário.");
      if (!["rascunho", "planejamento"].includes(anterior.status)) throw new ApiError(422, "PROCESSO_NAO_EDITAVEL", "O planejamento não pode mais ser alterado neste estágio.");
      const item = { ...anterior, ...copiar(dados), demandId: dados.demandId || "", orcamentoId: dados.orcamentoId || "", codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), objeto: dados.objeto.trim(), valorEstimado: Number(dados.valorEstimado) || 0, status: anterior.status, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      processosSuprimentos.set(id, item); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.processo-atualizado", entityType: "processo-contratacao", entityId: id, before: anterior, after: item }); return copiar(item);
    },
    async registrarCotacao(contextoBruto, processId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.cotar"); const chave = `${contexto.tenantId}:cotacao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const processo = processosSuprimentos.get(processId); const fornecedor = fornecedoresSuprimentos.get(dados.supplierId);
      if (!processo || !visivel(processo, contexto)) throw new ApiError(404, "PROCESSO_CONTRATACAO_NAO_ENCONTRADO", "Processo de contratação não encontrado.");
      if (!["pesquisa_precos", "selecao"].includes(processo.status)) throw new ApiError(422, "COTACAO_FORA_DE_ETAPA", "A pesquisa de preços ainda não está aberta.");
      if (!fornecedor || !visivel(fornecedor, contexto) || fornecedor.status !== "ativo") throw new ApiError(422, "FORNECEDOR_INVALIDO", "Selecione um fornecedor ativo.");
      if (cotacoesSuprimentos.some((item) => item.processId === processId && item.supplierId === dados.supplierId)) throw new ApiError(409, "COTACAO_DUPLICADA", "O fornecedor já possui proposta neste processo.");
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId, supplierId: dados.supplierId, dataProposta: dados.dataProposta || new Date().toISOString().slice(0, 10), validadeDias: Number(dados.validadeDias) || 30, prazoEntregaDias: Number(dados.prazoEntregaDias) || 0, valorTotal: Number(dados.valorTotal), status: dados.status || "recebida", justificativa: dados.justificativa || "", proposta: copiar(dados.proposta || {}), criadoPor: contexto.usuarioId, criadoEm: new Date().toISOString() };
      cotacoesSuprimentos.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.cotacao-registrada", entityType: "processo-contratacao", entityId: processId, after: item }); return copiar(item);
    },
    async decidirProcessoContratacao(contextoBruto, id, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const chave = `${contexto.tenantId}:decisao-contratacao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const anterior = processosSuprimentos.get(id); if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "PROCESSO_CONTRATACAO_NAO_ENCONTRADO", "Processo de contratação não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O processo foi alterado por outro usuário.");
      const transicao = resolverTransicaoContratacao(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao);
      const cotacoes = cotacoesSuprimentos.filter((item) => item.processId === id && visivel(item, contexto)); if (dados.acao === "iniciar_selecao") validarPesquisaPrecos(cotacoes);
      if (["devolver", "cancelar"].includes(dados.acao) && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa da decisão.");
      if (dados.acao === "aprovar") { const vencedora = cotacoes.find((item) => item.id === dados.dados?.quoteId) || [...cotacoes].filter((item) => item.status !== "desclassificada").sort((a, b) => a.valorTotal - b.valorTotal)[0]; if (!vencedora) throw new ApiError(422, "PROPOSTA_VENCEDORA_OBRIGATORIA", "Selecione uma proposta vencedora."); vencedora.status = "vencedora"; }
      const agora = new Date().toISOString(); const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId: id, acao: dados.acao, statusAnterior: anterior.status, statusNovo: transicao.statusNovo, justificativa: String(dados.justificativa || "").trim(), dados: copiar(dados.dados || {}), decididoPor: contexto.usuarioId, decididoEm: agora };
      const processo = { ...anterior, status: transicao.statusNovo, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; processosSuprimentos.set(id, processo); decisoesSuprimentos.push(decisao); const resposta = { processo: copiar(processo), decisao: copiar(decisao) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "suprimentos", action: `suprimentos.processo-${dados.acao}`, entityType: "processo-contratacao", entityId: id, before: anterior, after: processo, metadata: decisao }); return resposta;
    },
    async emitirPedidoCompra(contextoBruto, processId, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.aprovar"); const chave = `${contexto.tenantId}:pedido-compra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const anterior = processosSuprimentos.get(processId); if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "PROCESSO_CONTRATACAO_NAO_ENCONTRADO", "Processo de contratação não encontrado."); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O processo foi alterado por outro usuário.");
      const transicao = resolverTransicaoContratacao(anterior.status, "emitir_pedido"); const fornecedor = fornecedoresSuprimentos.get(dados.supplierId); if (!fornecedor || !visivel(fornecedor, contexto)) throw new ApiError(422, "FORNECEDOR_INVALIDO", "Fornecedor inválido.");
      const agora = new Date().toISOString(); const pedido = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId, supplierId: dados.supplierId, quoteId: dados.quoteId || "", codigo: dados.codigo.trim(), valorTotal: Number(dados.valorTotal), dataEmissao: dados.dataEmissao || agora.slice(0, 10), dataPrevista: dados.dataPrevista || "", status: "emitido", valorRecebido: 0, dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      pedidosSuprimentos.set(pedido.id, pedido); const processo = { ...anterior, status: transicao.statusNovo, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; processosSuprimentos.set(processId, processo); decisoesSuprimentos.push({ id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId, acao: "emitir_pedido", statusAnterior: anterior.status, statusNovo: processo.status, justificativa: "Pedido emitido", dados: { orderId: pedido.id }, decididoPor: contexto.usuarioId, decididoEm: agora }); const resposta = { pedido: copiar(pedido), processo: copiar(processo) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.pedido-emitido", entityType: "pedido-compra", entityId: pedido.id, after: pedido }); return resposta;
    },
    async listarPedidosCompra(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.consultar"); return [...pedidosSuprimentos.values()].filter((item) => visivel(item, contexto)).filter((item) => !filtros.status || item.status === filtros.status).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((item) => copiar({ ...item, recebimentos: recebimentosSuprimentos.filter((x) => x.orderId === item.id && visivel(x, contexto)) }));
    },
    async registrarRecebimentoPedido(contextoBruto, orderId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "suprimentos.receber"); const chave = `${contexto.tenantId}:recebimento-compra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const pedido = pedidosSuprimentos.get(orderId); if (!pedido || !visivel(pedido, contexto)) throw new ApiError(404, "PEDIDO_NAO_ENCONTRADO", "Pedido de compra não encontrado."); const valor = Number(dados.valorRecebido); if (pedido.valorRecebido + valor > pedido.valorTotal) throw new ApiError(422, "RECEBIMENTO_SUPERIOR_AO_PEDIDO", "O recebimento ultrapassa o saldo do pedido.");
      const agora = new Date().toISOString(); const recebimento = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, orderId, dataRecebimento: dados.dataRecebimento || agora.slice(0, 10), valorRecebido: valor, aceite: dados.aceite || "aceito", observacao: dados.observacao || "", recebidoPor: contexto.usuarioId, recebidoEm: agora }; recebimentosSuprimentos.push(recebimento); pedido.valorRecebido += valor; pedido.status = pedido.valorRecebido === pedido.valorTotal ? "recebido" : "parcial"; pedido.versao += 1; pedido.atualizadoPor = contexto.usuarioId; pedido.atualizadoEm = agora;
      const processo = processosSuprimentos.get(pedido.processId); const pedidosProcesso = [...pedidosSuprimentos.values()].filter((item) => item.processId === pedido.processId && visivel(item, contexto)); if (processo?.status === "pedido_emitido" && pedidosProcesso.every((item) => item.status === "recebido")) { const statusAnterior = processo.status; processo.status = "concluida"; processo.versao += 1; processo.atualizadoPor = contexto.usuarioId; processo.atualizadoEm = agora; decisoesSuprimentos.push({ id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId: processo.id, acao: "concluir", statusAnterior, statusNovo: processo.status, justificativa: "Todos os pedidos foram recebidos", dados: { orderId }, decididoPor: contexto.usuarioId, decididoEm: agora }); }
      const resposta = { recebimento: copiar(recebimento), pedido: copiar(pedido), processo: copiar(processo) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "suprimentos", action: "suprimentos.recebimento-registrado", entityType: "pedido-compra", entityId: orderId, after: resposta }); return resposta;
    },
    async listarContratos(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.consultar");
      const busca = String(filtros.busca || "").toLocaleLowerCase("pt-BR");
      return [...contratosOperacionais.values()].filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.status || item.status === filtros.status)
        .filter((item) => !busca || `${item.codigo} ${item.numero} ${item.titulo} ${item.objeto}`.toLocaleLowerCase("pt-BR").includes(busca))
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).map((item) => copiar({ ...item, saldo: calcularSaldoContrato(item) }));
    },
    async obterContrato(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.consultar"); const item = contratosOperacionais.get(id);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado.");
      return copiar({ ...item, saldo: calcularSaldoContrato(item), responsaveis: responsaveisGestao.filter((x) => x.contractId === id && visivel(x, contexto)), aditivos: aditivosGestao.filter((x) => x.contractId === id && visivel(x, contexto)), garantias: garantiasGestao.filter((x) => x.contractId === id && visivel(x, contexto)), ocorrencias: ocorrenciasGestao.filter((x) => x.contractId === id && visivel(x, contexto)), sancoes: sancoesGestao.filter((x) => x.contractId === id && visivel(x, contexto)), execucoes: execucoesGestao.filter((x) => x.contractId === id && visivel(x, contexto)), decisoes: decisoesGestao.filter((x) => x.contractId === id && visivel(x, contexto)).sort((a, b) => b.decididoEm.localeCompare(a.decididoEm)) });
    },
    async criarContrato(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.editar"); exigirEquipe(contexto); validarVigenciaContrato(dados.dataInicio, dados.dataFim);
      const chave = `${contexto.tenantId}:contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const processo = processosSuprimentos.get(dados.processId); const fornecedor = fornecedoresSuprimentos.get(dados.supplierId);
      if (!processo || !visivel(processo, contexto) || !["aprovada", "pedido_emitido", "concluida"].includes(processo.status)) throw new ApiError(422, "PROCESSO_NAO_APROVADO", "Somente processo aprovado pode originar contrato.");
      const vencedora = cotacoesSuprimentos.find((x) => x.processId === processo.id && x.supplierId === dados.supplierId && x.status === "vencedora");
      if (!fornecedor || !visivel(fornecedor, contexto) || !vencedora) throw new ApiError(422, "CONTRATADO_NAO_VENCEDOR", "O contratado precisa ser o fornecedor vencedor do processo.");
      if ([...contratosOperacionais.values()].some((x) => visivel(x, contexto) && (x.codigo.toUpperCase() === dados.codigo.trim().toUpperCase() || x.numero.toUpperCase() === dados.numero.trim().toUpperCase()))) throw new ApiError(409, "CONTRATO_DUPLICADO", "Já existe contrato com esse código ou número.");
      const agora = new Date().toISOString(); const valor = Number(dados.valorInicial);
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, processId: dados.processId, supplierId: dados.supplierId, codigo: dados.codigo.trim(), numero: dados.numero.trim(), titulo: dados.titulo.trim(), objeto: dados.objeto.trim(), tipoInstrumento: dados.tipoInstrumento || "contrato", regime: dados.regime || processo.regime || "publico", dataAssinatura: dados.dataAssinatura || "", dataInicio: dados.dataInicio, dataFim: dados.dataFim, valorInicial: valor, valorAtual: valor, valorExecutado: 0, saldo: valor, status: "rascunho", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      contratosOperacionais.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.criado", entityType: "contrato", entityId: item.id, after: item }); return copiar(item);
    },
    async atualizarContrato(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.editar"); const anterior = contratosOperacionais.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado.");
      if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O contrato foi alterado por outro usuário.");
      if (anterior.status !== "rascunho") throw new ApiError(422, "CONTRATO_NAO_EDITAVEL", "Somente contrato em rascunho pode ser editado diretamente."); validarVigenciaContrato(dados.dataInicio, dados.dataFim);
      const valor = Number(dados.valorInicial); const item = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), numero: dados.numero.trim(), titulo: dados.titulo.trim(), objeto: dados.objeto.trim(), valorInicial: valor, valorAtual: valor, valorExecutado: anterior.valorExecutado, status: anterior.status, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      contratosOperacionais.set(id, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.atualizado", entityType: "contrato", entityId: id, before: anterior, after: item }); return copiar({ ...item, saldo: calcularSaldoContrato(item) });
    },
    async decidirContrato(contextoBruto, id, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const chave = `${contexto.tenantId}:decisao-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const anterior = contratosOperacionais.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O contrato foi alterado por outro usuário.");
      const transicao = resolverTransicaoContrato(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao);
      if (["suspender", "rescindir", "cancelar", "encerrar"].includes(dados.acao) && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa da decisão.");
      if (dados.acao === "ativar") { const responsaveis = responsaveisGestao.filter((x) => x.contractId === id && visivel(x, contexto)); if (!responsaveis.some((x) => x.papel === "gestor") || !responsaveis.some((x) => x.papel.startsWith("fiscal_"))) throw new ApiError(422, "RESPONSAVEIS_CONTRATO_INCOMPLETOS", "Designe ao menos um gestor e um fiscal antes de ativar o contrato."); }
      const agora = new Date().toISOString(); const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId: id, acao: dados.acao, statusAnterior: anterior.status, statusNovo: transicao.statusNovo, justificativa: String(dados.justificativa || "").trim(), dados: copiar(dados.dados || {}), decididoPor: contexto.usuarioId, decididoEm: agora };
      const contrato = { ...anterior, status: transicao.statusNovo, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; contratosOperacionais.set(id, contrato); decisoesGestao.push(decisao); const resposta = { contrato: copiar({ ...contrato, saldo: calcularSaldoContrato(contrato) }), decisao: copiar(decisao) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "contratos", action: `contratos.${dados.acao}`, entityType: "contrato", entityId: id, before: anterior, after: contrato, metadata: decisao }); return resposta;
    },
    async adicionarResponsavelContrato(contextoBruto, contractId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.gerir"); const chave = `${contexto.tenantId}:responsavel-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const contrato = contratosOperacionais.get(contractId);
      if (!contrato || !visivel(contrato, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, papel: dados.papel, nome: dados.nome.trim(), documento: dados.documento || "", email: dados.email || "", dataInicio: dados.dataInicio, dataFim: dados.dataFim || "", atoDesignacao: dados.atoDesignacao || "", criadoPor: contexto.usuarioId, criadoEm: agora }; responsaveisGestao.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.responsavel-designado", entityType: "contrato", entityId: contractId, after: item }); return copiar(item);
    },
    async registrarAditivoContrato(contextoBruto, contractId, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.gerir"); const chave = `${contexto.tenantId}:aditivo-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const anterior = contratosOperacionais.get(contractId);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O contrato foi alterado por outro usuário."); if (!["vigente", "suspenso"].includes(anterior.status)) throw new ApiError(422, "CONTRATO_NAO_ADITAVEL", "O contrato não aceita aditivos neste estágio.");
      const calculo = calcularAditivoContrato(anterior, dados); const agora = new Date().toISOString(); const aditivo = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, numero: dados.numero.trim(), tipo: dados.tipo, justificativa: dados.justificativa.trim(), valor: Number(dados.valor || 0), novaDataFim: dados.novaDataFim || "", dados: copiar(dados.dados || {}), aprovadoPor: contexto.usuarioId, aprovadoEm: agora }; const contrato = { ...anterior, valorAtual: calculo.novoValor, dataFim: calculo.novaDataFim, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; aditivosGestao.push(aditivo); contratosOperacionais.set(contractId, contrato); const resposta = { aditivo: copiar(aditivo), contrato: copiar({ ...contrato, saldo: calcularSaldoContrato(contrato) }) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.aditivo-registrado", entityType: "contrato", entityId: contractId, before: anterior, after: contrato, metadata: aditivo }); return resposta;
    },
    async registrarGarantiaContrato(contextoBruto, contractId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.gerir"); const chave = `${contexto.tenantId}:garantia-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const contrato = contratosOperacionais.get(contractId); if (!contrato || !visivel(contrato, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, tipo: dados.tipo, numero: dados.numero || "", instituicao: dados.instituicao || "", valor: Number(dados.valor || 0), dataInicio: dados.dataInicio || "", dataFim: dados.dataFim || "", status: dados.status || (dados.tipo === "dispensada" ? "dispensada" : "ativa"), dados: copiar(dados.dados || {}), criadoPor: contexto.usuarioId, criadoEm: new Date().toISOString() }; garantiasGestao.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.garantia-registrada", entityType: "contrato", entityId: contractId, after: item }); return copiar(item);
    },
    async registrarOcorrenciaContrato(contextoBruto, contractId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.fiscalizar"); const chave = `${contexto.tenantId}:ocorrencia-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const contrato = contratosOperacionais.get(contractId); if (!contrato || !visivel(contrato, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, dataOcorrencia: dados.dataOcorrencia || agora.slice(0, 10), tipo: dados.tipo || "registro", severidade: dados.severidade || "baixa", descricao: dados.descricao.trim(), providencia: dados.providencia || "", status: dados.status || "aberta", registradoPor: contexto.usuarioId, registradoEm: agora }; ocorrenciasGestao.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.ocorrencia-registrada", entityType: "contrato", entityId: contractId, after: item }); return copiar(item);
    },
    async aplicarSancaoContrato(contextoBruto, contractId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.sancionar"); const chave = `${contexto.tenantId}:sancao-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const contrato = contratosOperacionais.get(contractId); if (!contrato || !visivel(contrato, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); if (dados.occurrenceId && !ocorrenciasGestao.some((x) => x.id === dados.occurrenceId && x.contractId === contractId && visivel(x, contexto))) throw new ApiError(422, "OCORRENCIA_INVALIDA", "A ocorrência não pertence ao contrato."); const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, occurrenceId: dados.occurrenceId || "", tipo: dados.tipo, fundamento: dados.fundamento.trim(), valor: Number(dados.valor || 0), dataAplicacao: dados.dataAplicacao || agora.slice(0, 10), dataFim: dados.dataFim || "", status: "aplicada", aplicadoPor: contexto.usuarioId, aplicadoEm: agora }; sancoesGestao.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.sancao-aplicada", entityType: "contrato", entityId: contractId, after: item }); return copiar(item);
    },
    async registrarExecucaoContrato(contextoBruto, contractId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "contratos.fiscalizar"); const chave = `${contexto.tenantId}:execucao-contrato:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const anterior = contratosOperacionais.get(contractId); if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CONTRATO_NAO_ENCONTRADO", "Contrato não encontrado."); if (anterior.status !== "vigente") throw new ApiError(422, "CONTRATO_NAO_VIGENTE", "Somente contrato vigente recebe execução."); const valor = Number(dados.valor); if (valor <= 0 || valor > calcularSaldoContrato(anterior)) throw new ApiError(422, "EXECUCAO_SUPERIOR_AO_SALDO", "A execução informada ultrapassa o saldo do contrato."); const agora = new Date().toISOString(); const execucao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, contractId, origem: dados.origem || "manual", referenciaId: dados.referenciaId || "", dataExecucao: dados.dataExecucao || agora.slice(0, 10), valor, descricao: dados.descricao || "", registradoPor: contexto.usuarioId, registradoEm: agora }; const contrato = { ...anterior, valorExecutado: anterior.valorExecutado + valor, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; execucoesGestao.push(execucao); contratosOperacionais.set(contractId, contrato); const resposta = { execucao: copiar(execucao), contrato: copiar({ ...contrato, saldo: calcularSaldoContrato(contrato) }) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "contratos", action: "contratos.execucao-registrada", entityType: "contrato", entityId: contractId, before: anterior, after: contrato, metadata: execucao }); return resposta;
    },
    async listarOrcamentos(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.consultar");
      return [...registros.values()].filter((item) => visivel(item, contexto)).map(copiar);
    },
    async obterOrcamento(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.consultar");
      const item = registros.get(id);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
      }
      return copiar(item);
    },
    async criarOrcamento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.editar");
      const chave = `${contexto.tenantId}:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: contexto.teamId,
        nome: dados.nome,
        dados: copiar(dados.dados || {}),
        versao: 1,
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      registros.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, {
        moduleId: "orcamentos",
        action: "orcamento.criado",
        entityType: "orcamento",
        entityId: item.id,
        after: item,
      });
      return copiar(item);
    },
    async atualizarOrcamento(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.editar");
      const item = registros.get(id);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
      }
      if (item.versao !== versaoEsperada) {
        throw new ApiError(412, "VERSAO_DIVERGENTE", "O orçamento foi alterado por outro usuário.");
      }
      const atualizado = {
        ...item,
        nome: dados.nome,
        dados: copiar(dados.dados || {}),
        versao: item.versao + 1,
        atualizadoEm: new Date().toISOString(),
      };
      registros.set(id, atualizado);
      registrarAuditoria(contexto, {
        moduleId: "orcamentos",
        action: "orcamento.atualizado",
        entityType: "orcamento",
        entityId: id,
        before: item,
        after: atualizado,
      });
      return copiar(atualizado);
    },
    async listarEmpreendimentos(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "empreendimento.consultar");
      return [...registrosEmpreendimentos.values()]
        .filter((item) => visivel(item, contexto))
        .map(copiar);
    },
    async criarEmpreendimento(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "empreendimento.editar");
      const chave = `${contexto.tenantId}:empreendimento:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      if (dados.patrimonioUnidadeId) {
        const unidadePatrimonial = unidadesPatrimonio.get(dados.patrimonioUnidadeId);
        if (!unidadePatrimonial || !visivel(unidadePatrimonial, contexto)) {
          throw new ApiError(422, "REFERENCIA_PATRIMONIAL_INVALIDA", "A unidade patrimonial não pertence à empresa e equipe selecionadas.");
        }
      }
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: contexto.teamId,
        unidadeId: dados.unidadeId || "",
        patrimonioUnidadeId: dados.patrimonioUnidadeId || "",
        codigo: dados.codigo || "",
        nome: dados.nome,
        tipo: dados.tipo || "obra",
        status: dados.status || "planejamento",
        dados: copiar(dados.dados || {}),
        versao: 1,
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      registrosEmpreendimentos.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, {
        moduleId: "obras",
        action: "empreendimento.criado",
        entityType: "empreendimento",
        entityId: item.id,
        after: item,
      });
      return copiar(item);
    },
    async listarRevisoes(contextoBruto, orcamentoId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.consultar");
      await this.obterOrcamento(contextoBruto, orcamentoId);
      return [...registrosRevisoes.values()]
        .filter((item) => item.orcamentoId === orcamentoId && visivel(item, contexto))
        .sort((a, b) => b.numero - a.numero)
        .map(copiar);
    },
    async criarRevisao(contextoBruto, orcamentoId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "orcamento.revisar");
      const orcamento = await this.obterOrcamento(contextoBruto, orcamentoId);
      const chave = `${contexto.tenantId}:revisao:${orcamentoId}:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      if ([...registrosRevisoes.values()].some((item) => (
        item.tenantId === contexto.tenantId
        && item.orcamentoId === orcamentoId
        && item.numero === dados.numero
      ))) {
        throw new ApiError(409, "REVISAO_DUPLICADA", "Já existe uma revisão com este número.");
      }
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: orcamento.teamId,
        orcamentoId,
        numero: dados.numero,
        tipo: dados.tipo,
        status: dados.status || "rascunho",
        impactoValor: Number(dados.impactoValor) || 0,
        impactoPrazoDias: Number(dados.impactoPrazoDias) || 0,
        dados: copiar(dados.dados || {}),
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
      };
      registrosRevisoes.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, {
        moduleId: "orcamentos",
        action: "orcamento.revisao-criada",
        entityType: "orcamento",
        entityId: orcamentoId,
        after: item,
      });
      return copiar(item);
    },
    async listarMedicoes(contextoBruto, orcamentoId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "medicao.consultar");
      await this.obterOrcamento(contextoBruto, orcamentoId);
      return [...registrosMedicoes.values()]
        .filter((item) => item.orcamentoId === orcamentoId && visivel(item, contexto))
        .sort((a, b) => b.numero - a.numero)
        .map(copiar);
    },
    async criarMedicao(contextoBruto, orcamentoId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "medicao.registrar");
      const orcamento = await this.obterOrcamento(contextoBruto, orcamentoId);
      const chave = `${contexto.tenantId}:medicao:${orcamentoId}:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      if ([...registrosMedicoes.values()].some((item) => (
        item.tenantId === contexto.tenantId
        && item.orcamentoId === orcamentoId
        && item.numero === dados.numero
      ))) {
        throw new ApiError(409, "MEDICAO_DUPLICADA", "Já existe uma medição com este número.");
      }
      const agora = new Date().toISOString();
      const bruto = Number(dados.valorBruto) || 0;
      const retencoes = Number(dados.retencoes) || 0;
      const multas = Number(dados.multas) || 0;
      if (retencoes + multas > bruto) {
        throw new ApiError(
          422,
          "DEDUCOES_SUPERIORES_AO_BRUTO",
          "Retenções e multas não podem superar o valor bruto da medição.",
        );
      }
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: orcamento.teamId,
        orcamentoId,
        revisaoId: dados.revisaoId || "",
        numero: dados.numero,
        status: dados.status || "rascunho",
        periodoInicio: dados.periodoInicio || "",
        periodoFim: dados.periodoFim || "",
        valorBruto: bruto,
        retencoes,
        multas,
        valorLiquido: bruto - retencoes - multas,
        dados: copiar(dados.dados || {}),
        versao: 1,
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      registrosMedicoes.set(item.id, item);
      idempotencia.set(chave, item);
      registrarAuditoria(contexto, {
        moduleId: "medicoes",
        action: "medicao.criada",
        entityType: "orcamento",
        entityId: orcamentoId,
        after: item,
      });
      return copiar(item);
    },
    async listarPublicacoesCatalogo(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "bases.consultar");
      return [...registrosPublicacoes.values()]
        .filter((item) => (
          (!item.tenantId || item.tenantId === contexto.tenantId)
          && (!filtros.sourceId || item.sourceId === filtros.sourceId)
        ))
        .map(copiar);
    },
    async criarPublicacaoCatalogo(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "bases.administrar");
      const chave = `${contexto.tenantId}:catalogo:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        sourceId: dados.sourceId,
        fonte: dados.fonte,
        gestor: dados.gestor || "",
        referencia: dados.referencia,
        regime: dados.regime || "PADRAO",
        status: "rascunho",
        hashFonte: dados.hashFonte || "",
        arquivoNome: dados.arquivoNome || "",
        contagens: {},
        dados: copiar(dados.dados || {}),
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      registrosPublicacoes.set(item.id, item);
      idempotencia.set(chave, item);
      return copiar(item);
    },
    async salvarItensCatalogo(contextoBruto, publicacaoId, itens, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "bases.administrar");
      const publicacao = registrosPublicacoes.get(publicacaoId);
      if (!publicacao || publicacao.tenantId !== contexto.tenantId) {
        throw new ApiError(404, "PUBLICACAO_NAO_ENCONTRADA", "Publicação não encontrada.");
      }
      const chave = `${contexto.tenantId}:catalogo-itens:${publicacaoId}:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const atuais = itensCatalogo.get(publicacaoId) || [];
      const mapa = new Map(atuais.map((item) => [`${item.tipo}:${item.codigo}`, item]));
      itens.forEach((dados) => {
        const tipo = String(dados.tipo || "insumo");
        const codigo = String(dados.codigo || "").trim();
        if (!codigo) throw new ApiError(422, "ITEM_CATALOGO_INVALIDO", "Item sem código.");
        mapa.set(`${tipo}:${codigo}`, {
          ...copiar(dados),
          id: dados.id || randomUUID(),
          publicationId: publicacaoId,
          tenantId: contexto.tenantId,
          tipo,
          codigo,
        });
      });
      const salvos = [...mapa.values()];
      itensCatalogo.set(publicacaoId, salvos);
      publicacao.contagens = {
        itens: salvos.length,
        composicoes: salvos.filter((item) => item.tipo === "composicao").length,
        insumos: salvos.filter((item) => item.tipo !== "composicao").length,
      };
      publicacao.atualizadoEm = new Date().toISOString();
      const resposta = { publicacaoId, recebidos: itens.length, total: salvos.length };
      idempotencia.set(chave, resposta);
      return copiar(resposta);
    },
    async listarItensCatalogo(contextoBruto, publicacaoId, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "bases.consultar");
      const publicacao = registrosPublicacoes.get(publicacaoId);
      if (!publicacao || (publicacao.tenantId && publicacao.tenantId !== contexto.tenantId)) {
        throw new ApiError(404, "PUBLICACAO_NAO_ENCONTRADA", "Publicação não encontrada.");
      }
      const busca = String(filtros.busca || "").toLocaleLowerCase("pt-BR");
      const filtrados = (itensCatalogo.get(publicacaoId) || []).filter((item) => (
        (!filtros.tipo || filtros.tipo === item.tipo)
        && (!busca || `${item.codigo} ${item.descricao}`.toLocaleLowerCase("pt-BR").includes(busca))
      ));
      const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
      const deslocamento = Math.max(Number(filtros.deslocamento) || 0, 0);
      return {
        itens: copiar(filtrados.slice(deslocamento, deslocamento + limite)),
        total: filtrados.length,
        limite,
        deslocamento,
      };
    },
    async listarComponentesCatalogo(contextoBruto, publicacaoId, codigo) {
      const resultado = await this.listarItensCatalogo(contextoBruto, publicacaoId, {
        tipo: "composicao",
        limite: 500,
      });
      const composicao = resultado.itens.find((item) => item.codigo === codigo);
      if (!composicao) {
        throw new ApiError(404, "COMPOSICAO_NAO_ENCONTRADA", "Composição não encontrada.");
      }
      return copiar(composicao.componentes || []);
    },
    async listarLotesMigracao(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "migracao.administrar");
      return [...registrosLotes.values()]
        .filter((item) => visivel(item, contexto))
        .sort((a, b) => String(b.recebidoEm).localeCompare(String(a.recebidoEm)))
        .map(copiar);
    },
    async receberLoteMigracao(contextoBruto, pacote, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "migracao.administrar");
      if (idempotencyKey !== pacote.idempotencyKey) {
        throw new ApiError(422, "IDEMPOTENCIA_DIVERGENTE", "A chave do cabeçalho diverge do pacote.");
      }
      const avaliacao = validarPacoteNoServidor(pacote, contextoBruto);
      if (!avaliacao.valido) {
        throw new ApiError(422, "PACOTE_MIGRACAO_INVALIDO", "O pacote de migração é inválido.", avaliacao.erros);
      }
      const existente = [...registrosLotes.values()].find((item) => (
        item.tenantId === contexto.tenantId && item.hash === pacote.hash
      ));
      if (existente) return copiar(existente);
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: contexto.teamId,
        contrato: pacote.contrato,
        hash: pacote.hash,
        idempotencyKey,
        status: "recebido",
        contagens: avaliacao.contagens,
        erros: [],
        pacote: copiar(pacote),
        criadoPor: contexto.usuarioId,
        criadoEm: pacote.criadoEm,
        recebidoEm: new Date().toISOString(),
      };
      registrosLotes.set(item.id, item);
      return copiar(item);
    },
    async validarLoteMigracao(contextoBruto, loteId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "migracao.administrar");
      const item = registrosLotes.get(loteId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "LOTE_NAO_ENCONTRADO", "Lote de migração não encontrado.");
      }
      const avaliacao = validarPacoteNoServidor(item.pacote, contextoBruto);
      item.status = avaliacao.valido ? "validado" : "rejeitado";
      item.erros = avaliacao.erros;
      item.validadoPor = contexto.usuarioId;
      item.validadoEm = new Date().toISOString();
      return copiar(item);
    },
    async homologarLoteMigracao(contextoBruto, loteId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "migracao.administrar");
      const lote = registrosLotes.get(loteId);
      if (!lote || !visivel(lote, contexto)) {
        throw new ApiError(404, "LOTE_NAO_ENCONTRADO", "Lote de migração não encontrado.");
      }
      if (lote.status === "homologado") return copiar(lote);
      if (lote.status !== "validado") {
        throw new ApiError(409, "LOTE_NAO_VALIDADO", "Valide o lote antes da homologação.");
      }
      lote.pacote.dominios.forEach((dominio) => {
        dominio.registros.forEach((registro) => {
          if (dominio.id === "orcamentos") {
            const id = registro.id || randomUUID();
            registros.set(id, {
              ...copiar(registro),
              id,
              tenantId: contexto.tenantId,
              teamId: contexto.teamId,
              versao: Number(registro.versao) || 1,
            });
          } else if (dominio.id === "composicoes-proprias") {
            composicoesProprias.set(registro.id || registro.codigo, copiar(registro));
          } else if (dominio.id === "configuracoes") {
            configuracoes.set(registro.id || registro.chave, copiar(registro));
          }
        });
        if (dominio.total > 0) {
          transicoes.set(`${contexto.tenantId}:${dominio.id}`, {
            tenantId: contexto.tenantId,
            teamId: contexto.teamId,
            dominioId: dominio.id,
            modo: "hibrido",
            batchId: lote.id,
            sincronizadoEm: lote.homologadoEm || new Date().toISOString(),
            ativadoPor: contexto.usuarioId,
            atualizadoEm: new Date().toISOString(),
          });
        }
      });
      lote.status = "homologado";
      lote.homologadoPor = contexto.usuarioId;
      lote.homologadoEm = new Date().toISOString();
      return copiar(lote);
    },
    async listarTrabalhos(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "trabalho.consultar");
      return [...registrosTrabalhos.values()]
        .filter((item) => visivel(item, contexto))
        .filter((item) => !filtros.status || item.status === filtros.status)
        .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
        .map(copiar);
    },
    async criarTrabalho(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "trabalho.administrar");
      const avaliacao = validarSolicitacaoTrabalho(dados);
      if (!avaliacao.valido) {
        throw new ApiError(422, "TRABALHO_INVALIDO", "O trabalho solicitado é inválido.", avaliacao.erros);
      }
      const chave = `${contexto.tenantId}:trabalho:${idempotencyKey}`;
      if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: contexto.teamId,
        tipo: dados.tipo,
        status: "pendente",
        prioridade: Number(dados.prioridade) || 50,
        payload: copiar(dados.payload),
        progresso: 0,
        resultado: null,
        erro: null,
        tentativas: 0,
        maxTentativas: Number(dados.maxTentativas) || 3,
        criadoPor: contexto.usuarioId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      registrosTrabalhos.set(item.id, item);
      idempotencia.set(chave, item);
      return copiar(item);
    },
    async iniciarTrabalho(contextoBruto, trabalhoId, workerId) {
      const contexto = validarContexto(contextoBruto);
      const item = registrosTrabalhos.get(trabalhoId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "TRABALHO_NAO_ENCONTRADO", "Trabalho não encontrado.");
      }
      if (item.status !== "pendente") return copiar(item);
      item.status = "processando";
      item.progresso = 1;
      item.tentativas += 1;
      item.bloqueadoPor = workerId;
      item.iniciadoEm = new Date().toISOString();
      item.atualizadoEm = item.iniciadoEm;
      return copiar(item);
    },
    async concluirTrabalho(contextoBruto, trabalhoId, resultado) {
      const contexto = validarContexto(contextoBruto);
      const item = registrosTrabalhos.get(trabalhoId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "TRABALHO_NAO_ENCONTRADO", "Trabalho não encontrado.");
      }
      item.status = "concluido";
      item.progresso = 100;
      item.resultado = copiar(resultado || {});
      item.erro = null;
      item.concluidoEm = new Date().toISOString();
      item.atualizadoEm = item.concluidoEm;
      return copiar(item);
    },
    async falharTrabalho(contextoBruto, trabalhoId, erro) {
      const contexto = validarContexto(contextoBruto);
      const item = registrosTrabalhos.get(trabalhoId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "TRABALHO_NAO_ENCONTRADO", "Trabalho não encontrado.");
      }
      item.status = "falhou";
      item.erro = copiar(erro || {});
      item.concluidoEm = new Date().toISOString();
      item.atualizadoEm = item.concluidoEm;
      return copiar(item);
    },
    async reprocessarTrabalho(contextoBruto, trabalhoId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "trabalho.administrar");
      const item = registrosTrabalhos.get(trabalhoId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "TRABALHO_NAO_ENCONTRADO", "Trabalho não encontrado.");
      }
      if (item.status !== "falhou" || item.tentativas >= item.maxTentativas) {
        throw new ApiError(409, "TRABALHO_NAO_REPROCESSAVEL", "O trabalho não pode ser reprocessado.");
      }
      item.status = "pendente";
      item.progresso = 0;
      item.erro = null;
      item.concluidoEm = null;
      item.atualizadoEm = new Date().toISOString();
      return copiar(item);
    },
    async listarTransicoesRepositorio(contextoBruto) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "migracao.administrar");
      return [...transicoes.values()]
        .filter((item) => visivel(item, contexto))
        .map(copiar);
    },
    async alterarTransicaoRepositorio(contextoBruto, dominioId, modo) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "repositorio.transicionar");
      const chave = `${contexto.tenantId}:${dominioId}`;
      const item = transicoes.get(chave);
      if (!item) {
        throw new ApiError(409, "DOMINIO_NAO_HOMOLOGADO", "Homologue o domínio antes de alterar sua fonte de dados.");
      }
      const permitidas = {
        local: ["hibrido"],
        hibrido: ["local", "corporativo"],
        corporativo: ["hibrido"],
      };
      if (modo !== item.modo && !permitidas[item.modo]?.includes(modo)) {
        throw new ApiError(409, "TRANSICAO_INVALIDA", "A mudança de fonte solicitada não é segura.");
      }
      item.modo = modo;
      item.ativadoPor = contexto.usuarioId;
      item.atualizadoEm = new Date().toISOString();
      return copiar(item);
    },
    async fechar() {},
  };
}
