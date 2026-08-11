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
import { aplicarMovimentoFinanceiro, calcularResumoCompromisso, truncarFinanceiro, validarLimiteOrcamentario } from "../domain/finance.js";
import { calcularMedicao, calcularProgressoObra, resolverTransicaoMedicao, resolverTransicaoObra, validarPeriodoObra } from "../domain/construction.js";
import { avaliarSla, calcularCustoOrdem, calcularVencimentoSla, resolverTransicaoChamado } from "../domain/maintenance.js";
import { calcularResumoConvenio, resolverTransicaoConvenio } from "../domain/agreements.js";
import { calcularNivelRisco, classificarRequisito, sanitizarPublicacao } from "../domain/compliance.js";
import { gerarCredencialPortal, validarEscopoPortal } from "../domain/intelligence.js";
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
  ["medicoes", "obras"], ["manutencao", "patrimonio"], ["documentos", "visao-geral"],
  ["regularidade", "patrimonio"], ["convenios", "visao-geral"],
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
  centrosCustoFinanceiros = [],
  fontesFinanceiras = [],
  orcamentosFinanceiros = [],
  compromissosFinanceiros = [],
  movimentosFinanceiros = [],
  conciliacoesFinanceiras = [],
  cronogramaObras = [],
  diariosObras = [],
  itensMedicoesCorporativas = [],
  decisoesMedicoesCorporativas = [],
  planosManutencao = [],
  chamadosManutencao = [],
  ordensManutencao = [],
  recursosManutencao = [],
  decisoesManutencao = [],
  convenios = [], metasConvenios = [], repassesConvenios = [], execucoesConvenios = [], prestacoesConvenios = [], diligenciasConvenios = [],
  requisitosCompliance = [], riscosCompliance = [], acoesCompliance = [], auditoriasCompliance = [], publicacoesTransparencia = [],
  definicoesRelatorios = [], acessosPortais = [], canaisIntegracao = [],
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
  const centrosCusto = new Map(centrosCustoFinanceiros.map((item) => [item.id, copiar(item)]));
  const fontesRecursos = new Map(fontesFinanceiras.map((item) => [item.id, copiar(item)]));
  const orcamentosExecucao = new Map(orcamentosFinanceiros.map((item) => [item.id, copiar(item)]));
  const compromissosExecucao = new Map(compromissosFinanceiros.map((item) => [item.id, copiar(item)]));
  const movimentosExecucao = movimentosFinanceiros.map(copiar);
  const conciliacoesExecucao = conciliacoesFinanceiras.map(copiar);
  const registrosConvenios = new Map(convenios.map((item) => [item.id, copiar(item)]));
  const registrosMetasConvenios = metasConvenios.map(copiar); const registrosRepassesConvenios = repassesConvenios.map(copiar); const registrosExecucoesConvenios = execucoesConvenios.map(copiar); const registrosPrestacoesConvenios = new Map(prestacoesConvenios.map((item)=>[item.id,copiar(item)])); const registrosDiligenciasConvenios = diligenciasConvenios.map(copiar);
  const registrosRequisitos = new Map(requisitosCompliance.map((item)=>[item.id,copiar(item)])); const registrosRiscos = new Map(riscosCompliance.map((item)=>[item.id,copiar(item)])); const registrosAcoes = new Map(acoesCompliance.map((item)=>[item.id,copiar(item)])); const registrosAuditoriasCompliance = auditoriasCompliance.map(copiar); const registrosPublicacoesTransparencia = new Map(publicacoesTransparencia.map((item)=>[item.id,copiar(item)]));
  const registrosRelatorios = new Map(definicoesRelatorios.map((item)=>[item.id,copiar(item)])); const registrosPortais = new Map(acessosPortais.map((item)=>[item.id,copiar(item)])); const registrosCanais = new Map(canaisIntegracao.map((item)=>[item.id,copiar(item)]));
  const itensCronogramaObras = cronogramaObras.map(copiar);
  const registrosDiarioObras = diariosObras.map(copiar);
  const itensMedicoesObras = itensMedicoesCorporativas.map(copiar);
  const decisoesMedicoesObras = decisoesMedicoesCorporativas.map(copiar);
  const planosFacilities = new Map(planosManutencao.map((item) => [item.id, copiar(item)]));
  const chamadosFacilities = new Map(chamadosManutencao.map((item) => [item.id, copiar(item)]));
  const ordensFacilities = new Map(ordensManutencao.map((item) => [item.id, copiar(item)]));
  const recursosFacilities = recursosManutencao.map(copiar);
  const decisoesFacilities = decisoesManutencao.map(copiar);

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
    async prepararUploadDocumento(contextoBruto, documentoId) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.editar");
      const item = registrosDocumentos.get(documentoId);
      if (!item || !visivel(item, contexto)) {
        throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento não encontrado.");
      }
      return { id: item.id };
    },
    async obterVersaoDocumento(contextoBruto, documentoId, numero) {
      const contexto = validarContexto(contextoBruto);
      exigirPermissao(contexto, "documentos.consultar");
      const item = registrosDocumentos.get(documentoId);
      const versao = item?.versoes?.find((registro) => registro.numero === numero);
      if (!item || !visivel(item, contexto) || !versao) {
        throw new ApiError(404, "VERSAO_DOCUMENTO_NAO_ENCONTRADA", "Versão do documento não encontrada.");
      }
      return copiar(versao);
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
      return copiar({ ...item, caminho: caminhoUnidade(item, contexto), totais: { filhos, ativos, total: filhos + ativos } });
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
    async listarCentrosCustoFinanceiros(contextoBruto) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar");
      return [...centrosCusto.values()].filter((item) => visivel(item, contexto)).sort((a, b) => a.codigo.localeCompare(b.codigo)).map(copiar);
    },
    async criarCentroCustoFinanceiro(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.planejar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:centro-custo-financeiro:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      if ([...centrosCusto.values()].some((item) => visivel(item, contexto) && item.codigo.toUpperCase() === dados.codigo.trim().toUpperCase())) throw new ApiError(409, "CENTRO_CUSTO_DUPLICADO", "Já existe centro de custo com esse código.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, codigo: dados.codigo.trim(), nome: dados.nome.trim(), responsavel: dados.responsavel || "", status: dados.status || "ativo", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      centrosCusto.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "financeiro", action: "financeiro.centro-custo-criado", entityType: "centro-custo", entityId: item.id, after: item }); return copiar(item);
    },
    async listarFontesFinanceiras(contextoBruto) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar");
      return [...fontesRecursos.values()].filter((item) => visivel(item, contexto)).sort((a, b) => a.codigo.localeCompare(b.codigo)).map(copiar);
    },
    async criarFonteFinanceira(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.planejar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:fonte-financeira:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      if ([...fontesRecursos.values()].some((item) => visivel(item, contexto) && item.codigo.toUpperCase() === dados.codigo.trim().toUpperCase())) throw new ApiError(409, "FONTE_FINANCEIRA_DUPLICADA", "Já existe fonte de recursos com esse código.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, codigo: dados.codigo.trim(), nome: dados.nome.trim(), tipo: dados.tipo || "propria", status: dados.status || "ativa", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      fontesRecursos.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "financeiro", action: "financeiro.fonte-criada", entityType: "fonte-recurso", entityId: item.id, after: item }); return copiar(item);
    },
    async listarOrcamentosFinanceiros(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar");
      const compromissos = [...compromissosExecucao.values()].filter((item) => visivel(item, contexto));
      return [...orcamentosExecucao.values()].filter((item) => visivel(item, contexto)).filter((item) => !filtros.ano || item.ano === Number(filtros.ano)).map((item) => {
        const consumido = compromissos.filter((x) => x.budgetId === item.id && x.status !== "cancelado").reduce((s, x) => s + Number(x.valorTotal), 0);
        return copiar({ ...item, valorAtual: truncarFinanceiro(Number(item.valorInicial) + Number(item.ajustes || 0)), consumido: truncarFinanceiro(consumido), disponivel: truncarFinanceiro(Number(item.valorInicial) + Number(item.ajustes || 0) - consumido) });
      }).sort((a, b) => b.ano - a.ano || a.codigo.localeCompare(b.codigo));
    },
    async criarOrcamentoFinanceiro(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.planejar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:orcamento-financeiro:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const centro = centrosCusto.get(dados.costCenterId); const fonte = fontesRecursos.get(dados.fundingSourceId);
      if (!centro || !fonte || !visivel(centro, contexto) || !visivel(fonte, contexto)) throw new ApiError(422, "CLASSIFICACAO_FINANCEIRA_INVALIDA", "Centro de custo ou fonte de recursos inválidos.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, costCenterId: dados.costCenterId, fundingSourceId: dados.fundingSourceId, codigo: dados.codigo.trim(), descricao: dados.descricao.trim(), ano: Number(dados.ano), classificacao: dados.classificacao, valorInicial: truncarFinanceiro(dados.valorInicial), ajustes: truncarFinanceiro(dados.ajustes), valorAtual: truncarFinanceiro(Number(dados.valorInicial) + Number(dados.ajustes || 0)), status: dados.status || "ativo", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      orcamentosExecucao.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "financeiro", action: "financeiro.orcamento-criado", entityType: "orcamento-financeiro", entityId: item.id, after: item }); return copiar({ ...item, consumido: 0, disponivel: item.valorAtual });
    },
    async listarCompromissosFinanceiros(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar");
      return [...compromissosExecucao.values()].filter((item) => visivel(item, contexto)).filter((item) => !filtros.status || item.status === filtros.status).filter((item) => !filtros.budgetId || item.budgetId === filtros.budgetId).map((item) => copiar({ ...item, resumo: calcularResumoCompromisso(item, movimentosExecucao.filter((x) => x.commitmentId === item.id && visivel(x, contexto))) })).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    },
    async obterCompromissoFinanceiro(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar"); const item = compromissosExecucao.get(id);
      if (!item || !visivel(item, contexto)) throw new ApiError(404, "COMPROMISSO_FINANCEIRO_NAO_ENCONTRADO", "Compromisso financeiro não encontrado.");
      const movimentos = movimentosExecucao.filter((x) => x.commitmentId === id && visivel(x, contexto)).sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));
      return copiar({ ...item, resumo: calcularResumoCompromisso(item, movimentos), movimentos: movimentos.map((movimento) => ({ ...movimento, conciliacoes: conciliacoesExecucao.filter((x) => x.movementId === movimento.id && visivel(x, contexto)) })) });
    },
    async criarCompromissoFinanceiro(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.comprometer"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:compromisso-financeiro:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const orçamento = orcamentosExecucao.get(dados.budgetId); if (!orçamento || !visivel(orçamento, contexto) || orçamento.status !== "ativo") throw new ApiError(422, "ORCAMENTO_FINANCEIRO_INVALIDO", "Selecione um orçamento financeiro ativo.");
      const existentes = [...compromissosExecucao.values()].filter((item) => visivel(item, contexto)); validarLimiteOrcamentario(orçamento, existentes, dados.valorTotal);
      const origem = dados.origemTipo || "manual"; let referencia = null;
      if (origem === "pedido") referencia = pedidosSuprimentos.get(dados.origemId);
      if (origem === "contrato") referencia = contratosOperacionais.get(dados.origemId);
      if (origem === "medicao") referencia = registrosMedicoes.get(dados.origemId);
      if (origem !== "manual" && (!referencia || !visivel(referencia, contexto))) throw new ApiError(422, "ORIGEM_FINANCEIRA_INVALIDA", "A origem informada não pertence à empresa e equipe selecionadas.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, budgetId: dados.budgetId, codigo: dados.codigo.trim(), descricao: dados.descricao.trim(), origemTipo: origem, origemId: dados.origemId || "", beneficiario: dados.beneficiario || "", competencia: dados.competencia, dataVencimento: dados.dataVencimento || "", valorTotal: truncarFinanceiro(dados.valorTotal), status: "rascunho", referenciaExterna: dados.referenciaExterna || "", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      compromissosExecucao.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "financeiro", action: "financeiro.compromisso-criado", entityType: "compromisso-financeiro", entityId: item.id, after: item }); return copiar({ ...item, resumo: calcularResumoCompromisso(item, []) });
    },
    async registrarMovimentoFinanceiro(contextoBruto, commitmentId, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const permissao = { reserva: "financeiro.comprometer", compromisso: "financeiro.comprometer", liquidacao: "financeiro.liquidar", pagamento: "financeiro.pagar", cancelamento: "financeiro.comprometer" }[dados.tipo]; exigirPermissao(contexto, permissao || "financeiro.comprometer");
      const chave = `${contexto.tenantId}:movimento-financeiro:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const anterior = compromissosExecucao.get(commitmentId);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "COMPROMISSO_FINANCEIRO_NAO_ENCONTRADO", "Compromisso financeiro não encontrado."); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O compromisso financeiro foi alterado por outro usuário.");
      const movimentos = movimentosExecucao.filter((item) => item.commitmentId === commitmentId && visivel(item, contexto)); const calculo = aplicarMovimentoFinanceiro(anterior, movimentos, dados); const agora = new Date().toISOString();
      const movimento = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, commitmentId, tipo: calculo.tipo, dataMovimento: dados.dataMovimento || agora.slice(0, 10), valor: calculo.valor, retencoes: calculo.retencoes, glosas: calculo.glosas, valorLiquido: truncarFinanceiro(calculo.valor - calculo.retencoes - calculo.glosas), documento: dados.documento || "", referenciaExterna: dados.referenciaExterna || "", justificativa: dados.justificativa || "", dados: copiar(dados.dados || {}), registradoPor: contexto.usuarioId, registradoEm: agora };
      const compromisso = { ...anterior, status: calculo.statusNovo, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; movimentosExecucao.push(movimento); compromissosExecucao.set(commitmentId, compromisso); const resposta = { movimento: copiar(movimento), compromisso: copiar({ ...compromisso, resumo: calcularResumoCompromisso(compromisso, [...movimentos, movimento]) }) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "financeiro", action: `financeiro.${dados.tipo}`, entityType: "compromisso-financeiro", entityId: commitmentId, before: anterior, after: compromisso, metadata: movimento }); return resposta;
    },
    async conciliarMovimentoFinanceiro(contextoBruto, movementId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.conciliar"); const chave = `${contexto.tenantId}:conciliacao-financeira:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const movimento = movimentosExecucao.find((item) => item.id === movementId && visivel(item, contexto)); if (!movimento) throw new ApiError(404, "MOVIMENTO_FINANCEIRO_NAO_ENCONTRADO", "Movimento financeiro não encontrado.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, movementId, referenciaExterna: dados.referenciaExterna.trim(), dataConciliacao: dados.dataConciliacao || agora.slice(0, 10), status: dados.status, diferenca: truncarFinanceiro(dados.diferenca), observacao: dados.observacao || "", conciliadoPor: contexto.usuarioId, conciliadoEm: agora }; conciliacoesExecucao.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "financeiro", action: "financeiro.movimento-conciliado", entityType: "movimento-financeiro", entityId: movementId, after: item }); return copiar(item);
    },
    async obterResumoFinanceiro(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "financeiro.consultar"); const ano = Number(filtros.ano || new Date().getFullYear());
      const orçamentos = [...orcamentosExecucao.values()].filter((item) => visivel(item, contexto) && item.ano === ano); const ids = new Set(orçamentos.map((item) => item.id)); const compromissos = [...compromissosExecucao.values()].filter((item) => visivel(item, contexto) && ids.has(item.budgetId) && item.status !== "cancelado"); const movimentos = movimentosExecucao.filter((item) => visivel(item, contexto) && compromissos.some((x) => x.id === item.commitmentId));
      const totais = compromissos.reduce((resumo, item) => { const calculado = calcularResumoCompromisso(item, movimentos.filter((x) => x.commitmentId === item.id)); resumo.comprometido += Number(item.valorTotal); resumo.liquidado += calculado.liquidadoBruto; resumo.retencoes += calculado.retencoes; resumo.glosas += calculado.glosas; resumo.pago += calculado.pago; return resumo; }, { comprometido: 0, liquidado: 0, retencoes: 0, glosas: 0, pago: 0 });
      const previsto = orçamentos.reduce((s, item) => s + Number(item.valorInicial) + Number(item.ajustes || 0), 0); const perfil = perfisProduto.get(contexto.tenantId)?.perfil || "publico";
      return copiar({ ano, perfil, terminologia: perfil === "publico" ? { orçamento: "Dotação", reserva: "Reserva", compromisso: "Empenho", liquidacao: "Liquidação", pagamento: "Pagamento" } : { orçamento: "Orçamento", reserva: "Reserva", compromisso: "Compromisso", liquidacao: "Aprovação financeira", pagamento: "Pagamento" }, previsto: truncarFinanceiro(previsto), disponivel: truncarFinanceiro(previsto - totais.comprometido), ...Object.fromEntries(Object.entries(totais).map(([k, v]) => [k, truncarFinanceiro(v)])), capex: truncarFinanceiro(orçamentos.filter((x) => x.classificacao === "capex").reduce((s, x) => s + Number(x.valorAtual || x.valorInicial), 0)), opex: truncarFinanceiro(orçamentos.filter((x) => x.classificacao === "opex").reduce((s, x) => s + Number(x.valorAtual || x.valorInicial), 0)) });
    },
    async listarObrasCorporativas(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.consultar");
      return [...registrosEmpreendimentos.values()]
        .filter((item) => visivel(item, contexto) && item.tipo === "obra")
        .filter((item) => !filtros.status || item.status === filtros.status)
        .map((item) => copiar({ ...item, resumo: calcularProgressoObra(item, [...registrosMedicoes.values()].filter((medicao) => medicao.obraId === item.id && visivel(medicao, contexto))) }))
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    },
    async obterObraCorporativa(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.consultar"); const item = registrosEmpreendimentos.get(id);
      if (!item || !visivel(item, contexto) || item.tipo !== "obra") throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada.");
      const medicoesObra = [...registrosMedicoes.values()].filter((medicao) => medicao.obraId === id && visivel(medicao, contexto));
      return copiar({ ...item, resumo: calcularProgressoObra(item, medicoesObra), cronograma: itensCronogramaObras.filter((x) => x.workId === id && visivel(x, contexto)), diario: registrosDiarioObras.filter((x) => x.workId === id && visivel(x, contexto)).sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro)), medicoes: medicoesObra.sort((a, b) => b.numero - a.numero) });
    },
    async criarObraCorporativa(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.editar"); exigirEquipe(contexto);
      const chave = `${contexto.tenantId}:obra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const unidade = unidadesPatrimonio.get(dados.patrimonioUnidadeId); if (!unidade || !visivel(unidade, contexto)) throw new ApiError(422, "LOCAL_OBRA_INVALIDO", "Selecione um local da estrutura patrimonial.");
      if (dados.contractId) { const contrato = contratosOperacionais.get(dados.contractId); if (!contrato || !visivel(contrato, contexto)) throw new ApiError(422, "CONTRATO_OBRA_INVALIDO", "O contrato não pertence à empresa e equipe selecionadas."); }
      if ([...registrosEmpreendimentos.values()].some((x) => visivel(x, contexto) && x.codigo.toUpperCase() === dados.codigo.trim().toUpperCase())) throw new ApiError(409, "CODIGO_OBRA_DUPLICADO", "Já existe obra com esse código.");
      validarPeriodoObra(dados.dataInicio, dados.dataFimPrevista); const agora = new Date().toISOString();
      const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, unidadeId: "", patrimonioUnidadeId: dados.patrimonioUnidadeId, contractId: dados.contractId || "", orcamentoId: dados.orcamentoId || "", codigo: dados.codigo.trim(), nome: dados.nome.trim(), tipo: "obra", status: "planejamento", responsavel: dados.responsavel || "", dataInicio: dados.dataInicio, dataFimPrevista: dados.dataFimPrevista, valorPrevisto: truncarFinanceiro(dados.valorPrevisto), progressoFisico: Number(dados.progressoFisico || 0), dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      registrosEmpreendimentos.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "obras", action: "obras.criada", entityType: "obra", entityId: item.id, after: item }); return copiar({ ...item, resumo: calcularProgressoObra(item, []) });
    },
    async atualizarObraCorporativa(contextoBruto, id, dados, versaoEsperada) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.editar"); const anterior = registrosEmpreendimentos.get(id);
      if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada."); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A obra foi alterada por outro usuário.");
      if (!["planejamento", "em_andamento", "suspensa"].includes(anterior.status)) throw new ApiError(422, "OBRA_NAO_EDITAVEL", "A obra não pode ser editada neste estágio."); validarPeriodoObra(dados.dataInicio, dados.dataFimPrevista);
      const item = { ...anterior, ...copiar(dados), codigo: dados.codigo.trim(), nome: dados.nome.trim(), tipo: "obra", status: anterior.status, valorPrevisto: truncarFinanceiro(dados.valorPrevisto), progressoFisico: Number(dados.progressoFisico || 0), versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() };
      registrosEmpreendimentos.set(id, item); registrarAuditoria(contexto, { moduleId: "obras", action: "obras.atualizada", entityType: "obra", entityId: id, before: anterior, after: item }); return copiar(item);
    },
    async decidirObraCorporativa(contextoBruto, id, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const anterior = registrosEmpreendimentos.get(id); if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada.");
      const chave = `${contexto.tenantId}:decisao-obra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A obra foi alterada por outro usuário.");
      const transicao = resolverTransicaoObra(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao); if (["suspender", "cancelar"].includes(dados.acao) && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa.");
      const item = { ...anterior, status: transicao.para, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: new Date().toISOString() }; registrosEmpreendimentos.set(id, item); const resposta = { obra: copiar(item), decisao: { acao: dados.acao, justificativa: dados.justificativa || "", decididoPor: contexto.usuarioId, decididoEm: item.atualizadoEm } }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "obras", action: `obras.${dados.acao}`, entityType: "obra", entityId: id, before: anterior, after: item, metadata: resposta.decisao }); return resposta;
    },
    async adicionarItemCronogramaObra(contextoBruto, workId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.editar"); const obra = registrosEmpreendimentos.get(workId); if (!obra || !visivel(obra, contexto)) throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada.");
      const chave = `${contexto.tenantId}:cronograma-obra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); validarPeriodoObra(dados.dataInicio, dados.dataFim, "PERIODO_CRONOGRAMA_INVALIDO");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, workId, codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), dataInicio: dados.dataInicio, dataFim: dados.dataFim, peso: Number(dados.peso || 0), progresso: Number(dados.progresso || 0), valorPrevisto: truncarFinanceiro(dados.valorPrevisto), status: dados.status || "planejado", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora }; itensCronogramaObras.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "obras", action: "obras.cronograma-adicionado", entityType: "obra", entityId: workId, after: item }); return copiar(item);
    },
    async registrarDiarioObra(contextoBruto, workId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.fiscalizar"); const obra = registrosEmpreendimentos.get(workId); if (!obra || !visivel(obra, contexto)) throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada.");
      const chave = `${contexto.tenantId}:diario-obra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, workId, dataRegistro: dados.dataRegistro, clima: dados.clima || "", efetivo: Number(dados.efetivo || 0), atividades: dados.atividades.trim(), ocorrencias: dados.ocorrencias || "", evidencias: copiar(dados.evidencias || []), registradoPor: contexto.usuarioId, registradoEm: new Date().toISOString() }; registrosDiarioObras.push(item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "obras", action: "obras.diario-registrado", entityType: "obra", entityId: workId, after: item }); return copiar(item);
    },
    async listarMedicoesObra(contextoBruto, workId) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "medicao.consultar");
      return [...registrosMedicoes.values()].filter((item) => item.obraId === workId && visivel(item, contexto)).map((item) => copiar({ ...item, itens: itensMedicoesObras.filter((x) => x.measurementId === item.id && visivel(x, contexto)), decisoes: decisoesMedicoesObras.filter((x) => x.measurementId === item.id && visivel(x, contexto)) })).sort((a, b) => b.numero - a.numero);
    },
    async criarMedicaoObra(contextoBruto, workId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "medicao.registrar"); const obra = registrosEmpreendimentos.get(workId); if (!obra || !visivel(obra, contexto)) throw new ApiError(404, "OBRA_NAO_ENCONTRADA", "Obra não encontrada.");
      const chave = `${contexto.tenantId}:medicao-obra:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); validarPeriodoObra(dados.periodoInicio, dados.periodoFim, "PERIODO_MEDICAO_INVALIDO");
      const anteriores = [...registrosMedicoes.values()].filter((item) => item.obraId === workId && visivel(item, contexto)); const resumo = calcularProgressoObra(obra, anteriores); const calculo = calcularMedicao(dados, resumo.saldoMedir);
      if (anteriores.some((x) => x.numero === Number(dados.numero))) throw new ApiError(409, "NUMERO_MEDICAO_DUPLICADO", "Já existe medição com esse número na obra.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, obraId: workId, orcamentoId: obra.orcamentoId || "", contratoId: obra.contractId || "", numero: Number(dados.numero), status: "rascunho", periodoInicio: dados.periodoInicio, periodoFim: dados.periodoFim, ...calculo, dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora };
      registrosMedicoes.set(item.id, item); (dados.itens || []).forEach((dadosItem) => itensMedicoesObras.push({ id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, measurementId: item.id, codigo: dadosItem.codigo, descricao: dadosItem.descricao, unidade: dadosItem.unidade || "", quantidadePrevista: Number(dadosItem.quantidadePrevista || 0), quantidadePeriodo: Number(dadosItem.quantidadePeriodo || 0), quantidadeAcumulada: Number(dadosItem.quantidadeAcumulada || 0), valorUnitario: Number(dadosItem.valorUnitario || 0), valorPeriodo: truncarFinanceiro(Number(dadosItem.quantidadePeriodo || 0) * Number(dadosItem.valorUnitario || 0)), criadoPor: contexto.usuarioId, criadoEm: agora })); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "medicoes", action: "medicao.criada", entityType: "medicao", entityId: item.id, after: item }); return copiar(item);
    },
    async decidirMedicaoObra(contextoBruto, measurementId, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const anterior = registrosMedicoes.get(measurementId); if (!anterior || !visivel(anterior, contexto) || !anterior.obraId) throw new ApiError(404, "MEDICAO_NAO_ENCONTRADA", "Medição não encontrada.");
      const chave = `${contexto.tenantId}:decisao-medicao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "A medição foi alterada por outro usuário."); const transicao = resolverTransicaoMedicao(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao);
      if (["glosar", "devolver", "cancelar"].includes(dados.acao) && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a justificativa da decisão."); const agora = new Date().toISOString(); const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, measurementId, acao: dados.acao, statusAnterior: anterior.status, statusNovo: transicao.para, justificativa: dados.justificativa || "", decididoPor: contexto.usuarioId, decididoEm: agora }; const item = { ...anterior, status: transicao.para, enviadoEm: dados.acao === "enviar" ? agora : anterior.enviadoEm, aprovadoPor: dados.acao === "aprovar" ? contexto.usuarioId : anterior.aprovadoPor, aceiteEm: dados.acao === "aceitar" ? agora : anterior.aceiteEm, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; registrosMedicoes.set(measurementId, item); decisoesMedicoesObras.push(decisao); const resposta = { medicao: copiar(item), decisao: copiar(decisao) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "medicoes", action: `medicao.${dados.acao}`, entityType: "medicao", entityId: measurementId, before: anterior, after: item, metadata: decisao }); return resposta;
    },
    async obterResumoObras(contextoBruto) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "obras.consultar"); const obras = [...registrosEmpreendimentos.values()].filter((x) => visivel(x, contexto) && x.tipo === "obra"); const medicoesObra = [...registrosMedicoes.values()].filter((x) => x.obraId && visivel(x, contexto));
      return { total: obras.length, emAndamento: obras.filter((x) => x.status === "em_andamento").length, atencao: obras.filter((x) => x.status === "suspensa" || (x.dataFimPrevista && x.dataFimPrevista < new Date().toISOString().slice(0, 10) && x.status !== "concluida")).length, valorPrevisto: truncarFinanceiro(obras.reduce((s, x) => s + Number(x.valorPrevisto || 0), 0)), valorMedido: truncarFinanceiro(medicoesObra.filter((x) => ["aprovada", "aceita"].includes(x.status)).reduce((s, x) => s + Number(x.valorBruto || 0), 0)), medicoesPendentes: medicoesObra.filter((x) => x.status === "em_analise").length };
    },
    async listarPlanosManutencao(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.consultar"); return [...planosFacilities.values()].filter((x) => visivel(x, contexto)).filter((x) => !filtros.status || x.status === filtros.status).sort((a, b) => a.proximaExecucao.localeCompare(b.proximaExecucao)).map(copiar);
    },
    async criarPlanoManutencao(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.planejar"); exigirEquipe(contexto); const chave = `${contexto.tenantId}:plano-manutencao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const unidade = dados.patrimonioUnidadeId ? unidadesPatrimonio.get(dados.patrimonioUnidadeId) : null; const ativo = dados.ativoId ? ativosPatrimonio.get(dados.ativoId) : null; if ((!unidade && !ativo) || (unidade && !visivel(unidade, contexto)) || (ativo && !visivel(ativo, contexto))) throw new ApiError(422, "REFERENCIA_MANUTENCAO_INVALIDA", "Selecione um espaço ou ativo válido.");
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, patrimonioUnidadeId: dados.patrimonioUnidadeId || ativo?.salaId || "", ativoId: dados.ativoId || "", codigo: dados.codigo.trim(), nome: dados.nome.trim(), especialidade: dados.especialidade || "predial", periodicidadeDias: Number(dados.periodicidadeDias), proximaExecucao: dados.proximaExecucao, responsavel: dados.responsavel || "", status: dados.status || "ativo", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora }; planosFacilities.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "manutencao", action: "manutencao.plano-criado", entityType: "plano-manutencao", entityId: item.id, after: item }); return copiar(item);
    },
    async listarChamadosManutencao(contextoBruto, filtros = {}) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.consultar"); return [...chamadosFacilities.values()].filter((x) => visivel(x, contexto)).filter((x) => !filtros.status || x.status === filtros.status).filter((x) => !filtros.prioridade || x.prioridade === filtros.prioridade).map((x) => copiar({ ...x, situacaoSla: avaliarSla(x) })).sort((a, b) => a.slaVencimento.localeCompare(b.slaVencimento));
    },
    async obterChamadoManutencao(contextoBruto, id) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.consultar"); const item = chamadosFacilities.get(id); if (!item || !visivel(item, contexto)) throw new ApiError(404, "CHAMADO_NAO_ENCONTRADO", "Chamado de manutenção não encontrado."); const ordens = [...ordensFacilities.values()].filter((x) => x.ticketId === id && visivel(x, contexto)).map((ordem) => ({ ...ordem, recursos: recursosFacilities.filter((x) => x.workOrderId === ordem.id && visivel(x, contexto)) })); return copiar({ ...item, situacaoSla: avaliarSla(item), ordens, decisoes: decisoesFacilities.filter((x) => x.ticketId === id && visivel(x, contexto)) });
    },
    async criarChamadoManutencao(contextoBruto, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.editar"); exigirEquipe(contexto); const chave = `${contexto.tenantId}:chamado-manutencao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave));
      const unidade = unidadesPatrimonio.get(dados.patrimonioUnidadeId); const ativo = dados.ativoId ? ativosPatrimonio.get(dados.ativoId) : null; if (!unidade || !visivel(unidade, contexto) || (ativo && (!visivel(ativo, contexto) || ativo.salaId !== unidade.id))) throw new ApiError(422, "REFERENCIA_MANUTENCAO_INVALIDA", "O local ou ativo não pertence à empresa e equipe selecionadas.");
      if (dados.planoId) { const plano = planosFacilities.get(dados.planoId); if (!plano || !visivel(plano, contexto)) throw new ApiError(422, "PLANO_MANUTENCAO_INVALIDO", "O plano preventivo não pertence à empresa e equipe selecionadas."); }
      const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, patrimonioUnidadeId: dados.patrimonioUnidadeId, ativoId: dados.ativoId || "", planoId: dados.planoId || "", codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), tipo: dados.tipo || "corretiva", prioridade: dados.prioridade || "media", status: "aberto", solicitante: dados.solicitante || contexto.usuarioId, responsavel: dados.responsavel || "", abertoEm: agora, slaVencimento: calcularVencimentoSla(dados.prioridade || "media", agora), resolvidoEm: "", fechadoEm: "", solucao: "", aceite: "", dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora }; chamadosFacilities.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "manutencao", action: "manutencao.chamado-aberto", entityType: "chamado-manutencao", entityId: item.id, after: item }); return copiar({ ...item, situacaoSla: avaliarSla(item) });
    },
    async decidirChamadoManutencao(contextoBruto, id, dados, versaoEsperada, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); const anterior = chamadosFacilities.get(id); if (!anterior || !visivel(anterior, contexto)) throw new ApiError(404, "CHAMADO_NAO_ENCONTRADO", "Chamado de manutenção não encontrado."); const chave = `${contexto.tenantId}:decisao-manutencao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); if (anterior.versao !== versaoEsperada) throw new ApiError(412, "VERSAO_DIVERGENTE", "O chamado foi alterado por outro usuário."); const transicao = resolverTransicaoChamado(anterior.status, dados.acao); exigirPermissao(contexto, transicao.permissao);
      if (["resolver", "fechar", "cancelar"].includes(dados.acao) && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422, "JUSTIFICATIVA_OBRIGATORIA", "Informe a solução, aceite ou justificativa."); const agora = new Date().toISOString(); const item = { ...anterior, status: transicao.para, responsavel: dados.responsavel || anterior.responsavel, solucao: dados.acao === "resolver" ? dados.justificativa : anterior.solucao, aceite: dados.acao === "fechar" ? dados.justificativa : anterior.aceite, resolvidoEm: dados.acao === "resolver" ? agora : anterior.resolvidoEm, fechadoEm: dados.acao === "fechar" ? agora : anterior.fechadoEm, versao: anterior.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: agora }; const decisao = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, ticketId: id, acao: dados.acao, statusAnterior: anterior.status, statusNovo: transicao.para, justificativa: dados.justificativa || "", decididoPor: contexto.usuarioId, decididoEm: agora }; chamadosFacilities.set(id, item); decisoesFacilities.push(decisao); const resposta = { chamado: copiar({ ...item, situacaoSla: avaliarSla(item) }), decisao: copiar(decisao) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "manutencao", action: `manutencao.${dados.acao}`, entityType: "chamado-manutencao", entityId: id, before: anterior, after: item, metadata: decisao }); return resposta;
    },
    async criarOrdemManutencao(contextoBruto, ticketId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.atender"); const chamado = chamadosFacilities.get(ticketId); if (!chamado || !visivel(chamado, contexto)) throw new ApiError(404, "CHAMADO_NAO_ENCONTRADO", "Chamado de manutenção não encontrado."); const chave = `${contexto.tenantId}:ordem-manutencao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const agora = new Date().toISOString(); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, ticketId, codigo: dados.codigo.trim(), equipe: dados.equipe || "", fornecedorId: dados.fornecedorId || "", dataProgramada: dados.dataProgramada || "", iniciadoEm: "", concluidoEm: "", status: dados.dataProgramada ? "programada" : "aberta", diagnostico: dados.diagnostico || "", servicoExecutado: "", custoTotal: 0, dados: copiar(dados.dados || {}), versao: 1, criadoPor: contexto.usuarioId, atualizadoPor: contexto.usuarioId, criadoEm: agora, atualizadoEm: agora }; ordensFacilities.set(item.id, item); idempotencia.set(chave, item); registrarAuditoria(contexto, { moduleId: "manutencao", action: "manutencao.ordem-criada", entityType: "ordem-manutencao", entityId: item.id, after: item }); return copiar(item);
    },
    async adicionarRecursoOrdemManutencao(contextoBruto, workOrderId, dados, idempotencyKey) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.atender"); const ordem = ordensFacilities.get(workOrderId); if (!ordem || !visivel(ordem, contexto)) throw new ApiError(404, "ORDEM_NAO_ENCONTRADA", "Ordem de serviço não encontrada."); const chave = `${contexto.tenantId}:recurso-manutencao:${idempotencyKey}`; if (idempotencia.has(chave)) return copiar(idempotencia.get(chave)); const item = { id: randomUUID(), tenantId: contexto.tenantId, teamId: contexto.teamId, workOrderId, tipo: dados.tipo, descricao: dados.descricao.trim(), unidade: dados.unidade || "", quantidade: Number(dados.quantidade), valorUnitario: Number(dados.valorUnitario || 0), valorTotal: truncarFinanceiro(Number(dados.quantidade) * Number(dados.valorUnitario || 0)), registradoPor: contexto.usuarioId, registradoEm: new Date().toISOString() }; recursosFacilities.push(item); const recursos = recursosFacilities.filter((x) => x.workOrderId === workOrderId && visivel(x, contexto)); const atualizada = { ...ordem, custoTotal: calcularCustoOrdem(recursos), versao: ordem.versao + 1, atualizadoPor: contexto.usuarioId, atualizadoEm: item.registradoEm }; ordensFacilities.set(workOrderId, atualizada); const resposta = { recurso: copiar(item), ordem: copiar(atualizada) }; idempotencia.set(chave, resposta); registrarAuditoria(contexto, { moduleId: "manutencao", action: "manutencao.recurso-registrado", entityType: "ordem-manutencao", entityId: workOrderId, after: item }); return resposta;
    },
    async obterResumoManutencao(contextoBruto) {
      const contexto = validarContexto(contextoBruto); exigirPermissao(contexto, "manutencao.consultar"); const chamados = [...chamadosFacilities.values()].filter((x) => visivel(x, contexto)); const ordens = [...ordensFacilities.values()].filter((x) => visivel(x, contexto)); const planos = [...planosFacilities.values()].filter((x) => visivel(x, contexto)); return { abertos: chamados.filter((x) => !["fechado", "cancelado"].includes(x.status)).length, criticos: chamados.filter((x) => x.prioridade === "critica" && !["fechado", "cancelado"].includes(x.status)).length, slaViolado: chamados.filter((x) => avaliarSla(x) === "violado").length, preventivasProximas: planos.filter((x) => x.status === "ativo" && x.proximaExecucao <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)).length, custoOrdens: truncarFinanceiro(ordens.reduce((s, x) => s + Number(x.custoTotal || 0), 0)), concluidos: chamados.filter((x) => x.status === "fechado").length };
    },
    async listarConvenios(contextoBruto, filtros={}) { const c=validarContexto(contextoBruto); exigirPermissao(c,"convenios.consultar"); return [...registrosConvenios.values()].filter(x=>visivel(x,c)&&(!filtros.status||x.status===filtros.status)).map(x=>copiar({...x,resumo:calcularResumoConvenio(x,registrosMetasConvenios.filter(y=>y.agreementId===x.id),registrosRepassesConvenios.filter(y=>y.agreementId===x.id),registrosExecucoesConvenios.filter(y=>y.agreementId===x.id),registrosDiligenciasConvenios.filter(y=>y.agreementId===x.id))})); },
    async obterConvenio(contextoBruto,id) { const c=validarContexto(contextoBruto); exigirPermissao(c,"convenios.consultar"); const x=registrosConvenios.get(id); if(!x||!visivel(x,c))throw new ApiError(404,"CONVENIO_NAO_ENCONTRADO","Convênio não encontrado."); const metas=registrosMetasConvenios.filter(y=>y.agreementId===id&&visivel(y,c));const repasses=registrosRepassesConvenios.filter(y=>y.agreementId===id&&visivel(y,c));const execucoes=registrosExecucoesConvenios.filter(y=>y.agreementId===id&&visivel(y,c));const diligencias=registrosDiligenciasConvenios.filter(y=>y.agreementId===id&&visivel(y,c));return copiar({...x,metas,repasses,execucoes,prestacoes:[...registrosPrestacoesConvenios.values()].filter(y=>y.agreementId===id&&visivel(y,c)),diligencias,resumo:calcularResumoConvenio(x,metas,repasses,execucoes,diligencias)}); },
    async criarConvenio(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.editar");exigirEquipe(c);const chave=`${c.tenantId}:convenio:${idempotencyKey}`;if(idempotencia.has(chave))return copiar(idempotencia.get(chave));if(dados.dataFim<dados.dataInicio)throw new ApiError(422,"VIGENCIA_CONVENIO_INVALIDA","O fim da vigência deve ser posterior ao início.");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,codigo:dados.codigo.trim(),numero:dados.numero||"",titulo:dados.titulo.trim(),programa:dados.programa||"",concedente:dados.concedente.trim(),convenente:dados.convenente.trim(),objeto:dados.objeto.trim(),dataInicio:dados.dataInicio,dataFim:dados.dataFim,valorRepasse:truncarFinanceiro(dados.valorRepasse),valorContrapartida:truncarFinanceiro(dados.valorContrapartida),status:"rascunho",dados:copiar(dados.dados||{}),versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosConvenios.set(x.id,x);idempotencia.set(chave,x);registrarAuditoria(c,{moduleId:"convenios",action:"convenios.criado",entityType:"convenio",entityId:x.id,after:x});return copiar(x); },
    async decidirConvenio(contextoBruto,id,dados,versao,idempotencyKey) { const c=validarContexto(contextoBruto);const x=registrosConvenios.get(id);if(!x||!visivel(x,c))throw new ApiError(404,"CONVENIO_NAO_ENCONTRADO","Convênio não encontrado.");if(x.versao!==versao)throw new ApiError(412,"VERSAO_DIVERGENTE","O convênio foi alterado por outro usuário.");const t=resolverTransicaoConvenio(x.status,dados.acao);exigirPermissao(c,t.permissao);const novo={...x,status:t.para,versao:x.versao+1,atualizadoPor:c.usuarioId,atualizadoEm:new Date().toISOString()};registrosConvenios.set(id,novo);registrarAuditoria(c,{moduleId:"convenios",action:`convenios.${dados.acao}`,entityType:"convenio",entityId:id,before:x,after:novo});return copiar(novo); },
    async adicionarMetaConvenio(contextoBruto,id,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.editar");await this.obterConvenio(contextoBruto,id);const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,agreementId:id,codigo:dados.codigo.trim(),descricao:dados.descricao.trim(),unidade:dados.unidade||"",quantidadePrevista:Number(dados.quantidadePrevista||0),valorPrevisto:truncarFinanceiro(dados.valorPrevisto),inicioPrevisto:dados.inicioPrevisto||"",fimPrevisto:dados.fimPrevisto||"",status:dados.status||"planejada",dados:copiar(dados.dados||{}),criadoPor:c.usuarioId,criadoEm:new Date().toISOString()};registrosMetasConvenios.push(x);return copiar(x); },
    async registrarRepasseConvenio(contextoBruto,id,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.executar");await this.obterConvenio(contextoBruto,id);const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,agreementId:id,...copiar(dados),valor:truncarFinanceiro(dados.valor),registradoPor:c.usuarioId,registradoEm:new Date().toISOString()};registrosRepassesConvenios.push(x);return copiar(x); },
    async registrarExecucaoConvenio(contextoBruto,id,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.executar");const convenio=await this.obterConvenio(contextoBruto,id);const valor=truncarFinanceiro(dados.valorExecutado);if(valor>convenio.resumo.saldoExecutar)throw new ApiError(422,"EXECUCAO_CONVENIO_SUPERIOR_SALDO","A execução ultrapassa o saldo do convênio.");const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,agreementId:id,...copiar(dados),quantidadeExecutada:Number(dados.quantidadeExecutada||0),valorExecutado:valor,registradoPor:c.usuarioId,registradoEm:new Date().toISOString()};registrosExecucoesConvenios.push(x);return copiar(x); },
    async criarPrestacaoConvenio(contextoBruto,id,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.prestar-contas");await this.obterConvenio(contextoBruto,id);const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,agreementId:id,...copiar(dados),valorInformado:truncarFinanceiro(dados.valorInformado),status:"rascunho",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosPrestacoesConvenios.set(x.id,x);return copiar(x); },
    async decidirPrestacaoConvenio(contextoBruto,id,dados,versao) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.prestar-contas");const x=registrosPrestacoesConvenios.get(id);if(!x||!visivel(x,c))throw new ApiError(404,"PRESTACAO_NAO_ENCONTRADA","Prestação de contas não encontrada.");if(x.versao!==versao)throw new ApiError(412,"VERSAO_DIVERGENTE","A prestação foi alterada.");const fluxo={rascunho:{submeter:"submetida"},submetida:{analisar:"em_analise"},em_analise:{aprovar:"aprovada",rejeitar:"rejeitada"}};const status=fluxo[x.status]?.[dados.acao];if(!status)throw new ApiError(422,"TRANSICAO_PRESTACAO_INVALIDA","A decisão não é permitida neste estágio.");const novo={...x,status,protocolo:dados.protocolo||x.protocolo,parecer:dados.parecer||x.parecer,versao:x.versao+1,atualizadoPor:c.usuarioId,atualizadoEm:new Date().toISOString()};registrosPrestacoesConvenios.set(id,novo);return copiar(novo); },
    async criarDiligenciaConvenio(contextoBruto,id,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"convenios.prestar-contas");await this.obterConvenio(contextoBruto,id);const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,agreementId:id,...copiar(dados),status:"aberta",criadoPor:c.usuarioId,criadoEm:new Date().toISOString()};registrosDiligenciasConvenios.push(x);return copiar(x); },
    async obterResumoConvenios(contextoBruto) { const itens=await this.listarConvenios(contextoBruto);return{total:itens.length,vigentes:itens.filter(x=>["vigente","em_execucao"].includes(x.status)).length,prestacaoContas:itens.filter(x=>x.status==="prestacao_contas").length,valorTotal:truncarFinanceiro(itens.reduce((s,x)=>s+x.resumo.valorTotal,0)),executado:truncarFinanceiro(itens.reduce((s,x)=>s+x.resumo.executado,0)),diligenciasAbertas:itens.reduce((s,x)=>s+x.resumo.diligenciasAbertas,0)}; },

    async listarRequisitosCompliance(contextoBruto,filtros={}) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.consultar");return [...registrosRequisitos.values()].filter(x=>visivel(x,c)).map(x=>copiar({...x,status:classificarRequisito(x)})).filter(x=>!filtros.status||x.status===filtros.status); },
    async criarRequisitoCompliance(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.editar");exigirEquipe(c);const unidade=unidadesPatrimonio.get(dados.patrimonioUnidadeId);if(!unidade||!visivel(unidade,c))throw new ApiError(422,"LOCAL_COMPLIANCE_INVALIDO","Selecione um local patrimonial válido.");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),status:classificarRequisito(dados),dados:copiar(dados.dados||{}),versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosRequisitos.set(x.id,x);return copiar(x); },
    async listarRiscosCompliance(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.consultar");return [...registrosRiscos.values()].filter(x=>visivel(x,c)).map(copiar); },
    async criarRiscoCompliance(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.editar");const nivel=calcularNivelRisco(dados.probabilidade,dados.impacto);const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),...nivel,status:dados.status||"aberto",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosRiscos.set(x.id,x);return copiar(x); },
    async criarAcaoCompliance(contextoBruto,riskId,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.editar");const risco=registrosRiscos.get(riskId);if(!risco||!visivel(risco,c))throw new ApiError(404,"RISCO_NAO_ENCONTRADO","Risco não encontrado.");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,riskId,...copiar(dados),percentual:Number(dados.percentual||0),status:dados.status||"aberta",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosAcoes.set(x.id,x);return copiar(x); },
    async registrarAuditoriaCompliance(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.auditar");const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),registradoPor:c.usuarioId,registradoEm:new Date().toISOString()};registrosAuditoriasCompliance.push(x);return copiar(x); },
    async listarPublicacoesTransparencia(contextoBruto,{publicas=false}={}) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.consultar");return [...registrosPublicacoesTransparencia.values()].filter(x=>visivel(x,c)&&(!publicas||x.status==="publicada")).map(x=>publicas?sanitizarPublicacao(x):copiar(x)); },
    async criarPublicacaoTransparencia(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"regularidade.editar");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),status:"rascunho",publicadoEm:"",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosPublicacoesTransparencia.set(x.id,x);return copiar(x); },
    async publicarTransparencia(contextoBruto,id,versao) { const c=validarContexto(contextoBruto);exigirPermissao(c,"transparencia.publicar");const x=registrosPublicacoesTransparencia.get(id);if(!x||!visivel(x,c))throw new ApiError(404,"PUBLICACAO_NAO_ENCONTRADA","Publicação não encontrada.");if(x.versao!==versao)throw new ApiError(412,"VERSAO_DIVERGENTE","A publicação foi alterada.");const novo={...x,status:"publicada",publicadoEm:new Date().toISOString(),versao:x.versao+1,atualizadoPor:c.usuarioId};registrosPublicacoesTransparencia.set(id,novo);return copiar(novo); },
    async obterResumoCompliance(contextoBruto) { const req=await this.listarRequisitosCompliance(contextoBruto);const riscos=await this.listarRiscosCompliance(contextoBruto);const c=validarContexto(contextoBruto);const acoes=[...registrosAcoes.values()].filter(x=>visivel(x,c));return{requisitos:req.length,regulares:req.filter(x=>x.status==="regular").length,aVencer:req.filter(x=>x.status==="a_vencer").length,vencidos:req.filter(x=>x.status==="vencido").length,riscosCriticos:riscos.filter(x=>x.nivel>=20&&x.status!=="encerrado").length,acoesVencidas:acoes.filter(x=>!["concluida","cancelada"].includes(x.status)&&x.prazo<new Date().toISOString().slice(0,10)).length,auditorias:registrosAuditoriasCompliance.filter(x=>visivel(x,c)).length}; },

    async obterPainelExecutivo(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"relatorios.consultar");const obras=[...registrosEmpreendimentos.values()].filter(x=>visivel(x,c)&&x.tipo==="obra");const contratos=[...contratosOperacionais.values()].filter(x=>visivel(x,c));const financeiro=await this.obterResumoFinanceiro(contextoBruto).catch(()=>({previsto:0,comprometido:0,pago:0}));const convenios=await this.obterResumoConvenios(contextoBruto).catch(()=>({total:0,valorTotal:0,executado:0}));const compliance=await this.obterResumoCompliance(contextoBruto).catch(()=>({vencidos:0,riscosCriticos:0}));return{geradoEm:new Date().toISOString(),carteira:{obras:obras.length,obrasEmAndamento:obras.filter(x=>x.status==="em_andamento").length,contratos:contratos.length,contratosVigentes:contratos.filter(x=>x.status==="vigente").length},financeiro,convenios,compliance,manutencao:{abertos:[...chamadosFacilities.values()].filter(x=>visivel(x,c)&&!["fechado","cancelado"].includes(x.status)).length},seguranca:{isolamento:"RLS",auditoria:"encadeada",segredos:"referenciados"}}; },
    async listarDefinicoesRelatorios(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"relatorios.consultar");return [...registrosRelatorios.values()].filter(x=>visivel(x,c)).map(copiar); },
    async criarDefinicaoRelatorio(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"relatorios.configurar");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),status:"ativo",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosRelatorios.set(x.id,x);return copiar(x); },
    async listarAcessosPortais(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"portais.consultar");return [...registrosPortais.values()].filter(x=>visivel(x,c)).map(({tokenHash,...x})=>copiar(x)); },
    async criarAcessoPortal(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"portais.administrar");validarEscopoPortal(dados.tipo,dados.escopo||{});const cred=gerarCredencialPortal();const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),tokenHash:cred.tokenHash,tokenPrefixo:cred.tokenPrefixo,status:"ativo",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosPortais.set(x.id,x);return{...copiar(x),tokenHash:undefined,token:cred.token}; },
    async revogarAcessoPortal(contextoBruto,id,versao) { const c=validarContexto(contextoBruto);exigirPermissao(c,"portais.administrar");const x=registrosPortais.get(id);if(!x||!visivel(x,c))throw new ApiError(404,"ACESSO_PORTAL_NAO_ENCONTRADO","Acesso de portal não encontrado.");if(x.versao!==versao)throw new ApiError(412,"VERSAO_DIVERGENTE","O acesso foi alterado.");const novo={...x,status:"revogado",versao:x.versao+1,atualizadoPor:c.usuarioId,atualizadoEm:new Date().toISOString()};registrosPortais.set(id,novo);return copiar(novo); },
    async listarCanaisIntegracao(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"integracoes.consultar");return [...registrosCanais.values()].filter(x=>visivel(x,c)).map(copiar); },
    async criarCanalIntegracao(contextoBruto,dados,idempotencyKey) { const c=validarContexto(contextoBruto);exigirPermissao(c,"integracoes.administrar");const agora=new Date().toISOString();const x={id:randomUUID(),tenantId:c.tenantId,teamId:c.teamId,...copiar(dados),status:"configuracao",versao:1,criadoPor:c.usuarioId,atualizadoPor:c.usuarioId,criadoEm:agora,atualizadoEm:agora};registrosCanais.set(x.id,x);return copiar(x); },
    async obterObservabilidade(contextoBruto) { const c=validarContexto(contextoBruto);exigirPermissao(c,"observabilidade.consultar");return{status:"operacional",banco:"disponivel",rls:"ativo",fila:{pendentes:[...registrosTrabalhos.values()].filter(x=>visivel(x,c)&&x.status==="pendente").length,falhos:[...registrosTrabalhos.values()].filter(x=>visivel(x,c)&&x.status==="falhou").length},integracoes:{total:[...registrosCanais.values()].filter(x=>visivel(x,c)).length,comErro:[...registrosCanais.values()].filter(x=>visivel(x,c)&&x.status==="erro").length},verificadoEm:new Date().toISOString()}; },
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
