import pg from "pg";
import { randomUUID } from "node:crypto";
import { ApiError } from "../errors.js";
import { PERMISSOES_PLATAFORMA } from "../domain/platform.js";
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

const { Pool } = pg;

const TIPOS_CATALOGO = new Set([
  "composicao",
  "insumo",
  "mao_obra",
  "material",
  "equipamento",
  "servico_auxiliar",
]);

function normalizarTipoCatalogo(valor = "insumo") {
  const texto = String(valor || "insumo")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
  if (texto.includes("compos")) return "composicao";
  if (texto.includes("mao") || texto.includes("m_o")) return "mao_obra";
  if (texto.includes("equip")) return "equipamento";
  if (texto.includes("material")) return "material";
  if (texto.includes("servico")) return "servico_auxiliar";
  return TIPOS_CATALOGO.has(texto) ? texto : "insumo";
}

function chaveFontePrivada(tenantId, sourceId) {
  const origem = String(sourceId || "BASE")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-");
  return `${tenantId}:${origem}`;
}

function mapearPublicacao(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id || "",
    sourceId: linha.source_id,
    fonte: linha.fonte,
    gestor: linha.gestor || "",
    referencia: linha.referencia,
    regime: linha.regime,
    status: linha.status,
    hashFonte: linha.hash_fonte || "",
    arquivoNome: linha.arquivo_nome || "",
    contagens: linha.contagens || {},
    dados: linha.dados || {},
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearLote(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    contrato: linha.contrato,
    hash: linha.hash,
    idempotencyKey: linha.idempotency_key,
    status: linha.status,
    contagens: linha.contagens || {},
    erros: linha.erros || [],
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    recebidoEm: linha.recebido_em,
    validadoPor: linha.validado_por || "",
    validadoEm: linha.validado_em || "",
    homologadoPor: linha.homologado_por || "",
    homologadoEm: linha.homologado_em || "",
  };
}

function mapearOrcamento(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    nome: linha.nome,
    dados: linha.dados,
    versao: Number(linha.versao),
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearEmpreendimento(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    unidadeId: linha.unidade_id || "",
    patrimonioUnidadeId: linha.patrimonio_unidade_id || "",
    codigo: linha.codigo || "",
    nome: linha.nome,
    tipo: linha.tipo,
    status: linha.status,
    dados: linha.dados,
    versao: Number(linha.versao),
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearRevisao(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    orcamentoId: linha.orcamento_id,
    numero: linha.numero,
    tipo: linha.tipo,
    status: linha.status,
    impactoValor: Number(linha.impacto_valor) || 0,
    impactoPrazoDias: Number(linha.impacto_prazo_dias) || 0,
    dados: linha.dados,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
  };
}

function mapearMedicao(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    orcamentoId: linha.orcamento_id,
    revisaoId: linha.revisao_id || "",
    numero: linha.numero,
    status: linha.status,
    periodoInicio: linha.periodo_inicio || "",
    periodoFim: linha.periodo_fim || "",
    valorBruto: Number(linha.valor_bruto) || 0,
    retencoes: Number(linha.retencoes) || 0,
    multas: Number(linha.multas) || 0,
    valorLiquido: Number(linha.valor_liquido) || 0,
    dados: linha.dados,
    versao: Number(linha.versao),
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearTrabalho(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    tipo: linha.tipo,
    status: linha.status,
    prioridade: Number(linha.prioridade),
    payload: linha.payload || {},
    progresso: Number(linha.progresso) || 0,
    resultado: linha.resultado || null,
    erro: linha.erro || null,
    tentativas: Number(linha.tentativas) || 0,
    maxTentativas: Number(linha.max_tentativas) || 0,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
    iniciadoEm: linha.iniciado_em || "",
    concluidoEm: linha.concluido_em || "",
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearTransicao(linha) {
  return {
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    dominioId: linha.dominio_id,
    modo: linha.modo,
    batchId: linha.batch_id || "",
    sincronizadoEm: linha.sincronizado_em || "",
    ativadoPor: linha.ativado_por,
    ativadoEm: linha.ativado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearUnidadePatrimonial(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "",
    parentId: linha.parent_id || "", nivel: linha.nivel, codigo: linha.codigo,
    nome: linha.nome, status: linha.status, endereco: linha.endereco || {},
    areaM2: linha.area_m2 === null ? null : Number(linha.area_m2),
    responsavel: linha.responsavel || "", ocupacao: linha.ocupacao || "",
    dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por,
    atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearAtivoPatrimonial(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", salaId: linha.sala_id,
    codigo: linha.codigo, nome: linha.nome, categoria: linha.categoria,
    numeroPatrimonio: linha.numero_patrimonio || "", fabricante: linha.fabricante || "",
    modelo: linha.modelo || "", numeroSerie: linha.numero_serie || "", status: linha.status,
    dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por,
    atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearMovimentacaoPatrimonial(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", assetId: linha.asset_id,
    origemSalaId: linha.origem_sala_id, destinoSalaId: linha.destino_sala_id,
    motivo: linha.motivo, movimentadoPor: linha.movimentado_por, movimentadoEm: linha.movimentado_em,
  };
}

function mapearProgramaInvestimento(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "",
    codigo: linha.codigo, nome: linha.nome, objetivo: linha.objetivo || "",
    anoInicio: linha.ano_inicio === null ? null : Number(linha.ano_inicio),
    anoFim: linha.ano_fim === null ? null : Number(linha.ano_fim),
    limiteFinanceiro: Number(linha.limite_financeiro) || 0, status: linha.status,
    dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por,
    atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearItemCarteiraInvestimento(linha) {
  return {
    tenantId: linha.tenant_id, teamId: linha.team_id || "", portfolioId: linha.portfolio_id,
    demandId: linha.demand_id, ordem: Number(linha.ordem), valorPlanejado: Number(linha.valor_planejado) || 0,
    observacao: linha.observacao || "", incorporadoPor: linha.incorporado_por, incorporadoEm: linha.incorporado_em,
  };
}

function mapearCarteiraInvestimento(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "",
    codigo: linha.codigo, nome: linha.nome, ano: Number(linha.ano),
    limiteFinanceiro: Number(linha.limite_financeiro) || 0, status: linha.status,
    dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por,
    atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearDemandaInvestimento(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "",
    patrimonioUnidadeId: linha.patrimonio_unidade_id, programaId: linha.programa_id || "",
    codigo: linha.codigo, titulo: linha.titulo, descricao: linha.descricao || "", solicitante: linha.solicitante || "",
    categoria: linha.categoria, valorEstimado: Number(linha.valor_estimado) || 0,
    dataDesejada: linha.data_desejada || "", urgencia: Number(linha.urgencia), impacto: Number(linha.impacto),
    risco: Number(linha.risco), alinhamento: Number(linha.alinhamento), pontuacao: Number(linha.pontuacao),
    status: linha.status, dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por,
    atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearDecisaoDemanda(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", demandId: linha.demand_id,
    acao: linha.acao, statusAnterior: linha.status_anterior, statusNovo: linha.status_novo,
    justificativa: linha.justificativa || "", decididoPor: linha.decidido_por, decididoEm: linha.decidido_em,
  };
}

function mapearFornecedor(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", codigo: linha.codigo, razaoSocial: linha.razao_social, nomeFantasia: linha.nome_fantasia || "", documento: linha.documento || "", email: linha.email || "", telefone: linha.telefone || "", status: linha.status, qualificacao: linha.qualificacao, dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por, atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em };
}

function mapearProcessoContratacao(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", demandId: linha.demand_id || "", orcamentoId: linha.orcamento_id || "", codigo: linha.codigo, titulo: linha.titulo, objeto: linha.objeto, tipo: linha.tipo, regime: linha.regime, criterioJulgamento: linha.criterio_julgamento, valorEstimado: Number(linha.valor_estimado) || 0, status: linha.status, estudoTecnico: linha.estudo_tecnico || {}, riscos: linha.riscos || [], termoReferencia: linha.termo_referencia || {}, dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por, atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em };
}

function mapearCotacao(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", processId: linha.process_id, supplierId: linha.supplier_id, dataProposta: linha.data_proposta, validadeDias: Number(linha.validade_dias), prazoEntregaDias: Number(linha.prazo_entrega_dias), valorTotal: Number(linha.valor_total), status: linha.status, justificativa: linha.justificativa || "", proposta: linha.proposta || {}, criadoPor: linha.criado_por, criadoEm: linha.criado_em };
}

function mapearDecisaoContratacao(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", processId: linha.process_id, acao: linha.acao, statusAnterior: linha.status_anterior, statusNovo: linha.status_novo, justificativa: linha.justificativa || "", dados: linha.dados || {}, decididoPor: linha.decidido_por, decididoEm: linha.decidido_em };
}

function mapearPedidoCompra(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", processId: linha.process_id, supplierId: linha.supplier_id, quoteId: linha.quote_id || "", codigo: linha.codigo, valorTotal: Number(linha.valor_total), dataEmissao: linha.data_emissao, dataPrevista: linha.data_prevista || "", status: linha.status, valorRecebido: Number(linha.valor_recebido) || 0, dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por, atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em };
}

function mapearRecebimentoCompra(linha) {
  return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", orderId: linha.order_id, dataRecebimento: linha.data_recebimento, valorRecebido: Number(linha.valor_recebido), aceite: linha.aceite, observacao: linha.observacao || "", recebidoPor: linha.recebido_por, recebidoEm: linha.recebido_em };
}

function mapearContrato(linha) {
  const item = { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", processId: linha.process_id, supplierId: linha.supplier_id, codigo: linha.codigo, numero: linha.numero, titulo: linha.titulo, objeto: linha.objeto, tipoInstrumento: linha.tipo_instrumento, regime: linha.regime, dataAssinatura: linha.data_assinatura || "", dataInicio: linha.data_inicio, dataFim: linha.data_fim, valorInicial: Number(linha.valor_inicial), valorAtual: Number(linha.valor_atual), valorExecutado: Number(linha.valor_executado) || 0, status: linha.status, dados: linha.dados || {}, versao: Number(linha.versao), criadoPor: linha.criado_por, atualizadoPor: linha.atualizado_por, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em };
  return { ...item, saldo: calcularSaldoContrato(item) };
}
function mapearResponsavelContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, papel: linha.papel, nome: linha.nome, documento: linha.documento || "", email: linha.email || "", dataInicio: linha.data_inicio, dataFim: linha.data_fim || "", atoDesignacao: linha.ato_designacao || "", criadoPor: linha.criado_por, criadoEm: linha.criado_em }; }
function mapearAditivoContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, numero: linha.numero, tipo: linha.tipo, justificativa: linha.justificativa, valor: Number(linha.valor) || 0, novaDataFim: linha.nova_data_fim || "", dados: linha.dados || {}, aprovadoPor: linha.aprovado_por, aprovadoEm: linha.aprovado_em }; }
function mapearGarantiaContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, tipo: linha.tipo, numero: linha.numero || "", instituicao: linha.instituicao || "", valor: Number(linha.valor) || 0, dataInicio: linha.data_inicio || "", dataFim: linha.data_fim || "", status: linha.status, dados: linha.dados || {}, criadoPor: linha.criado_por, criadoEm: linha.criado_em }; }
function mapearOcorrenciaContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, dataOcorrencia: linha.data_ocorrencia, tipo: linha.tipo, severidade: linha.severidade, descricao: linha.descricao, providencia: linha.providencia || "", status: linha.status, registradoPor: linha.registrado_por, registradoEm: linha.registrado_em }; }
function mapearSancaoContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, occurrenceId: linha.occurrence_id || "", tipo: linha.tipo, fundamento: linha.fundamento, valor: Number(linha.valor) || 0, dataAplicacao: linha.data_aplicacao, dataFim: linha.data_fim || "", status: linha.status, aplicadoPor: linha.aplicado_por, aplicadoEm: linha.aplicado_em }; }
function mapearExecucaoContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, origem: linha.origem, referenciaId: linha.referencia_id || "", dataExecucao: linha.data_execucao, valor: Number(linha.valor), descricao: linha.descricao || "", registradoPor: linha.registrado_por, registradoEm: linha.registrado_em }; }
function mapearDecisaoContrato(linha) { return { id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", contractId: linha.contract_id, acao: linha.acao, statusAnterior: linha.status_anterior, statusNovo: linha.status_novo, justificativa: linha.justificativa || "", dados: linha.dados || {}, decididoPor: linha.decidido_por, decididoEm: linha.decidido_em }; }

function adicionarCaminhosPatrimoniais(itens) {
  const porId = new Map(itens.map((item) => [item.id, item]));
  return itens.map((item) => {
    const caminho = [];
    const visitados = new Set();
    let atual = item;
    while (atual && !visitados.has(atual.id)) {
      visitados.add(atual.id);
      caminho.unshift({ id: atual.id, nivel: atual.nivel, codigo: atual.codigo, nome: atual.nome });
      atual = atual.parentId ? porId.get(atual.parentId) : null;
    }
    return { ...item, caminho };
  });
}

function mapearAuditoria(linha) {
  return {
    id: linha.id,
    tenantId: linha.tenant_id,
    teamId: linha.team_id || "",
    sequencia: Number(linha.sequencia),
    moduleId: linha.module_id,
    acao: linha.acao,
    entidadeTipo: linha.entidade_tipo,
    entidadeId: linha.entidade_id,
    usuarioId: linha.usuario_id,
    resultado: linha.resultado,
    antes: linha.antes ?? null,
    depois: linha.depois ?? null,
    metadados: linha.metadados || {},
    hashAnterior: linha.hash_anterior,
    hash: linha.hash,
    criadoEm: linha.criado_em,
  };
}

function mapearPoliticaAuditoria(linha) {
  return {
    tenantId: linha.tenant_id,
    retencaoDias: Number(linha.retencao_dias),
    frequenciaBackup: linha.frequencia_backup,
    ultimoBackupEm: linha.ultimo_backup_em || "",
    ultimoBackupHash: linha.ultimo_backup_hash || "",
    ultimoTesteRestauracaoEm: linha.ultimo_teste_restauracao_em || "",
    ultimoTesteRestauracaoOk: linha.ultimo_teste_restauracao_ok,
    atualizadoPor: linha.atualizado_por,
    atualizadoEm: linha.atualizado_em,
  };
}

function mapearDocumento(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, teamId: linha.team_id || "", titulo: linha.titulo,
    tipo: linha.tipo, status: linha.status, versaoAtual: Number(linha.versao_atual),
    metadados: linha.metadados || {}, versoes: linha.versoes || [], vinculos: linha.vinculos || [], criadoPor: linha.criado_por,
    criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function mapearIntegracao(linha) {
  return {
    id: linha.id, tenantId: linha.tenant_id, nome: linha.nome, provedor: linha.provedor,
    status: linha.status, credentialReference: linha.credential_reference ? "configurada" : "",
    configuracao: linha.configuracao || {}, execucoes: linha.execucoes || [], criadoPor: linha.criado_por,
    criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

export function criarRepositorioPostgres({
  connectionString,
  ssl = false,
  pool: poolInjetado,
} = {}) {
  if (!connectionString && !poolInjetado) {
    throw new Error("A conexão PostgreSQL não foi configurada.");
  }
  const pool = poolInjetado || new Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: true } : false,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });

  async function comContexto(contexto, operacao) {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const ativacao = await cliente.query(
        "SELECT * FROM app.ativar_contexto($1, $2, $3)",
        [contexto.tenantId, contexto.identity?.subject, contexto.teamId || null],
      );
      if (!ativacao.rows[0]) {
        throw new ApiError(403, "EMPRESA_NAO_AUTORIZADA", "O usuário não pertence à empresa selecionada.");
      }
      const validado = {
        tenantId: contexto.tenantId,
        teamId: contexto.teamId || "",
        usuarioId: contexto.identity.subject,
        tenantNome: ativacao.rows[0].tenant_nome,
        perfilId: ativacao.rows[0].perfil_id,
      };
      const permissoesResultado = await cliente.query(
        `SELECT d.permission_id, coalesce(o.permitido, true) AS permitido
           FROM app.default_profile_permissions d
           LEFT JOIN app.tenant_profile_permissions o
             ON o.tenant_id = $1
            AND o.perfil_id = d.perfil_id
            AND o.permission_id = d.permission_id
          WHERE d.perfil_id = $2
         UNION
         SELECT o.permission_id, o.permitido
           FROM app.tenant_profile_permissions o
          WHERE o.tenant_id = $1
            AND o.perfil_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM app.default_profile_permissions d
               WHERE d.perfil_id = o.perfil_id
                 AND d.permission_id = o.permission_id
            )`,
        [validado.tenantId, validado.perfilId],
      );
      validado.permissoes = permissoesResultado.rows
        .filter((item) => item.permitido)
        .map((item) => item.permission_id);
      const modulosResultado = await cliente.query(
        `SELECT m.id, m.nome, m.ordem
           FROM app.modules m
           LEFT JOIN app.tenant_module_contracts c
             ON c.tenant_id = $1 AND c.module_id = m.id
          WHERE m.status = 'ativo'
            AND coalesce(c.disponivel AND c.contratado AND c.habilitado, true)
            AND (
              NOT EXISTS (
                SELECT 1 FROM app.tenant_modules x WHERE x.tenant_id = $1
              )
              OR EXISTS (
                SELECT 1 FROM app.tenant_modules x
                 WHERE x.tenant_id = $1 AND x.module_id = m.id AND x.status = 'ativo'
              )
            )
          ORDER BY m.ordem`,
        [validado.tenantId],
      );
      const modulosPermitidos = new Set(
        PERMISSOES_PLATAFORMA
          .filter((item) => validado.permissoes.includes(item.id))
          .map((item) => item.moduloId),
      );
      validado.modulos = modulosResultado.rows.filter((item) => modulosPermitidos.has(item.id));
      const resultado = await operacao(cliente, validado);
      await cliente.query("COMMIT");
      return resultado;
    } catch (error) {
      await cliente.query("ROLLBACK");
      if (error?.code === "42501") {
        throw new ApiError(403, "EMPRESA_NAO_AUTORIZADA", "O usuário não pertence à empresa ou equipe selecionada.");
      }
      if (error?.code === "23505") {
        throw new ApiError(409, "REGISTRO_DUPLICADO", "Já existe um registro com a mesma identificação.");
      }
      if (error?.code === "23514" || error?.code === "23503") {
        throw new ApiError(422, "INTEGRIDADE_INVALIDA", "O registro viola uma regra de integridade do domínio.");
      }
      throw error;
    } finally {
      cliente.release();
    }
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

  async function obterIdempotente(cliente, tenantId, chave) {
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${tenantId}:${chave}`],
    );
    const anterior = await cliente.query(
      `SELECT resposta FROM app.idempotency_keys
        WHERE tenant_id = $1 AND chave = $2 AND expira_em > now()`,
      [tenantId, chave],
    );
    return anterior.rows[0]?.resposta || null;
  }

  async function salvarIdempotencia(cliente, contexto, chave, resposta) {
    await cliente.query(
      `INSERT INTO app.idempotency_keys (tenant_id, chave, resposta, criado_por)
       VALUES ($1, $2, $3, $4)`,
      [contexto.tenantId, chave, resposta, contexto.usuarioId],
    );
  }

  async function registrarAuditoria(cliente, contexto, {
    moduleId,
    action,
    entityType,
    entityId,
    result = "sucesso",
    before = null,
    after = null,
    metadata = {},
  }) {
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`auditoria:${contexto.tenantId}`],
    );
    const anterior = await cliente.query(
      `SELECT hash FROM app.audit_events
        WHERE tenant_id = $1
        ORDER BY sequencia DESC
        LIMIT 1`,
      [contexto.tenantId],
    );
    const hashAnterior = anterior.rows[0]?.hash || "0".repeat(64);
    const criadoEm = new Date().toISOString();
    const evento = {
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
    const hash = criarHashAuditoria(evento, hashAnterior);
    await cliente.query(
      `INSERT INTO app.audit_events
        (tenant_id, id, team_id, module_id, acao, entidade_tipo, entidade_id,
         usuario_id, resultado, antes, depois, metadados, hash_anterior, hash, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        contexto.tenantId,
        randomUUID(),
        contexto.teamId || null,
        moduleId,
        action,
        entityType,
        String(entityId),
        contexto.usuarioId,
        result,
        evento.before,
        evento.after,
        evento.metadata,
        hashAnterior,
        hash,
        criadoEm,
      ],
    );
  }

  async function registrarEvento(cliente, contexto, {
    moduleId,
    eventType,
    aggregateType,
    aggregateId,
    payload = {},
    before = null,
    after = null,
  }) {
    await cliente.query(
      `INSERT INTO app.domain_events
        (tenant_id, id, module_id, event_type, aggregate_type, aggregate_id, payload, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        contexto.tenantId,
        randomUUID(),
        moduleId,
        eventType,
        aggregateType,
        aggregateId,
        payload,
        contexto.usuarioId,
      ],
    );
    await registrarAuditoria(cliente, contexto, {
      moduleId,
      action: eventType,
      entityType: aggregateType,
      entityId: aggregateId,
      before,
      after: after ?? payload,
      metadata: { origem: "evento-dominio" },
    });
  }

  return {
    tipo: "postgres",
    async health() {
      const inicio = Date.now();
      await pool.query("SELECT 1");
      return { ok: true, banco: "PostgreSQL", latenciaMs: Date.now() - inicio };
    },
    async validarContexto(contexto) {
      return comContexto(contexto, async (_cliente, validado) => validado);
    },
    async listarAuditoria(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "auditoria.consultar");
        const consulta = normalizarFiltrosAuditoria(filtros);
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, sequencia, module_id, acao,
                  entidade_tipo, entidade_id, usuario_id, resultado, antes,
                  depois, metadados, hash_anterior, hash, criado_em,
                  count(*) OVER()::integer AS total
             FROM app.audit_events
            WHERE ($1::text IS NULL OR module_id = $1)
              AND ($2::text IS NULL OR acao ILIKE '%' || $2 || '%')
              AND ($3::text IS NULL OR usuario_id ILIKE '%' || $3 || '%')
              AND ($4::text IS NULL OR entidade_tipo = $4)
              AND ($5::text IS NULL OR entidade_id = $5)
              AND ($6::timestamptz IS NULL OR criado_em >= $6)
              AND ($7::timestamptz IS NULL OR criado_em <= $7)
            ORDER BY sequencia DESC
            LIMIT $8 OFFSET $9`,
          [
            consulta.moduleId || null,
            consulta.action || null,
            consulta.actorId || null,
            consulta.entityType || null,
            consulta.entityId || null,
            consulta.dataInicial || null,
            consulta.dataFinal || null,
            consulta.limite,
            consulta.deslocamento,
          ],
        );
        const itens = resultado.rows.map(mapearAuditoria);
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
          createdAt: new Date(item.criadoEm).toISOString(),
        }, item.hashAnterior) !== item.hash);
        return {
          itens,
          total: Number(resultado.rows[0]?.total || 0),
          limite: consulta.limite,
          deslocamento: consulta.deslocamento,
          integridade: { ok: invalidos.length === 0, invalidos: invalidos.length },
        };
      });
    },
    async obterPoliticaAuditoria(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "auditoria.consultar");
        const resultado = await cliente.query(
          `INSERT INTO app.audit_policies (tenant_id, atualizado_por)
           VALUES ($1, $2)
           ON CONFLICT (tenant_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
           RETURNING tenant_id, retencao_dias, frequencia_backup,
                     ultimo_backup_em, ultimo_backup_hash,
                     ultimo_teste_restauracao_em, ultimo_teste_restauracao_ok,
                     atualizado_por, atualizado_em`,
          [validado.tenantId, validado.usuarioId],
        );
        return mapearPoliticaAuditoria(resultado.rows[0]);
      });
    },
    async atualizarPoliticaAuditoria(contexto, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "auditoria.administrar");
        const anterior = await cliente.query(
          "SELECT * FROM app.audit_policies WHERE tenant_id = $1",
          [validado.tenantId],
        );
        const politicaAnterior = anterior.rows[0]
          ? mapearPoliticaAuditoria(anterior.rows[0])
          : null;
        const recuperacao = {
          ultimoBackupEm: dados.ultimoBackupEm ?? politicaAnterior?.ultimoBackupEm ?? null,
          ultimoBackupHash: dados.ultimoBackupHash ?? politicaAnterior?.ultimoBackupHash ?? null,
          ultimoTesteRestauracaoEm: dados.ultimoTesteRestauracaoEm
            ?? politicaAnterior?.ultimoTesteRestauracaoEm ?? null,
          ultimoTesteRestauracaoOk: dados.ultimoTesteRestauracaoOk
            ?? politicaAnterior?.ultimoTesteRestauracaoOk ?? null,
        };
        const resultado = await cliente.query(
          `INSERT INTO app.audit_policies
            (tenant_id, retencao_dias, frequencia_backup,
             ultimo_backup_em, ultimo_backup_hash,
             ultimo_teste_restauracao_em, ultimo_teste_restauracao_ok,
             atualizado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tenant_id) DO UPDATE
             SET retencao_dias = EXCLUDED.retencao_dias,
                 frequencia_backup = EXCLUDED.frequencia_backup,
                 ultimo_backup_em = EXCLUDED.ultimo_backup_em,
                 ultimo_backup_hash = EXCLUDED.ultimo_backup_hash,
                 ultimo_teste_restauracao_em = EXCLUDED.ultimo_teste_restauracao_em,
                 ultimo_teste_restauracao_ok = EXCLUDED.ultimo_teste_restauracao_ok,
                 atualizado_por = EXCLUDED.atualizado_por,
                 atualizado_em = now()
           RETURNING tenant_id, retencao_dias, frequencia_backup,
                     ultimo_backup_em, ultimo_backup_hash,
                     ultimo_teste_restauracao_em, ultimo_teste_restauracao_ok,
                     atualizado_por, atualizado_em`,
          [
            validado.tenantId,
            dados.retencaoDias,
            dados.frequenciaBackup,
            recuperacao.ultimoBackupEm || null,
            recuperacao.ultimoBackupHash || null,
            recuperacao.ultimoTesteRestauracaoEm || null,
            recuperacao.ultimoTesteRestauracaoOk,
            validado.usuarioId,
          ],
        );
        const resposta = mapearPoliticaAuditoria(resultado.rows[0]);
        await registrarAuditoria(cliente, validado, {
          moduleId: "administracao",
          action: dados.ultimoTesteRestauracaoEm
            ? "auditoria.recuperacao-registrada"
            : "auditoria.politica-atualizada",
          entityType: "politica-auditoria",
          entityId: validado.tenantId,
          before: politicaAnterior,
          after: resposta,
        });
        return resposta;
      });
    },
    async listarDocumentos(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "documentos.consultar");
        const resultado = await cliente.query(
          `SELECT d.*, coalesce(v.versoes, '[]'::jsonb) AS versoes,
                  coalesce(l.vinculos, '[]'::jsonb) AS vinculos
             FROM app.documents d
             LEFT JOIN LATERAL (
               SELECT jsonb_agg(jsonb_build_object(
                 'numero', dv.numero, 'nomeArquivo', dv.nome_arquivo, 'tipoMime', dv.tipo_mime,
                 'tamanhoBytes', dv.tamanho_bytes, 'sha256', dv.sha256,
                 'storageKey', dv.storage_key, 'responsavel', dv.responsavel,
                 'metadados', dv.metadados, 'criadoEm', dv.criado_em
               ) ORDER BY dv.numero DESC) AS versoes
               FROM app.document_versions dv
              WHERE dv.tenant_id = d.tenant_id AND dv.document_id = d.id
             ) v ON true
             LEFT JOIN LATERAL (
               SELECT jsonb_agg(jsonb_build_object(
                 'moduleId', dl.module_id, 'entidadeTipo', dl.entidade_tipo,
                 'entidadeId', dl.entidade_id, 'criadoEm', dl.criado_em
               ) ORDER BY dl.criado_em DESC) AS vinculos
               FROM app.document_links dl
              WHERE dl.tenant_id = d.tenant_id AND dl.document_id = d.id
             ) l ON true
            WHERE d.tenant_id = $1 ORDER BY d.atualizado_em DESC`,
          [validado.tenantId],
        );
        return resultado.rows.map(mapearDocumento);
      });
    },
    async criarDocumento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "documentos.editar");
        const anterior = await obterIdempotente(cliente, validado.tenantId, idempotencyKey);
        if (anterior) return anterior;
        const id = randomUUID();
        const resultado = await cliente.query(
          `INSERT INTO app.documents (tenant_id,id,team_id,titulo,tipo,status,metadados,criado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [validado.tenantId,id,validado.teamId || null,dados.titulo,dados.tipo || "documento_tecnico",dados.status || "rascunho",dados.metadados || {},validado.usuarioId],
        );
        const item = mapearDocumento({ ...resultado.rows[0], versoes: [], vinculos: [] });
        await salvarIdempotencia(cliente, validado, idempotencyKey, item);
        await registrarAuditoria(cliente, validado, { moduleId:"documentos",action:"documento.criado",entityType:"documento",entityId:id,after:item });
        return item;
      });
    },
    async adicionarVersaoDocumento(contexto, documentoId, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "documentos.editar");
        const documento = await cliente.query("SELECT * FROM app.documents WHERE tenant_id=$1 AND id=$2 FOR UPDATE", [validado.tenantId,documentoId]);
        if (!documento.rows[0]) throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento não encontrado.");
        const numero = Number(documento.rows[0].versao_atual) + 1;
        await cliente.query(`INSERT INTO app.document_versions
          (tenant_id,document_id,numero,nome_arquivo,tipo_mime,tamanho_bytes,sha256,storage_key,responsavel,metadados)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [validado.tenantId,documentoId,numero,dados.nomeArquivo,dados.tipoMime || "application/octet-stream",dados.tamanhoBytes || 0,dados.sha256,dados.storageKey,validado.usuarioId,dados.metadados || {}]);
        const atualizado = await cliente.query("UPDATE app.documents SET versao_atual=$3,atualizado_em=now() WHERE tenant_id=$1 AND id=$2 RETURNING *", [validado.tenantId,documentoId,numero]);
        await registrarAuditoria(cliente, validado, { moduleId:"documentos",action:"documento.versao-adicionada",entityType:"documento",entityId:documentoId,metadata:{ numero,sha256:dados.sha256 } });
        return mapearDocumento({ ...atualizado.rows[0], versoes: [], vinculos: [] });
      });
    },
    async vincularDocumento(contexto, documentoId, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "documentos.editar");
        const documento = await cliente.query("SELECT 1 FROM app.documents WHERE tenant_id=$1 AND id=$2", [validado.tenantId, documentoId]);
        if (!documento.rows[0]) throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento não encontrado.");
        const resultado = await cliente.query(
          `INSERT INTO app.document_links (tenant_id,document_id,module_id,entidade_tipo,entidade_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id,document_id,module_id,entidade_tipo,entidade_id)
           DO UPDATE SET entidade_id=EXCLUDED.entidade_id
           RETURNING module_id,entidade_tipo,entidade_id,criado_em`,
          [validado.tenantId, documentoId, dados.moduleId, dados.entidadeTipo, dados.entidadeId],
        );
        const linha = resultado.rows[0];
        const vinculo = { moduleId:linha.module_id,entidadeTipo:linha.entidade_tipo,entidadeId:linha.entidade_id,criadoEm:linha.criado_em };
        await registrarAuditoria(cliente,validado,{moduleId:"documentos",action:"documento.vinculado",entityType:"documento",entityId:documentoId,metadata:vinculo});
        return vinculo;
      });
    },
    async listarIntegracoes(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "integracoes.consultar");
        const resultado = await cliente.query(`SELECT i.*, coalesce(r.execucoes, '[]'::jsonb) AS execucoes
          FROM app.integrations i LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object('id',ir.id,'status',ir.status,'direcao',ir.direcao,'contagens',ir.contagens,'erroSanitizado',ir.erro_sanitizado,'iniciadoEm',ir.iniciado_em,'concluidoEm',ir.concluido_em) ORDER BY ir.iniciado_em DESC) execucoes
            FROM app.integration_runs ir WHERE ir.tenant_id=i.tenant_id AND ir.integration_id=i.id
          ) r ON true WHERE i.tenant_id=$1 ORDER BY i.nome`, [validado.tenantId]);
        return resultado.rows.map(mapearIntegracao);
      });
    },
    async criarIntegracao(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "integracoes.administrar");
        const anterior = await obterIdempotente(cliente, validado.tenantId, idempotencyKey);
        if (anterior) return anterior;
        const id = randomUUID();
        const resultado = await cliente.query(`INSERT INTO app.integrations
          (tenant_id,id,nome,provedor,status,credential_reference,configuracao,criado_por)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [validado.tenantId,id,dados.nome,dados.provedor,dados.status || "inativa",dados.credentialReference || "",dados.configuracao || {},validado.usuarioId]);
        const item = mapearIntegracao({ ...resultado.rows[0], execucoes: [] });
        await salvarIdempotencia(cliente, validado, idempotencyKey, item);
        await registrarAuditoria(cliente, validado, { moduleId:"administracao",action:"integracao.criada",entityType:"integracao",entityId:id,after:item });
        return item;
      });
    },
    async registrarExecucaoIntegracao(contexto, integracaoId, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "integracoes.administrar");
        const id = randomUUID();
        const resultado = await cliente.query(`INSERT INTO app.integration_runs
          (tenant_id,id,integration_id,status,direcao,contagens,erro_sanitizado,executado_por,concluido_em)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $4='iniciada' THEN NULL ELSE now() END) RETURNING *`, [validado.tenantId,id,integracaoId,dados.status || "iniciada",dados.direcao || "entrada",dados.contagens || {},dados.erroSanitizado || "",validado.usuarioId]);
        await registrarAuditoria(cliente, validado, { moduleId:"administracao",action:"integracao.executada",entityType:"integracao",entityId:integracaoId,metadata:{ execucaoId:id,status:resultado.rows[0].status } });
        return { id,status:resultado.rows[0].status,direcao:resultado.rows[0].direcao,contagens:resultado.rows[0].contagens,erroSanitizado:resultado.rows[0].erro_sanitizado,iniciadoEm:resultado.rows[0].iniciado_em };
      });
    },
    async obterProdutoModular(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "produto-modular.consultar");
        const [perfil,modulos,catalogo] = await Promise.all([
          cliente.query("SELECT * FROM app.tenant_product_profiles WHERE tenant_id=$1",[validado.tenantId]),
          cliente.query(`SELECT m.id,m.nome,m.ordem,c.disponivel,c.contratado,c.habilitado,c.pacote,c.limites,
            coalesce((SELECT jsonb_agg(jsonb_build_object('id',mc.capability_id,'nome',mc.nome)) FROM app.module_capabilities mc WHERE mc.module_id=m.id AND mc.status='ativa'),'[]'::jsonb) capacidades,
            coalesce((SELECT jsonb_agg(jsonb_build_object('moduleId',md.depends_on_module_id,'obrigatoria',md.obrigatoria)) FROM app.module_dependencies md WHERE md.module_id=m.id),'[]'::jsonb) dependencias
            FROM app.modules m LEFT JOIN app.tenant_module_contracts c ON c.tenant_id=$1 AND c.module_id=m.id ORDER BY m.ordem`,[validado.tenantId]),
          cliente.query("SELECT max(versao) versao FROM app.module_catalog_versions WHERE status='publicada'"),
        ]);
        const p = perfil.rows[0] || { tenant_id:validado.tenantId,perfil:"publico",terminologia:{},templates:{} };
        return { versaoCatalogo:Number(catalogo.rows[0]?.versao)||1,perfil:{tenantId:p.tenant_id,perfil:p.perfil,terminologia:p.terminologia||{},templates:p.templates||{}},modulos:modulos.rows.map((m)=>({id:m.id,nome:m.nome,ordem:m.ordem,disponivel:m.disponivel??true,contratado:m.contratado??true,habilitado:m.habilitado??true,pacote:m.pacote||"plataforma",limites:m.limites||{},capacidades:m.capacidades||[],dependencias:m.dependencias||[]})) };
      });
    },
    async atualizarPerfilProduto(contexto, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"produto-modular.administrar");
        const resultado = await cliente.query(`INSERT INTO app.tenant_product_profiles (tenant_id,perfil,terminologia,templates,atualizado_por) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (tenant_id) DO UPDATE SET perfil=EXCLUDED.perfil,terminologia=EXCLUDED.terminologia,templates=EXCLUDED.templates,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now() RETURNING *`,[validado.tenantId,dados.perfil,dados.terminologia||{},dados.templates||{},validado.usuarioId]);
        const p=resultado.rows[0];
        await registrarAuditoria(cliente,validado,{moduleId:"administracao",action:"produto.perfil-atualizado",entityType:"perfil-produto",entityId:validado.tenantId,after:{perfil:p.perfil,terminologia:p.terminologia,templates:p.templates}});
        return {tenantId:p.tenant_id,perfil:p.perfil,terminologia:p.terminologia,templates:p.templates,atualizadoEm:p.atualizado_em};
      });
    },
    async atualizarContratoModulo(contexto, moduleId, dados) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"produto-modular.administrar");
        const resultado=await cliente.query(`INSERT INTO app.tenant_module_contracts (tenant_id,module_id,disponivel,contratado,habilitado,pacote,limites,atualizado_por)
          VALUES ($1,$2,coalesce($3,true),coalesce($4,true),coalesce($5,true),coalesce($6,'plataforma'),coalesce($7,'{}'::jsonb),$8)
          ON CONFLICT (tenant_id,module_id) DO UPDATE SET disponivel=coalesce($3,app.tenant_module_contracts.disponivel),contratado=coalesce($4,app.tenant_module_contracts.contratado),habilitado=coalesce($5,app.tenant_module_contracts.habilitado),pacote=coalesce($6,app.tenant_module_contracts.pacote),limites=coalesce($7,app.tenant_module_contracts.limites),atualizado_por=$8,atualizado_em=now() RETURNING *`,[validado.tenantId,moduleId,dados.disponivel,dados.contratado,dados.habilitado,dados.pacote,dados.limites,validado.usuarioId]);
        const c=resultado.rows[0];
        await registrarAuditoria(cliente,validado,{moduleId:"administracao",action:"produto.modulo-atualizado",entityType:"contrato-modulo",entityId:moduleId,after:{disponivel:c.disponivel,contratado:c.contratado,habilitado:c.habilitado,pacote:c.pacote}});
        return {tenantId:c.tenant_id,moduleId:c.module_id,disponivel:c.disponivel,contratado:c.contratado,habilitado:c.habilitado,pacote:c.pacote,limites:c.limites};
      });
    },
    async listarUnidadesPatrimoniais(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.consultar");
        const resultado = await cliente.query("SELECT * FROM app.patrimonial_units ORDER BY nome");
        return adicionarCaminhosPatrimoniais(resultado.rows.map(mapearUnidadePatrimonial))
          .filter((item) => !filtros.nivel || item.nivel === filtros.nivel)
          .filter((item) => !filtros.parentId || item.parentId === filtros.parentId)
          .filter((item) => !filtros.status || item.status === filtros.status)
          .sort((a, b) => a.caminho.map((parte) => parte.nome).join("/").localeCompare(b.caminho.map((parte) => parte.nome).join("/"), "pt-BR"));
      });
    },
    async obterUnidadePatrimonial(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.consultar");
        const resultado = await cliente.query("SELECT * FROM app.patrimonial_units ORDER BY nivel, nome");
        const itens = adicionarCaminhosPatrimoniais(resultado.rows.map(mapearUnidadePatrimonial));
        const item = itens.find((unidade) => unidade.id === id);
        if (!item) throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
        const totais = await cliente.query(
          `SELECT
             (SELECT count(*)::integer FROM app.patrimonial_units WHERE parent_id = $1) AS filhos,
             (SELECT count(*)::integer FROM app.patrimonial_assets WHERE sala_id = $1) AS ativos`,
          [id],
        );
        return { ...item, totais: totais.rows[0] };
      });
    },
    async criarUnidadePatrimonial(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.editar");
        if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar o patrimônio.");
        const chave = `patrimonio-unidade:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const id = randomUUID();
        const resultado = await cliente.query(
          `INSERT INTO app.patrimonial_units
            (tenant_id,id,team_id,parent_id,nivel,codigo,nome,status,endereco,area_m2,
             responsavel,ocupacao,dados,criado_por,atualizado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
           RETURNING *`,
          [validado.tenantId,id,validado.teamId,dados.parentId || null,dados.nivel,dados.codigo.trim(),dados.nome.trim(),dados.status || "ativo",dados.endereco || {},dados.areaM2 ?? null,dados.responsavel || "",dados.ocupacao || "",dados.dados || {},validado.usuarioId],
        );
        const item = mapearUnidadePatrimonial(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, item);
        await registrarEvento(cliente, validado, { moduleId:"patrimonio",eventType:"patrimonio.unidade-criada",aggregateType:`unidade-${item.nivel}`,aggregateId:id,payload:{nivel:item.nivel,codigo:item.codigo,parentId:item.parentId},after:item });
        return item;
      });
    },
    async atualizarUnidadePatrimonial(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.editar");
        const anterior = await cliente.query("SELECT * FROM app.patrimonial_units WHERE id=$1", [id]);
        if (!anterior.rows[0]) throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
        const antes = mapearUnidadePatrimonial(anterior.rows[0]);
        if (antes.nivel !== dados.nivel) {
          const dependencias = await cliente.query(
            `SELECT
               EXISTS (SELECT 1 FROM app.patrimonial_units WHERE parent_id=$1) OR
               EXISTS (SELECT 1 FROM app.patrimonial_assets WHERE sala_id=$1) OR
               EXISTS (SELECT 1 FROM app.empreendimentos WHERE patrimonio_unidade_id=$1) OR
               EXISTS (SELECT 1 FROM app.patrimonial_movements WHERE origem_sala_id=$1 OR destino_sala_id=$1)
               AS possui`,
            [id],
          );
          if (dependencias.rows[0].possui) {
            throw new ApiError(422, "UNIDADE_PATRIMONIAL_EM_USO", "O nível só pode ser alterado quando a unidade não possui registros vinculados.");
          }
        }
        const resultado = await cliente.query(
          `UPDATE app.patrimonial_units SET parent_id=$2,nivel=$3,codigo=$4,nome=$5,status=$6,
             endereco=$7,area_m2=$8,responsavel=$9,ocupacao=$10,dados=$11,versao=versao+1,
             atualizado_por=$12,atualizado_em=now()
           WHERE id=$1 AND versao=$13 RETURNING *`,
          [id,dados.parentId || null,dados.nivel,dados.codigo.trim(),dados.nome.trim(),dados.status || "ativo",dados.endereco || {},dados.areaM2 ?? null,dados.responsavel || "",dados.ocupacao || "",dados.dados || {},validado.usuarioId,versaoEsperada],
        );
        if (!resultado.rows[0]) throw new ApiError(412, "VERSAO_DIVERGENTE", "A unidade foi alterada por outro usuário.");
        const item = mapearUnidadePatrimonial(resultado.rows[0]);
        await registrarEvento(cliente, validado, { moduleId:"patrimonio",eventType:"patrimonio.unidade-atualizada",aggregateType:`unidade-${item.nivel}`,aggregateId:id,payload:{versao:item.versao,status:item.status},before:antes,after:item });
        return item;
      });
    },
    async excluirUnidadePatrimonial(contexto, id, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.editar");
        const anterior = await cliente.query("SELECT * FROM app.patrimonial_units WHERE id=$1", [id]);
        if (!anterior.rows[0]) {
          throw new ApiError(404, "UNIDADE_PATRIMONIAL_NAO_ENCONTRADA", "Unidade patrimonial não encontrada.");
        }
        const antes = mapearUnidadePatrimonial(anterior.rows[0]);
        if (antes.versao !== versaoEsperada) {
          throw new ApiError(412, "VERSAO_DIVERGENTE", "A unidade foi alterada por outro usuário.");
        }
        const dependencias = await cliente.query(
          `SELECT
             EXISTS (SELECT 1 FROM app.patrimonial_units WHERE parent_id=$1) OR
             EXISTS (SELECT 1 FROM app.patrimonial_assets WHERE sala_id=$1) OR
             EXISTS (SELECT 1 FROM app.empreendimentos WHERE patrimonio_unidade_id=$1) OR
             EXISTS (SELECT 1 FROM app.patrimonial_movements WHERE origem_sala_id=$1 OR destino_sala_id=$1)
             AS possui`,
          [id],
        );
        if (dependencias.rows[0].possui) {
          throw new ApiError(422, "UNIDADE_PATRIMONIAL_EM_USO", "Exclua ou transfira primeiro as unidades, ativos e demais registros vinculados.");
        }
        const removido = await cliente.query(
          "DELETE FROM app.patrimonial_units WHERE id=$1 AND versao=$2 RETURNING *",
          [id, versaoEsperada],
        );
        if (!removido.rows[0]) {
          throw new ApiError(412, "VERSAO_DIVERGENTE", "A unidade foi alterada por outro usuário.");
        }
        await registrarEvento(cliente, validado, {
          moduleId: "patrimonio", eventType: "patrimonio.unidade-excluida",
          aggregateType: `unidade-${antes.nivel}`, aggregateId: id,
          payload: { versao: antes.versao, codigo: antes.codigo }, before: antes, after: null,
        });
        return antes;
      });
    },
    async listarAtivosPatrimoniais(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.consultar");
        const resultado = await cliente.query(
          `SELECT * FROM app.patrimonial_assets
            WHERE ($1::uuid IS NULL OR sala_id=$1)
              AND ($2::text IS NULL OR status=$2)
            ORDER BY nome`, [filtros.salaId || null, filtros.status || null],
        );
        return resultado.rows.map(mapearAtivoPatrimonial);
      });
    },
    async criarAtivoPatrimonial(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.editar");
        if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar o patrimônio.");
        const chave = `patrimonio-ativo:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const id = randomUUID();
        const resultado = await cliente.query(
          `INSERT INTO app.patrimonial_assets
            (tenant_id,id,team_id,sala_id,codigo,nome,categoria,numero_patrimonio,fabricante,
             modelo,numero_serie,status,dados,criado_por,atualizado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,
          [validado.tenantId,id,validado.teamId,dados.salaId,dados.codigo.trim(),dados.nome.trim(),dados.categoria || "equipamento",dados.numeroPatrimonio || "",dados.fabricante || "",dados.modelo || "",dados.numeroSerie || "",dados.status || "ativo",dados.dados || {},validado.usuarioId],
        );
        const item = mapearAtivoPatrimonial(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, item);
        await registrarEvento(cliente, validado, { moduleId:"patrimonio",eventType:"patrimonio.ativo-criado",aggregateType:"ativo-patrimonial",aggregateId:id,payload:{codigo:item.codigo,salaId:item.salaId},after:item });
        return item;
      });
    },
    async atualizarAtivoPatrimonial(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.editar");
        const anterior = await cliente.query("SELECT * FROM app.patrimonial_assets WHERE id=$1", [id]);
        if (!anterior.rows[0]) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
        const antes = mapearAtivoPatrimonial(anterior.rows[0]);
        if (antes.salaId !== dados.salaId) throw new ApiError(422, "MOVIMENTACAO_OBRIGATORIA", "Use a movimentação patrimonial para trocar o ativo de sala.");
        const resultado = await cliente.query(
          `UPDATE app.patrimonial_assets SET sala_id=$2,codigo=$3,nome=$4,categoria=$5,
             numero_patrimonio=$6,fabricante=$7,modelo=$8,numero_serie=$9,status=$10,dados=$11,
             versao=versao+1,atualizado_por=$12,atualizado_em=now()
           WHERE id=$1 AND versao=$13 RETURNING *`,
          [id,dados.salaId,dados.codigo.trim(),dados.nome.trim(),dados.categoria || "equipamento",dados.numeroPatrimonio || "",dados.fabricante || "",dados.modelo || "",dados.numeroSerie || "",dados.status || "ativo",dados.dados || {},validado.usuarioId,versaoEsperada],
        );
        if (!resultado.rows[0]) throw new ApiError(412, "VERSAO_DIVERGENTE", "O ativo foi alterado por outro usuário.");
        const item = mapearAtivoPatrimonial(resultado.rows[0]);
        await registrarEvento(cliente, validado, { moduleId:"patrimonio",eventType:"patrimonio.ativo-atualizado",aggregateType:"ativo-patrimonial",aggregateId:id,payload:{versao:item.versao,status:item.status},before:antes,after:item });
        return item;
      });
    },
    async listarMovimentacoesPatrimoniais(contexto, ativoId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.consultar");
        const ativo = await cliente.query("SELECT 1 FROM app.patrimonial_assets WHERE id=$1", [ativoId]);
        if (!ativo.rows[0]) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
        const resultado = await cliente.query("SELECT * FROM app.patrimonial_movements WHERE asset_id=$1 ORDER BY movimentado_em DESC", [ativoId]);
        return resultado.rows.map(mapearMovimentacaoPatrimonial);
      });
    },
    async movimentarAtivoPatrimonial(contexto, ativoId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "patrimonio.movimentar");
        const chave = `patrimonio-movimento:${idempotencyKey}`;
        const idempotente = await obterIdempotente(cliente, validado.tenantId, chave);
        if (idempotente) return idempotente;
        const anterior = await cliente.query("SELECT * FROM app.patrimonial_assets WHERE id=$1 FOR UPDATE", [ativoId]);
        if (!anterior.rows[0]) throw new ApiError(404, "ATIVO_PATRIMONIAL_NAO_ENCONTRADO", "Ativo patrimonial não encontrado.");
        const antes = mapearAtivoPatrimonial(anterior.rows[0]);
        if (antes.salaId === dados.destinoSalaId) throw new ApiError(422, "MOVIMENTACAO_SEM_ALTERACAO", "O ativo já está na sala informada.");
        const id = randomUUID();
        const resultado = await cliente.query(
          `INSERT INTO app.patrimonial_movements
            (tenant_id,id,team_id,asset_id,origem_sala_id,destino_sala_id,motivo,movimentado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [validado.tenantId,id,validado.teamId,ativoId,antes.salaId,dados.destinoSalaId,dados.motivo.trim(),validado.usuarioId],
        );
        await cliente.query("SELECT set_config('app.patrimonial_movement','true',true)");
        const atualizado = await cliente.query("UPDATE app.patrimonial_assets SET sala_id=$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *", [ativoId,dados.destinoSalaId,validado.usuarioId]);
        const movimento = mapearMovimentacaoPatrimonial(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, movimento);
        await registrarEvento(cliente, validado, { moduleId:"patrimonio",eventType:"patrimonio.ativo-movimentado",aggregateType:"ativo-patrimonial",aggregateId:ativoId,payload:{origemSalaId:movimento.origemSalaId,destinoSalaId:movimento.destinoSalaId,motivo:movimento.motivo},before:antes,after:mapearAtivoPatrimonial(atualizado.rows[0]) });
        return movimento;
      });
    },
    async listarProgramasInvestimento(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.consultar");
        const resultado = await cliente.query("SELECT * FROM app.investment_programs ORDER BY codigo");
        return resultado.rows.map(mapearProgramaInvestimento);
      });
    },
    async criarProgramaInvestimento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar");
        if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar os investimentos.");
        const chave = `programa-investimento:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave); if (anterior) return anterior;
        const resultado = await cliente.query(
          `INSERT INTO app.investment_programs
            (tenant_id,id,team_id,codigo,nome,objetivo,ano_inicio,ano_fim,limite_financeiro,status,dados,criado_por,atualizado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
          [validado.tenantId,randomUUID(),validado.teamId,dados.codigo.trim(),dados.nome.trim(),dados.objetivo || "",dados.anoInicio ?? null,dados.anoFim ?? null,dados.limiteFinanceiro || 0,dados.status || "ativo",dados.dados || {},validado.usuarioId],
        );
        const item = mapearProgramaInvestimento(resultado.rows[0]); await salvarIdempotencia(cliente, validado, chave, item);
        await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.programa-criado",aggregateType:"programa-investimento",aggregateId:item.id,payload:{codigo:item.codigo},after:item });
        return item;
      });
    },
    async atualizarProgramaInvestimento(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar");
        const anterior = await cliente.query("SELECT * FROM app.investment_programs WHERE id=$1", [id]);
        if (!anterior.rows[0]) throw new ApiError(404, "PROGRAMA_NAO_ENCONTRADO", "Programa de investimento não encontrado.");
        const resultado = await cliente.query(
          `UPDATE app.investment_programs SET codigo=$2,nome=$3,objetivo=$4,ano_inicio=$5,ano_fim=$6,
             limite_financeiro=$7,status=$8,dados=$9,versao=versao+1,atualizado_por=$10,atualizado_em=now()
           WHERE id=$1 AND versao=$11 RETURNING *`,
          [id,dados.codigo.trim(),dados.nome.trim(),dados.objetivo || "",dados.anoInicio ?? null,dados.anoFim ?? null,dados.limiteFinanceiro || 0,dados.status || "ativo",dados.dados || {},validado.usuarioId,versaoEsperada],
        );
        if (!resultado.rows[0]) throw new ApiError(412, "VERSAO_DIVERGENTE", "O programa foi alterado por outro usuário.");
        const item = mapearProgramaInvestimento(resultado.rows[0]); await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.programa-atualizado",aggregateType:"programa-investimento",aggregateId:id,payload:{versao:item.versao},before:mapearProgramaInvestimento(anterior.rows[0]),after:item }); return item;
      });
    },
    async listarCarteirasInvestimento(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.consultar");
        const [carteiras, itens] = await Promise.all([
          cliente.query("SELECT * FROM app.investment_portfolios ORDER BY ano DESC,codigo"),
          cliente.query("SELECT * FROM app.investment_portfolio_demands ORDER BY portfolio_id,ordem"),
        ]);
        const vinculos = itens.rows.map(mapearItemCarteiraInvestimento);
        return carteiras.rows.map(mapearCarteiraInvestimento).map((item) => ({ ...item, itens: vinculos.filter((vinculo) => vinculo.portfolioId === item.id) }));
      });
    },
    async criarCarteiraInvestimento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar");
        if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar os investimentos.");
        const chave = `carteira-investimento:${idempotencyKey}`; const anterior = await obterIdempotente(cliente, validado.tenantId, chave); if (anterior) return anterior;
        const resultado = await cliente.query(
          `INSERT INTO app.investment_portfolios
            (tenant_id,id,team_id,codigo,nome,ano,limite_financeiro,status,dados,criado_por,atualizado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
          [validado.tenantId,randomUUID(),validado.teamId,dados.codigo.trim(),dados.nome.trim(),dados.ano,dados.limiteFinanceiro || 0,dados.status || "elaboracao",dados.dados || {},validado.usuarioId],
        );
        const item = { ...mapearCarteiraInvestimento(resultado.rows[0]), itens: [] }; await salvarIdempotencia(cliente, validado, chave, item);
        await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.carteira-criada",aggregateType:"carteira-investimento",aggregateId:item.id,payload:{codigo:item.codigo,ano:item.ano},after:item }); return item;
      });
    },
    async atualizarCarteiraInvestimento(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar");
        const anterior = await cliente.query("SELECT * FROM app.investment_portfolios WHERE id=$1", [id]); if (!anterior.rows[0]) throw new ApiError(404, "CARTEIRA_NAO_ENCONTRADA", "Carteira de investimentos não encontrada.");
        const resultado = await cliente.query(
          `UPDATE app.investment_portfolios SET codigo=$2,nome=$3,ano=$4,limite_financeiro=$5,status=$6,dados=$7,
             versao=versao+1,atualizado_por=$8,atualizado_em=now() WHERE id=$1 AND versao=$9 RETURNING *`,
          [id,dados.codigo.trim(),dados.nome.trim(),dados.ano,dados.limiteFinanceiro || 0,dados.status || "elaboracao",dados.dados || {},validado.usuarioId,versaoEsperada],
        );
        if (!resultado.rows[0]) throw new ApiError(412, "VERSAO_DIVERGENTE", "A carteira foi alterada por outro usuário.");
        const item = mapearCarteiraInvestimento(resultado.rows[0]); await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.carteira-atualizada",aggregateType:"carteira-investimento",aggregateId:id,payload:{versao:item.versao,status:item.status},before:mapearCarteiraInvestimento(anterior.rows[0]),after:item }); return item;
      });
    },
    async listarDemandasInvestimento(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.consultar");
        const resultado = await cliente.query(
          `SELECT * FROM app.investment_demands
            WHERE ($1::text IS NULL OR status=$1) AND ($2::uuid IS NULL OR programa_id=$2)
              AND ($3::uuid IS NULL OR patrimonio_unidade_id=$3)
            ORDER BY pontuacao DESC, atualizado_em DESC`,
          [filtros.status || null,filtros.programaId || null,filtros.patrimonioUnidadeId || null],
        ); return resultado.rows.map(mapearDemandaInvestimento);
      });
    },
    async obterDemandaInvestimento(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.consultar");
        const [demanda, decisoes] = await Promise.all([cliente.query("SELECT * FROM app.investment_demands WHERE id=$1",[id]),cliente.query("SELECT * FROM app.investment_demand_decisions WHERE demand_id=$1 ORDER BY decidido_em DESC",[id])]);
        if (!demanda.rows[0]) throw new ApiError(404, "DEMANDA_NAO_ENCONTRADA", "Demanda de investimento não encontrada.");
        return { ...mapearDemandaInvestimento(demanda.rows[0]), decisoes: decisoes.rows.map(mapearDecisaoDemanda) };
      });
    },
    async criarDemandaInvestimento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar"); if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar os investimentos.");
        const chave = `demanda-investimento:${idempotencyKey}`; const anterior = await obterIdempotente(cliente, validado.tenantId, chave); if (anterior) return anterior;
        const resultado = await cliente.query(
          `INSERT INTO app.investment_demands
            (tenant_id,id,team_id,patrimonio_unidade_id,programa_id,codigo,titulo,descricao,solicitante,categoria,
             valor_estimado,data_desejada,urgencia,impacto,risco,alinhamento,pontuacao,status,dados,criado_por,atualizado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'rascunho',$18,$19,$19) RETURNING *`,
          [validado.tenantId,randomUUID(),validado.teamId,dados.patrimonioUnidadeId,dados.programaId || null,dados.codigo.trim(),dados.titulo.trim(),dados.descricao || "",dados.solicitante || "",dados.categoria || "obra_reforma",dados.valorEstimado || 0,dados.dataDesejada || null,dados.urgencia || 3,dados.impacto || 3,dados.risco || 3,dados.alinhamento || 3,calcularPontuacaoDemanda(dados),dados.dados || {},validado.usuarioId],
        );
        const item = mapearDemandaInvestimento(resultado.rows[0]); await salvarIdempotencia(cliente, validado, chave, item); await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.demanda-criada",aggregateType:"demanda-investimento",aggregateId:item.id,payload:{codigo:item.codigo,pontuacao:item.pontuacao},after:item }); return item;
      });
    },
    async atualizarDemandaInvestimento(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "planejamento.editar"); const anterior = await cliente.query("SELECT * FROM app.investment_demands WHERE id=$1",[id]); if (!anterior.rows[0]) throw new ApiError(404,"DEMANDA_NAO_ENCONTRADA","Demanda de investimento não encontrada.");
        const antes = mapearDemandaInvestimento(anterior.rows[0]); if (!['rascunho','em_analise','rejeitada'].includes(antes.status)) throw new ApiError(422,"DEMANDA_NAO_EDITAVEL","A demanda não pode ser editada neste estágio.");
        const resultado = await cliente.query(
          `UPDATE app.investment_demands SET patrimonio_unidade_id=$2,programa_id=$3,codigo=$4,titulo=$5,descricao=$6,
             solicitante=$7,categoria=$8,valor_estimado=$9,data_desejada=$10,urgencia=$11,impacto=$12,risco=$13,
             alinhamento=$14,pontuacao=$15,dados=$16,versao=versao+1,atualizado_por=$17,atualizado_em=now()
           WHERE id=$1 AND versao=$18 RETURNING *`,
          [id,dados.patrimonioUnidadeId,dados.programaId || null,dados.codigo.trim(),dados.titulo.trim(),dados.descricao || "",dados.solicitante || "",dados.categoria || "obra_reforma",dados.valorEstimado || 0,dados.dataDesejada || null,dados.urgencia || 3,dados.impacto || 3,dados.risco || 3,dados.alinhamento || 3,calcularPontuacaoDemanda(dados),dados.dados || {},validado.usuarioId,versaoEsperada],
        ); if (!resultado.rows[0]) throw new ApiError(412,"VERSAO_DIVERGENTE","A demanda foi alterada por outro usuário.");
        const item = mapearDemandaInvestimento(resultado.rows[0]); await registrarEvento(cliente, validado, { moduleId:"planejamento",eventType:"planejamento.demanda-atualizada",aggregateType:"demanda-investimento",aggregateId:id,payload:{versao:item.versao,pontuacao:item.pontuacao},before:antes,after:item }); return item;
      });
    },
    async decidirDemandaInvestimento(contexto, id, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        const chave = `decisao-demanda:${idempotencyKey}`; const idempotente = await obterIdempotente(cliente, validado.tenantId, chave); if (idempotente) return idempotente;
        const anterior = await cliente.query("SELECT * FROM app.investment_demands WHERE id=$1 FOR UPDATE",[id]); if (!anterior.rows[0]) throw new ApiError(404,"DEMANDA_NAO_ENCONTRADA","Demanda de investimento não encontrada.");
        const antes = mapearDemandaInvestimento(anterior.rows[0]); if (antes.versao !== versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","A demanda foi alterada por outro usuário.");
        const transicao = resolverTransicaoDemanda(antes.status,dados.acao); exigirPermissao(validado,transicao.permissao); if (dados.acao === "rejeitar" && String(dados.justificativa || "").trim().length < 3) throw new ApiError(422,"JUSTIFICATIVA_OBRIGATORIA","Informe a justificativa da rejeição.");
        const decisaoId = randomUUID(); const decisao = await cliente.query(
          `INSERT INTO app.investment_demand_decisions (tenant_id,id,team_id,demand_id,acao,status_anterior,status_novo,justificativa,decidido_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[validado.tenantId,decisaoId,validado.teamId,id,dados.acao,antes.status,transicao.statusNovo,String(dados.justificativa || "").trim(),validado.usuarioId]);
        const atualizada = await cliente.query("UPDATE app.investment_demands SET status=$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[id,transicao.statusNovo,validado.usuarioId]);
        const resposta = { demanda:mapearDemandaInvestimento(atualizada.rows[0]),decisao:mapearDecisaoDemanda(decisao.rows[0]) }; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"planejamento",eventType:`planejamento.demanda-${dados.acao}`,aggregateType:"demanda-investimento",aggregateId:id,payload:{acao:dados.acao,statusNovo:transicao.statusNovo},before:antes,after:resposta.demanda}); return resposta;
      });
    },
    async listarDecisoesDemanda(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"planejamento.consultar"); const existe=await cliente.query("SELECT 1 FROM app.investment_demands WHERE id=$1",[id]); if(!existe.rows[0]) throw new ApiError(404,"DEMANDA_NAO_ENCONTRADA","Demanda de investimento não encontrada."); const resultado=await cliente.query("SELECT * FROM app.investment_demand_decisions WHERE demand_id=$1 ORDER BY decidido_em DESC",[id]); return resultado.rows.map(mapearDecisaoDemanda); });
    },
    async incorporarDemandaCarteira(contexto, portfolioId, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"planejamento.aprovar"); const chave=`incorporacao-demanda:${idempotencyKey}`; const anteriorIdem=await obterIdempotente(cliente,validado.tenantId,chave); if(anteriorIdem) return anteriorIdem;
        const [carteiraResultado,demandaResultado]=await Promise.all([cliente.query("SELECT * FROM app.investment_portfolios WHERE id=$1 FOR UPDATE",[portfolioId]),cliente.query("SELECT * FROM app.investment_demands WHERE id=$1 FOR UPDATE",[dados.demandId])]);
        if(!carteiraResultado.rows[0]) throw new ApiError(404,"CARTEIRA_NAO_ENCONTRADA","Carteira de investimentos não encontrada."); if(!demandaResultado.rows[0]) throw new ApiError(404,"DEMANDA_NAO_ENCONTRADA","Demanda de investimento não encontrada.");
        const carteira=mapearCarteiraInvestimento(carteiraResultado.rows[0]); const antes=mapearDemandaInvestimento(demandaResultado.rows[0]); if(antes.versao!==versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","A demanda foi alterada por outro usuário."); resolverTransicaoDemanda(antes.status,"incorporar"); if(!['elaboracao','em_aprovacao'].includes(carteira.status)) throw new ApiError(422,"CARTEIRA_FECHADA","A carteira não aceita novas demandas neste estágio.");
        const total=await cliente.query("SELECT coalesce(sum(valor_planejado),0)::numeric AS total FROM app.investment_portfolio_demands WHERE portfolio_id=$1",[portfolioId]); if(carteira.limiteFinanceiro>0 && Number(total.rows[0].total)+Number(dados.valorPlanejado || 0)>carteira.limiteFinanceiro) throw new ApiError(422,"LIMITE_CARTEIRA_EXCEDIDO","A inclusão ultrapassa o limite financeiro da carteira.");
        const vinculoResultado=await cliente.query(`INSERT INTO app.investment_portfolio_demands (tenant_id,portfolio_id,demand_id,team_id,ordem,valor_planejado,observacao,incorporado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[validado.tenantId,portfolioId,antes.id,validado.teamId,dados.ordem,dados.valorPlanejado || 0,dados.observacao || "",validado.usuarioId]);
        const decisaoResultado=await cliente.query(`INSERT INTO app.investment_demand_decisions (tenant_id,id,team_id,demand_id,acao,status_anterior,status_novo,justificativa,decidido_por) VALUES ($1,$2,$3,$4,'incorporar',$5,'incorporada',$6,$7) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,antes.id,antes.status,dados.observacao || "",validado.usuarioId]);
        const atualizada=await cliente.query("UPDATE app.investment_demands SET status='incorporada',versao=versao+1,atualizado_por=$2,atualizado_em=now() WHERE id=$1 RETURNING *",[antes.id,validado.usuarioId]); const resposta={vinculo:mapearItemCarteiraInvestimento(vinculoResultado.rows[0]),demanda:mapearDemandaInvestimento(atualizada.rows[0]),decisao:mapearDecisaoDemanda(decisaoResultado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"planejamento",eventType:"planejamento.demanda-incorporada",aggregateType:"demanda-investimento",aggregateId:antes.id,payload:{portfolioId,valorPlanejado:resposta.vinculo.valorPlanejado},before:antes,after:resposta.demanda}); return resposta;
      });
    },
    async listarFornecedores(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "suprimentos.consultar");
        const resultado = await cliente.query(`SELECT * FROM app.suppliers WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR codigo ILIKE '%'||$2||'%' OR razao_social ILIKE '%'||$2||'%' OR documento ILIKE '%'||$2||'%') ORDER BY razao_social`, [filtros.status || null, filtros.busca || null]);
        return resultado.rows.map(mapearFornecedor);
      });
    },
    async criarFornecedor(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "suprimentos.editar"); if (!validado.teamId) throw new ApiError(422, "EQUIPE_OBRIGATORIA", "Selecione uma equipe para administrar suprimentos.");
        const chave = `fornecedor:${idempotencyKey}`; const idem = await obterIdempotente(cliente, validado.tenantId, chave); if (idem) return idem;
        const resultado = await cliente.query(`INSERT INTO app.suppliers (tenant_id,id,team_id,codigo,razao_social,nome_fantasia,documento,email,telefone,status,qualificacao,dados,criado_por,atualizado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING *`, [validado.tenantId,randomUUID(),validado.teamId,dados.codigo.trim(),dados.razaoSocial.trim(),dados.nomeFantasia || "",dados.documento || "",dados.email || "",dados.telefone || "",dados.status || "ativo",dados.qualificacao || "pendente",dados.dados || {},validado.usuarioId]);
        const item = mapearFornecedor(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.fornecedor-criado",aggregateType:"fornecedor",aggregateId:item.id,payload:{codigo:item.codigo},after:item}); return item;
      });
    },
    async atualizarFornecedor(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.editar"); const anterior=await cliente.query("SELECT * FROM app.suppliers WHERE id=$1",[id]); if(!anterior.rows[0]) throw new ApiError(404,"FORNECEDOR_NAO_ENCONTRADO","Fornecedor não encontrado.");
        const resultado=await cliente.query(`UPDATE app.suppliers SET codigo=$2,razao_social=$3,nome_fantasia=$4,documento=$5,email=$6,telefone=$7,status=$8,qualificacao=$9,dados=$10,versao=versao+1,atualizado_por=$11,atualizado_em=now() WHERE id=$1 AND versao=$12 RETURNING *`,[id,dados.codigo.trim(),dados.razaoSocial.trim(),dados.nomeFantasia||"",dados.documento||"",dados.email||"",dados.telefone||"",dados.status||"ativo",dados.qualificacao||"pendente",dados.dados||{},validado.usuarioId,versaoEsperada]); if(!resultado.rows[0]) throw new ApiError(412,"VERSAO_DIVERGENTE","O fornecedor foi alterado por outro usuário.");
        const item=mapearFornecedor(resultado.rows[0]); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.fornecedor-atualizado",aggregateType:"fornecedor",aggregateId:id,payload:{versao:item.versao},before:mapearFornecedor(anterior.rows[0]),after:item}); return item;
      });
    },
    async listarProcessosContratacao(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"suprimentos.consultar"); const resultado=await cliente.query("SELECT * FROM app.procurement_processes WHERE ($1::text IS NULL OR status=$1) ORDER BY atualizado_em DESC",[filtros.status||null]); return resultado.rows.map(mapearProcessoContratacao); });
    },
    async obterProcessoContratacao(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.consultar"); const processo=await cliente.query("SELECT * FROM app.procurement_processes WHERE id=$1",[id]); if(!processo.rows[0]) throw new ApiError(404,"PROCESSO_CONTRATACAO_NAO_ENCONTRADO","Processo de contratação não encontrado."); const cotacoes=await cliente.query("SELECT * FROM app.procurement_quotes WHERE process_id=$1 ORDER BY valor_total",[id]); const decisoes=await cliente.query("SELECT * FROM app.procurement_decisions WHERE process_id=$1 ORDER BY decidido_em DESC",[id]); const pedidos=await cliente.query("SELECT * FROM app.purchase_orders WHERE process_id=$1 ORDER BY criado_em DESC",[id]); return {...mapearProcessoContratacao(processo.rows[0]),cotacoes:cotacoes.rows.map(mapearCotacao),decisoes:decisoes.rows.map(mapearDecisaoContratacao),pedidos:pedidos.rows.map(mapearPedidoCompra)};
      });
    },
    async criarProcessoContratacao(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.editar"); if(!validado.teamId) throw new ApiError(422,"EQUIPE_OBRIGATORIA","Selecione uma equipe para administrar suprimentos."); if(!dados.demandId&&!dados.orcamentoId) throw new ApiError(422,"ORIGEM_CONTRATACAO_OBRIGATORIA","Vincule uma demanda incorporada ou um orçamento.");
        const chave=`processo-contratacao:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem;
        const resultado=await cliente.query(`INSERT INTO app.procurement_processes (tenant_id,id,team_id,demand_id,orcamento_id,codigo,titulo,objeto,tipo,regime,criterio_julgamento,valor_estimado,status,estudo_tecnico,riscos,termo_referencia,dados,criado_por,atualizado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'rascunho',$13,$14,$15,$16,$17,$17) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,dados.demandId||null,dados.orcamentoId||null,dados.codigo.trim(),dados.titulo.trim(),dados.objeto.trim(),dados.tipo||"servico",dados.regime||"publico",dados.criterioJulgamento||"menor_preco",dados.valorEstimado||0,dados.estudoTecnico||{},dados.riscos||[],dados.termoReferencia||{},dados.dados||{},validado.usuarioId]); const item=mapearProcessoContratacao(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.processo-criado",aggregateType:"processo-contratacao",aggregateId:item.id,payload:{codigo:item.codigo,demandId:item.demandId,orcamentoId:item.orcamentoId},after:item}); return item;
      });
    },
    async atualizarProcessoContratacao(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.editar"); const anterior=await cliente.query("SELECT * FROM app.procurement_processes WHERE id=$1",[id]); if(!anterior.rows[0]) throw new ApiError(404,"PROCESSO_CONTRATACAO_NAO_ENCONTRADO","Processo de contratação não encontrado."); const antes=mapearProcessoContratacao(anterior.rows[0]); if(!["rascunho","planejamento"].includes(antes.status)) throw new ApiError(422,"PROCESSO_NAO_EDITAVEL","O planejamento não pode mais ser alterado neste estágio.");
        const resultado=await cliente.query(`UPDATE app.procurement_processes SET demand_id=$2,orcamento_id=$3,codigo=$4,titulo=$5,objeto=$6,tipo=$7,regime=$8,criterio_julgamento=$9,valor_estimado=$10,estudo_tecnico=$11,riscos=$12,termo_referencia=$13,dados=$14,versao=versao+1,atualizado_por=$15,atualizado_em=now() WHERE id=$1 AND versao=$16 RETURNING *`,[id,dados.demandId||null,dados.orcamentoId||null,dados.codigo.trim(),dados.titulo.trim(),dados.objeto.trim(),dados.tipo||"servico",dados.regime||"publico",dados.criterioJulgamento||"menor_preco",dados.valorEstimado||0,dados.estudoTecnico||{},dados.riscos||[],dados.termoReferencia||{},dados.dados||{},validado.usuarioId,versaoEsperada]); if(!resultado.rows[0]) throw new ApiError(412,"VERSAO_DIVERGENTE","O processo foi alterado por outro usuário."); const item=mapearProcessoContratacao(resultado.rows[0]); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.processo-atualizado",aggregateType:"processo-contratacao",aggregateId:id,payload:{versao:item.versao},before:antes,after:item}); return item;
      });
    },
    async registrarCotacao(contexto, processId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.cotar"); const chave=`cotacao:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const processo=await cliente.query("SELECT status FROM app.procurement_processes WHERE id=$1",[processId]); if(!processo.rows[0]) throw new ApiError(404,"PROCESSO_CONTRATACAO_NAO_ENCONTRADO","Processo de contratação não encontrado."); if(!["pesquisa_precos","selecao"].includes(processo.rows[0].status)) throw new ApiError(422,"COTACAO_FORA_DE_ETAPA","A pesquisa de preços ainda não está aberta.");
        const resultado=await cliente.query(`INSERT INTO app.procurement_quotes (tenant_id,id,team_id,process_id,supplier_id,data_proposta,validade_dias,prazo_entrega_dias,valor_total,status,justificativa,proposta,criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,processId,dados.supplierId,dados.dataProposta||new Date().toISOString().slice(0,10),dados.validadeDias??30,dados.prazoEntregaDias||0,dados.valorTotal,dados.status||"recebida",dados.justificativa||"",dados.proposta||{},validado.usuarioId]); const item=mapearCotacao(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.cotacao-registrada",aggregateType:"processo-contratacao",aggregateId:processId,payload:{supplierId:item.supplierId,valorTotal:item.valorTotal},after:item}); return item;
      });
    },
    async decidirProcessoContratacao(contexto, id, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        const chave=`decisao-contratacao:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.procurement_processes WHERE id=$1 FOR UPDATE",[id]); if(!anterior.rows[0]) throw new ApiError(404,"PROCESSO_CONTRATACAO_NAO_ENCONTRADO","Processo de contratação não encontrado."); const antes=mapearProcessoContratacao(anterior.rows[0]); if(antes.versao!==versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","O processo foi alterado por outro usuário."); const transicao=resolverTransicaoContratacao(antes.status,dados.acao); exigirPermissao(validado,transicao.permissao);
        const cotacoesResultado=await cliente.query("SELECT * FROM app.procurement_quotes WHERE process_id=$1 ORDER BY valor_total",[id]); const cotacoes=cotacoesResultado.rows.map(mapearCotacao); if(dados.acao==="iniciar_selecao") validarPesquisaPrecos(cotacoes); if(["devolver","cancelar"].includes(dados.acao)&&String(dados.justificativa||"").trim().length<3) throw new ApiError(422,"JUSTIFICATIVA_OBRIGATORIA","Informe a justificativa da decisão.");
        if(dados.acao==="aprovar") { const vencedora=cotacoes.find((item)=>item.id===dados.dados?.quoteId)||cotacoes.filter((item)=>item.status!=="desclassificada").sort((a,b)=>a.valorTotal-b.valorTotal)[0]; if(!vencedora) throw new ApiError(422,"PROPOSTA_VENCEDORA_OBRIGATORIA","Selecione uma proposta vencedora."); await cliente.query("UPDATE app.procurement_quotes SET status=CASE WHEN id=$2 THEN 'vencedora' WHEN status='desclassificada' THEN status ELSE 'classificada' END WHERE process_id=$1",[id,vencedora.id]); }
        const decisaoResultado=await cliente.query(`INSERT INTO app.procurement_decisions (tenant_id,id,team_id,process_id,acao,status_anterior,status_novo,justificativa,dados,decidido_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,id,dados.acao,antes.status,transicao.statusNovo,String(dados.justificativa||"").trim(),dados.dados||{},validado.usuarioId]); const atualizado=await cliente.query("UPDATE app.procurement_processes SET status=$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[id,transicao.statusNovo,validado.usuarioId]); const resposta={processo:mapearProcessoContratacao(atualizado.rows[0]),decisao:mapearDecisaoContratacao(decisaoResultado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:`suprimentos.processo-${dados.acao}`,aggregateType:"processo-contratacao",aggregateId:id,payload:{acao:dados.acao,statusNovo:transicao.statusNovo},before:antes,after:resposta.processo}); return resposta;
      });
    },
    async emitirPedidoCompra(contexto, processId, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.aprovar"); const chave=`pedido-compra:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.procurement_processes WHERE id=$1 FOR UPDATE",[processId]); if(!anterior.rows[0]) throw new ApiError(404,"PROCESSO_CONTRATACAO_NAO_ENCONTRADO","Processo de contratação não encontrado."); const antes=mapearProcessoContratacao(anterior.rows[0]); if(antes.versao!==versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","O processo foi alterado por outro usuário."); const transicao=resolverTransicaoContratacao(antes.status,"emitir_pedido");
        const resultado=await cliente.query(`INSERT INTO app.purchase_orders (tenant_id,id,team_id,process_id,supplier_id,quote_id,codigo,valor_total,data_emissao,data_prevista,status,dados,criado_por,atualizado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'emitido',$11,$12,$12) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,processId,dados.supplierId,dados.quoteId||null,dados.codigo.trim(),dados.valorTotal,dados.dataEmissao||new Date().toISOString().slice(0,10),dados.dataPrevista||null,dados.dados||{},validado.usuarioId]); const atualizado=await cliente.query("UPDATE app.procurement_processes SET status=$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[processId,transicao.statusNovo,validado.usuarioId]); await cliente.query(`INSERT INTO app.procurement_decisions (tenant_id,id,team_id,process_id,acao,status_anterior,status_novo,justificativa,dados,decidido_por) VALUES ($1,$2,$3,$4,'emitir_pedido',$5,$6,'Pedido emitido',$7,$8)`,[validado.tenantId,randomUUID(),validado.teamId,processId,antes.status,transicao.statusNovo,{orderId:resultado.rows[0].id},validado.usuarioId]); const resposta={pedido:mapearPedidoCompra(resultado.rows[0]),processo:mapearProcessoContratacao(atualizado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.pedido-emitido",aggregateType:"pedido-compra",aggregateId:resposta.pedido.id,payload:{processId,valorTotal:resposta.pedido.valorTotal},after:resposta.pedido}); return resposta;
      });
    },
    async listarPedidosCompra(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"suprimentos.consultar"); const pedidos=await cliente.query("SELECT * FROM app.purchase_orders WHERE ($1::text IS NULL OR status=$1) ORDER BY criado_em DESC",[filtros.status||null]); const recebimentos=await cliente.query("SELECT * FROM app.purchase_receipts ORDER BY recebido_em DESC"); const historico=recebimentos.rows.map(mapearRecebimentoCompra); return pedidos.rows.map(mapearPedidoCompra).map((item)=>({...item,recebimentos:historico.filter((x)=>x.orderId===item.id)})); });
    },
    async registrarRecebimentoPedido(contexto, orderId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"suprimentos.receber"); const chave=`recebimento-compra:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.purchase_orders WHERE id=$1 FOR UPDATE",[orderId]); if(!anterior.rows[0]) throw new ApiError(404,"PEDIDO_NAO_ENCONTRADO","Pedido de compra não encontrado."); const pedidoAntes=mapearPedidoCompra(anterior.rows[0]); const valor=Number(dados.valorRecebido); if(pedidoAntes.valorRecebido+valor>pedidoAntes.valorTotal) throw new ApiError(422,"RECEBIMENTO_SUPERIOR_AO_PEDIDO","O recebimento ultrapassa o saldo do pedido.");
        const rec=await cliente.query(`INSERT INTO app.purchase_receipts (tenant_id,id,team_id,order_id,data_recebimento,valor_recebido,aceite,observacao,recebido_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,orderId,dados.dataRecebimento||new Date().toISOString().slice(0,10),valor,dados.aceite||"aceito",dados.observacao||"",validado.usuarioId]); const novoValor=pedidoAntes.valorRecebido+valor; const pedidoResultado=await cliente.query("UPDATE app.purchase_orders SET valor_recebido=$2,status=CASE WHEN $2=valor_total THEN 'recebido' ELSE 'parcial' END,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[orderId,novoValor,validado.usuarioId]); const pendentes=await cliente.query("SELECT count(*)::integer AS total FROM app.purchase_orders WHERE process_id=$1 AND status<>'recebido'",[pedidoAntes.processId]); let processoResultado=await cliente.query("SELECT * FROM app.procurement_processes WHERE id=$1",[pedidoAntes.processId]); if(Number(pendentes.rows[0].total)===0&&processoResultado.rows[0]?.status==="pedido_emitido") { const antesProcesso=mapearProcessoContratacao(processoResultado.rows[0]); processoResultado=await cliente.query("UPDATE app.procurement_processes SET status='concluida',versao=versao+1,atualizado_por=$2,atualizado_em=now() WHERE id=$1 RETURNING *",[pedidoAntes.processId,validado.usuarioId]); await cliente.query(`INSERT INTO app.procurement_decisions (tenant_id,id,team_id,process_id,acao,status_anterior,status_novo,justificativa,dados,decidido_por) VALUES ($1,$2,$3,$4,'concluir',$5,'concluida','Todos os pedidos foram recebidos',$6,$7)`,[validado.tenantId,randomUUID(),validado.teamId,pedidoAntes.processId,antesProcesso.status,{orderId},validado.usuarioId]); }
        const resposta={recebimento:mapearRecebimentoCompra(rec.rows[0]),pedido:mapearPedidoCompra(pedidoResultado.rows[0]),processo:mapearProcessoContratacao(processoResultado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"suprimentos",eventType:"suprimentos.recebimento-registrado",aggregateType:"pedido-compra",aggregateId:orderId,payload:{valorRecebido:valor,aceite:resposta.recebimento.aceite},before:pedidoAntes,after:resposta.pedido}); return resposta;
      });
    },
    async listarContratos(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.consultar"); const resultado=await cliente.query(`SELECT * FROM app.contracts WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR codigo ILIKE '%'||$2||'%' OR numero ILIKE '%'||$2||'%' OR titulo ILIKE '%'||$2||'%' OR objeto ILIKE '%'||$2||'%') ORDER BY atualizado_em DESC`,[filtros.status||null,filtros.busca||null]); return resultado.rows.map(mapearContrato); });
    },
    async obterContrato(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"contratos.consultar"); const contrato=await cliente.query("SELECT * FROM app.contracts WHERE id=$1",[id]); if(!contrato.rows[0]) throw new ApiError(404,"CONTRATO_NAO_ENCONTRADO","Contrato não encontrado.");
        const responsaveis=await cliente.query("SELECT * FROM app.contract_responsibles WHERE contract_id=$1 ORDER BY criado_em",[id]); const aditivos=await cliente.query("SELECT * FROM app.contract_amendments WHERE contract_id=$1 ORDER BY aprovado_em DESC",[id]); const garantias=await cliente.query("SELECT * FROM app.contract_guarantees WHERE contract_id=$1 ORDER BY criado_em DESC",[id]); const ocorrencias=await cliente.query("SELECT * FROM app.contract_occurrences WHERE contract_id=$1 ORDER BY data_ocorrencia DESC, registrado_em DESC",[id]); const sancoes=await cliente.query("SELECT * FROM app.contract_sanctions WHERE contract_id=$1 ORDER BY aplicado_em DESC",[id]); const execucoes=await cliente.query("SELECT * FROM app.contract_executions WHERE contract_id=$1 ORDER BY data_execucao DESC, registrado_em DESC",[id]); const decisoes=await cliente.query("SELECT * FROM app.contract_decisions WHERE contract_id=$1 ORDER BY decidido_em DESC",[id]);
        return {...mapearContrato(contrato.rows[0]),responsaveis:responsaveis.rows.map(mapearResponsavelContrato),aditivos:aditivos.rows.map(mapearAditivoContrato),garantias:garantias.rows.map(mapearGarantiaContrato),ocorrencias:ocorrencias.rows.map(mapearOcorrenciaContrato),sancoes:sancoes.rows.map(mapearSancaoContrato),execucoes:execucoes.rows.map(mapearExecucaoContrato),decisoes:decisoes.rows.map(mapearDecisaoContrato)};
      });
    },
    async criarContrato(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado,"contratos.editar"); if(!validado.teamId) throw new ApiError(422,"EQUIPE_OBRIGATORIA","Selecione uma equipe para administrar contratos."); validarVigenciaContrato(dados.dataInicio,dados.dataFim); const chave=`contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem;
        const origem=await cliente.query(`SELECT p.regime,p.status,q.id AS quote_id FROM app.procurement_processes p LEFT JOIN app.procurement_quotes q ON q.process_id=p.id AND q.supplier_id=$2 AND q.status='vencedora' WHERE p.id=$1`,[dados.processId,dados.supplierId]); if(!origem.rows[0]||!["aprovada","pedido_emitido","concluida"].includes(origem.rows[0].status)) throw new ApiError(422,"PROCESSO_NAO_APROVADO","Somente processo aprovado pode originar contrato."); if(!origem.rows[0].quote_id) throw new ApiError(422,"CONTRATADO_NAO_VENCEDOR","O contratado precisa ser o fornecedor vencedor do processo.");
        const valor=Number(dados.valorInicial); const resultado=await cliente.query(`INSERT INTO app.contracts (tenant_id,id,team_id,process_id,supplier_id,codigo,numero,titulo,objeto,tipo_instrumento,regime,data_assinatura,data_inicio,data_fim,valor_inicial,valor_atual,status,dados,criado_por,atualizado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,'rascunho',$16,$17,$17) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,dados.processId,dados.supplierId,dados.codigo.trim(),dados.numero.trim(),dados.titulo.trim(),dados.objeto.trim(),dados.tipoInstrumento||"contrato",dados.regime||origem.rows[0].regime||"publico",dados.dataAssinatura||null,dados.dataInicio,dados.dataFim,valor,dados.dados||{},validado.usuarioId]); const item=mapearContrato(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.criado",aggregateType:"contrato",aggregateId:item.id,payload:{codigo:item.codigo,processId:item.processId,supplierId:item.supplierId},after:item}); return item;
      });
    },
    async atualizarContrato(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.editar"); validarVigenciaContrato(dados.dataInicio,dados.dataFim); const anterior=await cliente.query("SELECT * FROM app.contracts WHERE id=$1",[id]); if(!anterior.rows[0]) throw new ApiError(404,"CONTRATO_NAO_ENCONTRADO","Contrato não encontrado."); const antes=mapearContrato(anterior.rows[0]); if(antes.status!=="rascunho") throw new ApiError(422,"CONTRATO_NAO_EDITAVEL","Somente contrato em rascunho pode ser editado diretamente."); const resultado=await cliente.query(`UPDATE app.contracts SET codigo=$2,numero=$3,titulo=$4,objeto=$5,tipo_instrumento=$6,regime=$7,data_assinatura=$8,data_inicio=$9,data_fim=$10,valor_inicial=$11,valor_atual=$11,dados=$12,versao=versao+1,atualizado_por=$13,atualizado_em=now() WHERE id=$1 AND versao=$14 RETURNING *`,[id,dados.codigo.trim(),dados.numero.trim(),dados.titulo.trim(),dados.objeto.trim(),dados.tipoInstrumento||"contrato",dados.regime||"publico",dados.dataAssinatura||null,dados.dataInicio,dados.dataFim,Number(dados.valorInicial),dados.dados||{},validado.usuarioId,versaoEsperada]); if(!resultado.rows[0]) throw new ApiError(412,"VERSAO_DIVERGENTE","O contrato foi alterado por outro usuário."); const item=mapearContrato(resultado.rows[0]); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.atualizado",aggregateType:"contrato",aggregateId:id,payload:{versao:item.versao},before:antes,after:item}); return item; });
    },
    async decidirContrato(contexto, id, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { const chave=`decisao-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.contracts WHERE id=$1 FOR UPDATE",[id]); if(!anterior.rows[0]) throw new ApiError(404,"CONTRATO_NAO_ENCONTRADO","Contrato não encontrado."); const antes=mapearContrato(anterior.rows[0]); if(antes.versao!==versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","O contrato foi alterado por outro usuário."); const transicao=resolverTransicaoContrato(antes.status,dados.acao); exigirPermissao(validado,transicao.permissao); if(["suspender","rescindir","cancelar","encerrar"].includes(dados.acao)&&String(dados.justificativa||"").trim().length<3) throw new ApiError(422,"JUSTIFICATIVA_OBRIGATORIA","Informe a justificativa da decisão."); if(dados.acao==="ativar") { const designacoes=await cliente.query("SELECT papel FROM app.contract_responsibles WHERE contract_id=$1",[id]); if(!designacoes.rows.some((x)=>x.papel==="gestor")||!designacoes.rows.some((x)=>x.papel.startsWith("fiscal_"))) throw new ApiError(422,"RESPONSAVEIS_CONTRATO_INCOMPLETOS","Designe ao menos um gestor e um fiscal antes de ativar o contrato."); }
        const decisao=await cliente.query(`INSERT INTO app.contract_decisions (tenant_id,id,team_id,contract_id,acao,status_anterior,status_novo,justificativa,dados,decidido_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,id,dados.acao,antes.status,transicao.statusNovo,String(dados.justificativa||"").trim(),dados.dados||{},validado.usuarioId]); const atualizado=await cliente.query("UPDATE app.contracts SET status=$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[id,transicao.statusNovo,validado.usuarioId]); const resposta={contrato:mapearContrato(atualizado.rows[0]),decisao:mapearDecisaoContrato(decisao.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:`contratos.${dados.acao}`,aggregateType:"contrato",aggregateId:id,payload:{acao:dados.acao,statusNovo:transicao.statusNovo},before:antes,after:resposta.contrato}); return resposta; });
    },
    async adicionarResponsavelContrato(contexto, contractId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.gerir"); const chave=`responsavel-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const resultado=await cliente.query(`INSERT INTO app.contract_responsibles (tenant_id,id,team_id,contract_id,papel,nome,documento,email,data_inicio,data_fim,ato_designacao,criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.papel,dados.nome.trim(),dados.documento||"",dados.email||"",dados.dataInicio,dados.dataFim||null,dados.atoDesignacao||"",validado.usuarioId]); const item=mapearResponsavelContrato(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.responsavel-designado",aggregateType:"contrato",aggregateId:contractId,payload:{papel:item.papel,nome:item.nome},after:item}); return item; });
    },
    async registrarAditivoContrato(contexto, contractId, dados, versaoEsperada, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.gerir"); const chave=`aditivo-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.contracts WHERE id=$1 FOR UPDATE",[contractId]); if(!anterior.rows[0]) throw new ApiError(404,"CONTRATO_NAO_ENCONTRADO","Contrato não encontrado."); const antes=mapearContrato(anterior.rows[0]); if(antes.versao!==versaoEsperada) throw new ApiError(412,"VERSAO_DIVERGENTE","O contrato foi alterado por outro usuário."); if(!["vigente","suspenso"].includes(antes.status)) throw new ApiError(422,"CONTRATO_NAO_ADITAVEL","O contrato não aceita aditivos neste estágio."); const calculo=calcularAditivoContrato(antes,dados); const aditivo=await cliente.query(`INSERT INTO app.contract_amendments (tenant_id,id,team_id,contract_id,numero,tipo,justificativa,valor,nova_data_fim,dados,aprovado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.numero.trim(),dados.tipo,dados.justificativa.trim(),Number(dados.valor||0),dados.novaDataFim||null,dados.dados||{},validado.usuarioId]); const atualizado=await cliente.query("UPDATE app.contracts SET valor_atual=$2,data_fim=$3,versao=versao+1,atualizado_por=$4,atualizado_em=now() WHERE id=$1 RETURNING *",[contractId,calculo.novoValor,calculo.novaDataFim,validado.usuarioId]); const resposta={aditivo:mapearAditivoContrato(aditivo.rows[0]),contrato:mapearContrato(atualizado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.aditivo-registrado",aggregateType:"contrato",aggregateId:contractId,payload:{tipo:dados.tipo,valor:Number(dados.valor||0)},before:antes,after:resposta.contrato}); return resposta; });
    },
    async registrarGarantiaContrato(contexto, contractId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.gerir"); const chave=`garantia-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const resultado=await cliente.query(`INSERT INTO app.contract_guarantees (tenant_id,id,team_id,contract_id,tipo,numero,instituicao,valor,data_inicio,data_fim,status,dados,criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.tipo,dados.numero||"",dados.instituicao||"",Number(dados.valor||0),dados.dataInicio||null,dados.dataFim||null,dados.status||(dados.tipo==="dispensada"?"dispensada":"ativa"),dados.dados||{},validado.usuarioId]); const item=mapearGarantiaContrato(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.garantia-registrada",aggregateType:"contrato",aggregateId:contractId,payload:{tipo:item.tipo,valor:item.valor},after:item}); return item; });
    },
    async registrarOcorrenciaContrato(contexto, contractId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.fiscalizar"); const chave=`ocorrencia-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const resultado=await cliente.query(`INSERT INTO app.contract_occurrences (tenant_id,id,team_id,contract_id,data_ocorrencia,tipo,severidade,descricao,providencia,status,registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.dataOcorrencia||new Date().toISOString().slice(0,10),dados.tipo||"registro",dados.severidade||"baixa",dados.descricao.trim(),dados.providencia||"",dados.status||"aberta",validado.usuarioId]); const item=mapearOcorrenciaContrato(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.ocorrencia-registrada",aggregateType:"contrato",aggregateId:contractId,payload:{severidade:item.severidade},after:item}); return item; });
    },
    async aplicarSancaoContrato(contexto, contractId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.sancionar"); const chave=`sancao-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const resultado=await cliente.query(`INSERT INTO app.contract_sanctions (tenant_id,id,team_id,contract_id,occurrence_id,tipo,fundamento,valor,data_aplicacao,data_fim,status,aplicado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'aplicada',$11) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.occurrenceId||null,dados.tipo,dados.fundamento.trim(),Number(dados.valor||0),dados.dataAplicacao||new Date().toISOString().slice(0,10),dados.dataFim||null,validado.usuarioId]); const item=mapearSancaoContrato(resultado.rows[0]); await salvarIdempotencia(cliente,validado,chave,item); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.sancao-aplicada",aggregateType:"contrato",aggregateId:contractId,payload:{tipo:item.tipo,valor:item.valor},after:item}); return item; });
    },
    async registrarExecucaoContrato(contexto, contractId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => { exigirPermissao(validado,"contratos.fiscalizar"); const chave=`execucao-contrato:${idempotencyKey}`; const idem=await obterIdempotente(cliente,validado.tenantId,chave); if(idem) return idem; const anterior=await cliente.query("SELECT * FROM app.contracts WHERE id=$1 FOR UPDATE",[contractId]); if(!anterior.rows[0]) throw new ApiError(404,"CONTRATO_NAO_ENCONTRADO","Contrato não encontrado."); const antes=mapearContrato(anterior.rows[0]); if(antes.status!=="vigente") throw new ApiError(422,"CONTRATO_NAO_VIGENTE","Somente contrato vigente recebe execução."); const valor=Number(dados.valor); if(valor<=0||valor>antes.saldo) throw new ApiError(422,"EXECUCAO_SUPERIOR_AO_SALDO","A execução informada ultrapassa o saldo do contrato."); const execucao=await cliente.query(`INSERT INTO app.contract_executions (tenant_id,id,team_id,contract_id,origem,referencia_id,data_execucao,valor,descricao,registrado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[validado.tenantId,randomUUID(),validado.teamId,contractId,dados.origem||"manual",dados.referenciaId||"",dados.dataExecucao||new Date().toISOString().slice(0,10),valor,dados.descricao||"",validado.usuarioId]); const atualizado=await cliente.query("UPDATE app.contracts SET valor_executado=valor_executado+$2,versao=versao+1,atualizado_por=$3,atualizado_em=now() WHERE id=$1 RETURNING *",[contractId,valor,validado.usuarioId]); const resposta={execucao:mapearExecucaoContrato(execucao.rows[0]),contrato:mapearContrato(atualizado.rows[0])}; await salvarIdempotencia(cliente,validado,chave,resposta); await registrarEvento(cliente,validado,{moduleId:"contratos",eventType:"contratos.execucao-registrada",aggregateType:"contrato",aggregateId:contractId,payload:{origem:dados.origem||"manual",valor},before:antes,after:resposta.contrato}); return resposta; });
    },
    async listarOrcamentos(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.consultar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, nome, versao, dados, criado_por, criado_em, atualizado_em
             FROM app.orcamentos
            ORDER BY atualizado_em DESC`,
        );
        return resultado.rows.map(mapearOrcamento);
      });
    },
    async obterOrcamento(contexto, id) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.consultar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, nome, versao, dados, criado_por, criado_em, atualizado_em
             FROM app.orcamentos
            WHERE id = $1`,
          [id],
        );
        if (!resultado.rows[0]) {
          throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
        }
        return mapearOrcamento(resultado.rows[0]);
      });
    },
    async criarOrcamento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.editar");
        const chave = `orcamento:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;

        const id = randomUUID();
        const criado = await cliente.query(
          `INSERT INTO app.orcamentos
            (tenant_id, id, team_id, nome, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING tenant_id, id, team_id, nome, versao, dados, criado_por, criado_em, atualizado_em`,
          [
            validado.tenantId,
            id,
            validado.teamId || null,
            dados.nome,
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const resposta = mapearOrcamento(criado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, resposta);
        await registrarEvento(cliente, validado, {
          moduleId: "orcamentos",
          eventType: "orcamento.criado",
          aggregateType: "orcamento",
          aggregateId: resposta.id,
          payload: { nome: resposta.nome, versao: resposta.versao },
          after: resposta,
        });
        return resposta;
      });
    },
    async atualizarOrcamento(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.editar");
        const anterior = await cliente.query(
          `SELECT tenant_id, id, team_id, nome, versao, dados, criado_por,
                  criado_em, atualizado_em
             FROM app.orcamentos
            WHERE id = $1`,
          [id],
        );
        if (!anterior.rows[0]) {
          throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
        }
        const antes = mapearOrcamento(anterior.rows[0]);
        const resultado = await cliente.query(
          `UPDATE app.orcamentos
              SET nome = $2,
                  dados = $3,
                  versao = versao + 1,
                  atualizado_em = now()
            WHERE id = $1 AND versao = $4
          RETURNING tenant_id, id, team_id, nome, versao, dados, criado_por, criado_em, atualizado_em`,
          [id, dados.nome, dados.dados || {}, versaoEsperada],
        );
        if (resultado.rows[0]) {
          const resposta = mapearOrcamento(resultado.rows[0]);
          await registrarEvento(cliente, validado, {
            moduleId: "orcamentos",
            eventType: "orcamento.atualizado",
            aggregateType: "orcamento",
            aggregateId: resposta.id,
            payload: { versao: resposta.versao },
            before: antes,
            after: resposta,
          });
          return resposta;
        }
        const existe = await cliente.query("SELECT 1 FROM app.orcamentos WHERE id = $1", [id]);
        if (!existe.rows[0]) {
          throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
        }
        throw new ApiError(412, "VERSAO_DIVERGENTE", "O orçamento foi alterado por outro usuário.");
      });
    },
    async listarEmpreendimentos(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "empreendimento.consultar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, unidade_id, patrimonio_unidade_id, codigo, nome, tipo, status,
                  dados, versao, criado_por, criado_em, atualizado_em
             FROM app.empreendimentos
            ORDER BY atualizado_em DESC`,
        );
        return resultado.rows.map(mapearEmpreendimento);
      });
    },
    async criarEmpreendimento(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "empreendimento.editar");
        const chave = `empreendimento:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        if (dados.patrimonioUnidadeId) {
          const unidadePatrimonial = await cliente.query(
            "SELECT 1 FROM app.patrimonial_units WHERE id=$1",
            [dados.patrimonioUnidadeId],
          );
          if (!unidadePatrimonial.rows[0]) {
            throw new ApiError(422, "REFERENCIA_PATRIMONIAL_INVALIDA", "A unidade patrimonial não pertence à empresa e equipe selecionadas.");
          }
        }
        const resultado = await cliente.query(
          `INSERT INTO app.empreendimentos
            (tenant_id, id, team_id, unidade_id, patrimonio_unidade_id, codigo, nome, tipo, status, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING tenant_id, id, team_id, unidade_id, patrimonio_unidade_id, codigo, nome, tipo, status,
                     dados, versao, criado_por, criado_em, atualizado_em`,
          [
            validado.tenantId,
            randomUUID(),
            validado.teamId || null,
            dados.unidadeId || null,
            dados.patrimonioUnidadeId || null,
            dados.codigo || "",
            dados.nome,
            dados.tipo || "obra",
            dados.status || "planejamento",
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const resposta = mapearEmpreendimento(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, resposta);
        await registrarEvento(cliente, validado, {
          moduleId: "obras",
          eventType: "empreendimento.criado",
          aggregateType: "empreendimento",
          aggregateId: resposta.id,
          payload: { nome: resposta.nome, tipo: resposta.tipo },
          after: resposta,
        });
        return resposta;
      });
    },
    async listarRevisoes(contexto, orcamentoId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.consultar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, orcamento_id, numero, tipo, status,
                  impacto_valor, impacto_prazo_dias, dados, criado_por, criado_em
             FROM app.orcamento_revisoes
            WHERE orcamento_id = $1
            ORDER BY numero DESC`,
          [orcamentoId],
        );
        return resultado.rows.map(mapearRevisao);
      });
    },
    async criarRevisao(contexto, orcamentoId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.revisar");
        const chave = `revisao:${orcamentoId}:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const orcamento = await cliente.query(
          "SELECT team_id FROM app.orcamentos WHERE id = $1",
          [orcamentoId],
        );
        if (!orcamento.rows[0]) {
          throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
        }
        const resultado = await cliente.query(
          `INSERT INTO app.orcamento_revisoes
            (tenant_id, id, team_id, orcamento_id, numero, tipo, status,
             impacto_valor, impacto_prazo_dias, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING tenant_id, id, team_id, orcamento_id, numero, tipo, status,
                     impacto_valor, impacto_prazo_dias, dados, criado_por, criado_em`,
          [
            validado.tenantId,
            randomUUID(),
            orcamento.rows[0].team_id,
            orcamentoId,
            dados.numero,
            dados.tipo,
            dados.status || "rascunho",
            dados.impactoValor || 0,
            dados.impactoPrazoDias || 0,
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const resposta = mapearRevisao(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, resposta);
        await registrarEvento(cliente, validado, {
          moduleId: "orcamentos",
          eventType: "orcamento.revisao-criada",
          aggregateType: "orcamento",
          aggregateId: orcamentoId,
          payload: { revisaoId: resposta.id, numero: resposta.numero, tipo: resposta.tipo },
          after: resposta,
        });
        return resposta;
      });
    },
    async listarMedicoes(contexto, orcamentoId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "medicao.consultar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, orcamento_id, revisao_id, numero, status,
                  periodo_inicio, periodo_fim, valor_bruto, retencoes, multas,
                  valor_liquido, dados, versao, criado_por, criado_em, atualizado_em
             FROM app.medicoes
            WHERE orcamento_id = $1
            ORDER BY numero DESC`,
          [orcamentoId],
        );
        return resultado.rows.map(mapearMedicao);
      });
    },
    async criarMedicao(contexto, orcamentoId, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "medicao.registrar");
        const chave = `medicao:${orcamentoId}:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const orcamento = await cliente.query(
          "SELECT team_id FROM app.orcamentos WHERE id = $1",
          [orcamentoId],
        );
        if (!orcamento.rows[0]) {
          throw new ApiError(404, "ORCAMENTO_NAO_ENCONTRADO", "Orçamento não encontrado.");
        }
        const resultado = await cliente.query(
          `INSERT INTO app.medicoes
            (tenant_id, id, team_id, orcamento_id, revisao_id, numero, status,
             periodo_inicio, periodo_fim, valor_bruto, retencoes, multas, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING tenant_id, id, team_id, orcamento_id, revisao_id, numero, status,
                     periodo_inicio, periodo_fim, valor_bruto, retencoes, multas,
                     valor_liquido, dados, versao, criado_por, criado_em, atualizado_em`,
          [
            validado.tenantId,
            randomUUID(),
            orcamento.rows[0].team_id,
            orcamentoId,
            dados.revisaoId || null,
            dados.numero,
            dados.status || "rascunho",
            dados.periodoInicio || null,
            dados.periodoFim || null,
            dados.valorBruto || 0,
            dados.retencoes || 0,
            dados.multas || 0,
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const resposta = mapearMedicao(resultado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, resposta);
        await registrarEvento(cliente, validado, {
          moduleId: "medicoes",
          eventType: "medicao.criada",
          aggregateType: "orcamento",
          aggregateId: orcamentoId,
          payload: { medicaoId: resposta.id, numero: resposta.numero },
          after: resposta,
        });
        return resposta;
      });
    },
    async listarPublicacoesCatalogo(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "bases.consultar");
        const resultado = await cliente.query(
          `SELECT p.id, p.tenant_id, p.source_id, s.nome AS fonte, s.gestor,
                  p.referencia, p.regime, p.status, p.hash_fonte, p.arquivo_nome,
                  p.contagens, p.dados, p.criado_por, p.criado_em, p.atualizado_em
             FROM app.catalog_publications p
             JOIN app.catalog_sources s ON s.id = p.source_id
            WHERE ($1::text IS NULL OR s.codigo = $1 OR p.source_id = $1)
            ORDER BY p.referencia DESC, s.nome`,
          [filtros.sourceId || null],
        );
        return resultado.rows.map(mapearPublicacao);
      });
    },
    async criarPublicacaoCatalogo(contexto, dados, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "bases.administrar");
        const chave = `catalogo-publicacao:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const sourceId = chaveFontePrivada(validado.tenantId, dados.sourceId);
        await cliente.query(
          `INSERT INTO app.catalog_sources
            (id, tenant_id, codigo, nome, gestor, escopo, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, 'privada', $6, $7)
           ON CONFLICT (id) DO UPDATE
             SET nome = EXCLUDED.nome,
                 gestor = EXCLUDED.gestor,
                 status = 'ativa',
                 dados = EXCLUDED.dados,
                 atualizado_em = now()`,
          [
            sourceId,
            validado.tenantId,
            dados.sourceId,
            dados.fonte,
            dados.gestor || "",
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const criado = await cliente.query(
          `INSERT INTO app.catalog_publications
            (id, source_id, tenant_id, referencia, regime, status, hash_fonte,
             arquivo_nome, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, 'rascunho', $6, $7, $8, $9)
           RETURNING id, tenant_id, source_id, referencia, regime, status,
                     hash_fonte, arquivo_nome, contagens, dados, criado_por,
                     criado_em, atualizado_em`,
          [
            randomUUID(),
            sourceId,
            validado.tenantId,
            dados.referencia,
            dados.regime || "PADRAO",
            dados.hashFonte || "",
            dados.arquivoNome || "",
            dados.dados || {},
            validado.usuarioId,
          ],
        );
        const resposta = mapearPublicacao({
          ...criado.rows[0],
          fonte: dados.fonte,
          gestor: dados.gestor || "",
        });
        await salvarIdempotencia(cliente, validado, chave, resposta);
        return resposta;
      });
    },
    async salvarItensCatalogo(contexto, publicacaoId, itens, idempotencyKey) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "bases.administrar");
        const chave = `catalogo-itens:${publicacaoId}:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const publicacao = await cliente.query(
          `SELECT id FROM app.catalog_publications
            WHERE id = $1 AND tenant_id = $2 AND status <> 'homologada'`,
          [publicacaoId, validado.tenantId],
        );
        if (!publicacao.rows[0]) {
          throw new ApiError(
            404,
            "PUBLICACAO_NAO_ENCONTRADA",
            "Publicação privada editável não encontrada.",
          );
        }
        for (const item of itens) {
          const codigo = String(item.codigo || "").trim();
          if (!codigo) {
            throw new ApiError(422, "ITEM_CATALOGO_INVALIDO", "Item sem código.");
          }
          const tipo = normalizarTipoCatalogo(item.tipo);
          const salvo = await cliente.query(
            `INSERT INTO app.catalog_items
              (publication_id, id, tenant_id, tipo, codigo, descricao, unidade,
               classificacao, dados)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (publication_id, tipo, codigo) DO UPDATE
               SET descricao = EXCLUDED.descricao,
                   unidade = EXCLUDED.unidade,
                   classificacao = EXCLUDED.classificacao,
                   dados = EXCLUDED.dados
             RETURNING id`,
            [
              publicacaoId,
              randomUUID(),
              validado.tenantId,
              tipo,
              codigo,
              String(item.descricao || codigo),
              String(item.unidade || ""),
              String(item.classificacao || ""),
              item,
            ],
          );
          const itemId = salvo.rows[0].id;
          await cliente.query(
            "DELETE FROM app.catalog_prices WHERE publication_id = $1 AND item_id = $2",
            [publicacaoId, itemId],
          );
          const precos = item.precosPorUf && typeof item.precosPorUf === "object"
            ? Object.entries(item.precosPorUf)
            : [[String(item.uf || item.baseUf || "BR"), item.preco ?? null]];
          for (const [ufBruta, valorBruto] of precos) {
            const uf = String(ufBruta || "BR").toUpperCase();
            const valor = valorBruto && typeof valorBruto === "object"
              ? valorBruto.preco
              : valorBruto;
            await cliente.query(
              `INSERT INTO app.catalog_prices
                (publication_id, item_id, tenant_id, uf, preco,
                 percentual_mao_obra, custo_mao_obra, custo_material,
                 custo_equipamento, sem_preco, dados)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                publicacaoId,
                itemId,
                validado.tenantId,
                uf,
                valor == null ? null : Number(valor),
                Number(item.percentuaisMaoObraPorUf?.[uf] ?? item.percentualMaoObra) || null,
                Number(item.custosMaoObraPorUf?.[uf] ?? item.custoMaoObra) || null,
                Number(item.custosMaterialPorUf?.[uf] ?? item.custoMaterial) || null,
                Number(item.custosEquipamentoPorUf?.[uf] ?? item.custoEquipamento) || null,
                Boolean(item.semPreco || !(Number(valor) > 0)),
                valorBruto && typeof valorBruto === "object" ? valorBruto : {},
              ],
            );
          }
          await cliente.query(
            `DELETE FROM app.catalog_composition_components
              WHERE publication_id = $1 AND composition_item_id = $2`,
            [publicacaoId, itemId],
          );
          const componentes = Array.isArray(item.componentes) ? item.componentes : [];
          for (const [indice, componente] of componentes.entries()) {
            await cliente.query(
              `INSERT INTO app.catalog_composition_components
                (publication_id, composition_item_id, sequencia, tenant_id,
                 componente_tipo, componente_codigo, coeficiente, unidade,
                 preco_basico, dados)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                publicacaoId,
                itemId,
                indice + 1,
                validado.tenantId,
                normalizarTipoCatalogo(
                  componente.referenciaTipo || componente.itemTipo || componente.tipo,
                ),
                String(
                  componente.referenciaCodigo || componente.itemCodigo || componente.codigo || "",
                ),
                Number(componente.coeficiente) || 0,
                String(componente.unidade || ""),
                componente.preco == null ? null : Number(componente.preco),
                componente,
              ],
            );
          }
        }
        const contagem = await cliente.query(
          `SELECT count(*)::integer AS itens,
                  count(*) FILTER (WHERE tipo = 'composicao')::integer AS composicoes,
                  count(*) FILTER (WHERE tipo <> 'composicao')::integer AS insumos
             FROM app.catalog_items WHERE publication_id = $1`,
          [publicacaoId],
        );
        await cliente.query(
          `UPDATE app.catalog_publications
              SET contagens = $2, atualizado_em = now()
            WHERE id = $1`,
          [publicacaoId, contagem.rows[0]],
        );
        const resposta = {
          publicacaoId,
          recebidos: itens.length,
          total: Number(contagem.rows[0].itens),
          contagens: contagem.rows[0],
        };
        await salvarIdempotencia(cliente, validado, chave, resposta);
        return resposta;
      });
    },
    async listarItensCatalogo(contexto, publicacaoId, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "bases.consultar");
        const limite = Math.min(Math.max(Number(filtros.limite) || 100, 1), 500);
        const deslocamento = Math.max(Number(filtros.deslocamento) || 0, 0);
        const resultado = await cliente.query(
          `WITH filtrados AS (
             SELECT i.*
               FROM app.catalog_items i
              WHERE i.publication_id = $1
                AND ($2::text IS NULL OR i.tipo = $2)
                AND (
                  $3::text IS NULL
                  OR i.codigo ILIKE '%' || $3 || '%'
                  OR i.descricao ILIKE '%' || $3 || '%'
                )
           )
           SELECT f.*, count(*) OVER()::integer AS total,
                  coalesce((
                    SELECT jsonb_object_agg(p.uf, jsonb_build_object(
                      'preco', p.preco,
                      'semPreco', p.sem_preco,
                      'percentualMaoObra', p.percentual_mao_obra,
                      'custoMaoObra', p.custo_mao_obra,
                      'custoMaterial', p.custo_material,
                      'custoEquipamento', p.custo_equipamento
                    ))
                      FROM app.catalog_prices p
                     WHERE p.publication_id = f.publication_id AND p.item_id = f.id
                  ), '{}'::jsonb) AS precos_por_uf
             FROM filtrados f
            ORDER BY f.tipo, f.codigo
            LIMIT $4 OFFSET $5`,
          [publicacaoId, filtros.tipo || null, filtros.busca || null, limite, deslocamento],
        );
        const itensMapeados = resultado.rows.map((linha) => {
          const precos = linha.precos_por_uf || {};
          const uf = String(filtros.uf || "RS").toUpperCase();
          const precoEscolhido = precos[uf] || precos.SP || precos.BR || null;
          return {
            id: linha.id,
            publicationId: linha.publication_id,
            tipo: linha.tipo,
            codigo: linha.codigo,
            descricao: linha.descricao,
            unidade: linha.unidade,
            classificacao: linha.classificacao,
            dados: linha.dados,
            precosPorUf: precos,
            preco: precoEscolhido?.preco == null ? null : Number(precoEscolhido.preco),
            ufPreco: precos[uf] ? uf : precos.SP ? "SP" : precos.BR ? "BR" : "",
            precoSubstituido: !precos[uf] && Boolean(precoEscolhido),
          };
        });
        return {
          itens: itensMapeados,
          total: Number(resultado.rows[0]?.total || 0),
          limite,
          deslocamento,
        };
      });
    },
    async listarComponentesCatalogo(contexto, publicacaoId, codigo, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "bases.consultar");
        const uf = String(filtros.uf || "RS").toUpperCase();
        const resultado = await cliente.query(
          `SELECT c.sequencia, c.componente_tipo, c.componente_codigo,
                  c.coeficiente, c.unidade, c.preco_basico, c.dados,
                  r.descricao, r.unidade AS referencia_unidade,
                  p.uf AS preco_uf, p.preco, p.sem_preco,
                  p.custo_mao_obra, p.custo_material, p.custo_equipamento
             FROM app.catalog_items composicao
             JOIN app.catalog_composition_components c
               ON c.publication_id = composicao.publication_id
              AND c.composition_item_id = composicao.id
             LEFT JOIN app.catalog_items r
               ON r.publication_id = c.publication_id
              AND r.tipo = c.componente_tipo
              AND r.codigo = c.componente_codigo
             LEFT JOIN LATERAL (
               SELECT cp.*
                 FROM app.catalog_prices cp
                WHERE cp.publication_id = r.publication_id AND cp.item_id = r.id
                ORDER BY (cp.uf = $3) DESC, (cp.uf = 'SP') DESC, (cp.uf = 'BR') DESC
                LIMIT 1
             ) p ON true
            WHERE composicao.publication_id = $1
              AND composicao.tipo = 'composicao'
              AND composicao.codigo = $2
            ORDER BY c.sequencia`,
          [publicacaoId, codigo, uf],
        );
        return resultado.rows.map((linha) => ({
          sequencia: linha.sequencia,
          referenciaTipo: linha.componente_tipo,
          referenciaCodigo: linha.componente_codigo,
          descricao: linha.descricao || "",
          unidade: linha.referencia_unidade || linha.unidade,
          coeficiente: Number(linha.coeficiente),
          preco: linha.preco == null
            ? (linha.preco_basico == null ? null : Number(linha.preco_basico))
            : Number(linha.preco),
          ufPreco: linha.preco_uf || "",
          precoSubstituido: Boolean(linha.preco_uf && linha.preco_uf !== uf),
          custoMaoObra: Number(linha.custo_mao_obra) || 0,
          custoMaterial: Number(linha.custo_material) || 0,
          custoEquipamento: Number(linha.custo_equipamento) || 0,
          dados: linha.dados || {},
        }));
      });
    },
    async listarLotesMigracao(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "migracao.administrar");
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, contrato, hash, idempotency_key,
                  status, contagens, erros, criado_por, criado_em, recebido_em,
                  validado_por, validado_em, homologado_por, homologado_em
             FROM app.migration_batches
            ORDER BY recebido_em DESC`,
        );
        return resultado.rows.map(mapearLote);
      });
    },
    async receberLoteMigracao(contexto, pacote, idempotencyKey) {
      const avaliacao = validarPacoteNoServidor(pacote, contexto);
      if (!avaliacao.valido) {
        throw new ApiError(
          422,
          "PACOTE_MIGRACAO_INVALIDO",
          "O pacote de migração é inválido.",
          avaliacao.erros,
        );
      }
      if (idempotencyKey !== pacote.idempotencyKey) {
        throw new ApiError(
          422,
          "IDEMPOTENCIA_DIVERGENTE",
          "A chave do cabeçalho diverge do pacote.",
        );
      }
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "migracao.administrar");
        const existente = await cliente.query(
          `SELECT tenant_id, id, team_id, contrato, hash, idempotency_key,
                  status, contagens, erros, criado_por, criado_em, recebido_em,
                  validado_por, validado_em, homologado_por, homologado_em
             FROM app.migration_batches
            WHERE hash = $1 OR idempotency_key = $2`,
          [pacote.hash, idempotencyKey],
        );
        if (existente.rows[0]) return mapearLote(existente.rows[0]);
        const loteId = randomUUID();
        const criado = await cliente.query(
          `INSERT INTO app.migration_batches
            (tenant_id, id, team_id, contrato, hash, idempotency_key, status,
             contagens, criado_por, criado_em)
           VALUES ($1, $2, $3, $4, $5, $6, 'recebido', $7, $8, $9)
           RETURNING tenant_id, id, team_id, contrato, hash, idempotency_key,
                     status, contagens, erros, criado_por, criado_em, recebido_em,
                     validado_por, validado_em, homologado_por, homologado_em`,
          [
            validado.tenantId,
            loteId,
            validado.teamId || null,
            pacote.contrato,
            pacote.hash,
            idempotencyKey,
            avaliacao.contagens,
            validado.usuarioId,
            pacote.criadoEm,
          ],
        );
        for (const dominio of pacote.dominios) {
          for (const [indice, registro] of dominio.registros.entries()) {
            await cliente.query(
              `INSERT INTO app.migration_batch_records
                (tenant_id, batch_id, dominio_id, sequencia, origem_id, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                validado.tenantId,
                loteId,
                dominio.id,
                indice + 1,
                String(registro.id || registro.codigo || ""),
                registro,
              ],
            );
          }
        }
        return mapearLote(criado.rows[0]);
      });
    },
    async validarLoteMigracao(contexto, loteId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "migracao.administrar");
        const lote = await cliente.query(
          `SELECT tenant_id, id, team_id, contrato, hash, idempotency_key,
                  status, contagens, erros, criado_por, criado_em, recebido_em,
                  validado_por, validado_em, homologado_por, homologado_em
             FROM app.migration_batches WHERE id = $1 FOR UPDATE`,
          [loteId],
        );
        if (!lote.rows[0]) {
          throw new ApiError(404, "LOTE_NAO_ENCONTRADO", "Lote de migração não encontrado.");
        }
        if (lote.rows[0].status === "homologado") return mapearLote(lote.rows[0]);
        const contagens = await cliente.query(
          `SELECT dominio_id, count(*)::integer AS total
             FROM app.migration_batch_records
            WHERE batch_id = $1
            GROUP BY dominio_id`,
          [loteId],
        );
        const reais = Object.fromEntries(
          contagens.rows.map((item) => [item.dominio_id, Number(item.total)]),
        );
        const esperadas = lote.rows[0].contagens || {};
        const erros = Object.entries(esperadas)
          .filter(([dominio, total]) => Number(reais[dominio] || 0) !== Number(total))
          .map(([dominio]) => `${dominio}: contagem da área temporária divergente.`);
        await cliente.query(
          `UPDATE app.migration_batch_records
              SET status = $2, erros = $3
            WHERE batch_id = $1`,
          [loteId, erros.length ? "invalido" : "valido", erros],
        );
        const atualizado = await cliente.query(
          `UPDATE app.migration_batches
              SET status = $2, erros = $3, validado_por = $4, validado_em = now()
            WHERE id = $1
          RETURNING tenant_id, id, team_id, contrato, hash, idempotency_key,
                    status, contagens, erros, criado_por, criado_em, recebido_em,
                    validado_por, validado_em, homologado_por, homologado_em`,
          [
            loteId,
            erros.length ? "rejeitado" : "validado",
            erros,
            validado.usuarioId,
          ],
        );
        return mapearLote(atualizado.rows[0]);
      });
    },
    async homologarLoteMigracao(contexto, loteId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "migracao.administrar");
        const lote = await cliente.query(
          `SELECT tenant_id, id, team_id, contrato, hash, idempotency_key,
                  status, contagens, erros, criado_por, criado_em, recebido_em,
                  validado_por, validado_em, homologado_por, homologado_em
             FROM app.migration_batches WHERE id = $1 FOR UPDATE`,
          [loteId],
        );
        if (!lote.rows[0]) {
          throw new ApiError(404, "LOTE_NAO_ENCONTRADO", "Lote de migração não encontrado.");
        }
        if (lote.rows[0].status === "homologado") return mapearLote(lote.rows[0]);
        if (lote.rows[0].status !== "validado") {
          throw new ApiError(409, "LOTE_NAO_VALIDADO", "Valide o lote antes da homologação.");
        }
        await cliente.query(
          "UPDATE app.migration_batches SET status = 'homologando' WHERE id = $1",
          [loteId],
        );
        const registros = await cliente.query(
          `SELECT dominio_id, sequencia, origem_id, payload, status, destino_id
             FROM app.migration_batch_records
            WHERE batch_id = $1
            ORDER BY dominio_id, sequencia`,
          [loteId],
        );
        for (const registro of registros.rows) {
          if (registro.status === "homologado") continue;
          const dados = registro.payload || {};
          let destinoTipo = registro.dominio_id;
          let destinoId = "";
          if (registro.dominio_id === "orcamentos") {
            destinoId = randomUUID();
            await cliente.query(
              `INSERT INTO app.orcamentos
                (tenant_id, id, team_id, nome, dados, criado_por)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                validado.tenantId,
                destinoId,
                validado.teamId || null,
                String(dados.nome || `Orçamento migrado ${registro.origem_id}`),
                { ...dados, idOrigemMigracao: registro.origem_id, loteMigracaoId: loteId },
                validado.usuarioId,
              ],
            );
          } else if (registro.dominio_id === "composicoes-proprias") {
            destinoTipo = "composicao-propria";
            destinoId = String(dados.id || dados.codigo || randomUUID());
            await cliente.query(
              `INSERT INTO app.own_compositions
                (tenant_id, id, codigo, descricao, unidade, custo_unitario,
                 dados, criado_por)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (tenant_id, id) DO UPDATE
                 SET codigo = EXCLUDED.codigo,
                     descricao = EXCLUDED.descricao,
                     unidade = EXCLUDED.unidade,
                     custo_unitario = EXCLUDED.custo_unitario,
                     dados = EXCLUDED.dados,
                     versao = app.own_compositions.versao + 1,
                     atualizado_em = now()`,
              [
                validado.tenantId,
                destinoId,
                String(dados.codigo || destinoId),
                String(dados.descricao || dados.nome || destinoId),
                String(dados.unidade || ""),
                Number(dados.custoUnitario) || 0,
                dados,
                validado.usuarioId,
              ],
            );
            await cliente.query(
              `DELETE FROM app.own_composition_components
                WHERE tenant_id = $1 AND composition_id = $2`,
              [validado.tenantId, destinoId],
            );
            for (const [indice, componente] of (dados.componentes || []).entries()) {
              await cliente.query(
                `INSERT INTO app.own_composition_components
                  (tenant_id, composition_id, sequencia, base_preco_id,
                   referencia_tipo, referencia_codigo, coeficiente, preco, dados)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  validado.tenantId,
                  destinoId,
                  indice + 1,
                  String(componente.basePrecoId || ""),
                  String(componente.referenciaTipo || componente.tipo || "insumo"),
                  String(componente.referenciaCodigo || componente.codigo || ""),
                  Number(componente.coeficiente) || 0,
                  componente.preco == null ? null : Number(componente.preco),
                  componente,
                ],
              );
            }
          } else if (registro.dominio_id === "bases-precos") {
            destinoTipo = "publicacao-catalogo";
            const codigoFonte = String(dados.fonte || dados.codigo || "BASE");
            const sourceId = chaveFontePrivada(validado.tenantId, codigoFonte);
            await cliente.query(
              `INSERT INTO app.catalog_sources
                (id, tenant_id, codigo, nome, gestor, escopo, dados, criado_por)
               VALUES ($1, $2, $3, $4, $5, 'privada', $6, $7)
               ON CONFLICT (id) DO UPDATE
                 SET nome = EXCLUDED.nome, dados = EXCLUDED.dados, atualizado_em = now()`,
              [
                sourceId,
                validado.tenantId,
                codigoFonte,
                String(dados.titulo || dados.fonte || codigoFonte),
                String(dados.gestor || ""),
                dados,
                validado.usuarioId,
              ],
            );
            destinoId = randomUUID();
            await cliente.query(
              `INSERT INTO app.catalog_publications
                (id, source_id, tenant_id, referencia, regime, status, hash_fonte,
                 arquivo_nome, contagens, dados, homologada_por, homologada_em, criado_por)
               VALUES ($1, $2, $3, $4, $5, 'homologada', $6, $7, $8, $9, $10, now(), $10)`,
              [
                destinoId,
                sourceId,
                validado.tenantId,
                String(dados.referencia || "SEM-REFERENCIA"),
                String(dados.regime || "PADRAO"),
                String(dados.hashFonte || ""),
                String(dados.arquivoNome || ""),
                {
                  itens: Number(dados.total || dados.registros) || 0,
                  composicoes: Number(dados.composicoes) || 0,
                  insumos: Number(dados.insumos) || 0,
                },
                dados,
                validado.usuarioId,
              ],
            );
          } else if (registro.dominio_id === "configuracoes") {
            destinoTipo = "configuracao";
            destinoId = String(dados.id || dados.chave || `config-${registro.sequencia}`);
            await cliente.query(
              `INSERT INTO app.tenant_settings (tenant_id, chave, valor, atualizado_por)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (tenant_id, chave) DO UPDATE
                 SET valor = EXCLUDED.valor,
                     atualizado_por = EXCLUDED.atualizado_por,
                     atualizado_em = now()`,
              [validado.tenantId, destinoId, dados, validado.usuarioId],
            );
          }
          await cliente.query(
            `UPDATE app.migration_batch_records
                SET status = 'homologado', destino_tipo = $4, destino_id = $5
              WHERE batch_id = $1 AND dominio_id = $2 AND sequencia = $3`,
            [loteId, registro.dominio_id, registro.sequencia, destinoTipo, destinoId],
          );
        }
        const dominiosHomologados = await cliente.query(
          `SELECT dominio_id
             FROM app.migration_batch_records
            WHERE batch_id = $1
            GROUP BY dominio_id
           HAVING count(*) > 0`,
          [loteId],
        );
        for (const { dominio_id: dominioId } of dominiosHomologados.rows) {
          await cliente.query(
            `INSERT INTO app.repository_transitions
              (tenant_id, team_id, dominio_id, modo, batch_id, sincronizado_em,
               ativado_por)
             VALUES ($1, NULL, $2, 'hibrido', $3, now(), $4)
             ON CONFLICT (tenant_id, dominio_id) DO UPDATE
               SET modo = CASE
                   WHEN app.repository_transitions.modo = 'corporativo'
                     THEN 'corporativo'
                   ELSE 'hibrido'
                 END,
                   batch_id = EXCLUDED.batch_id,
                   sincronizado_em = now(),
                   ativado_por = EXCLUDED.ativado_por,
                   atualizado_em = now()`,
            [validado.tenantId, dominioId, loteId, validado.usuarioId],
          );
        }
        const atualizado = await cliente.query(
          `UPDATE app.migration_batches
              SET status = 'homologado', homologado_por = $2, homologado_em = now()
            WHERE id = $1
          RETURNING tenant_id, id, team_id, contrato, hash, idempotency_key,
                    status, contagens, erros, criado_por, criado_em, recebido_em,
                    validado_por, validado_em, homologado_por, homologado_em`,
          [loteId, validado.usuarioId],
        );
        return mapearLote(atualizado.rows[0]);
      });
    },
    async listarTrabalhos(contexto, filtros = {}) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "trabalho.consultar");
        const parametros = [];
        const condicoes = [];
        if (filtros.status) {
          parametros.push(String(filtros.status));
          condicoes.push(`status = $${parametros.length}`);
        }
        const resultado = await cliente.query(
          `SELECT tenant_id, id, team_id, tipo, status, prioridade, payload,
                  progresso, resultado, erro, tentativas, max_tentativas,
                  criado_por, criado_em, iniciado_em, concluido_em, atualizado_em
             FROM app.jobs
            ${condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : ""}
            ORDER BY criado_em DESC
            LIMIT 100`,
          parametros,
        );
        return resultado.rows.map(mapearTrabalho);
      });
    },
    async criarTrabalho(contexto, dados, idempotencyKey) {
      const avaliacao = validarSolicitacaoTrabalho(dados);
      if (!avaliacao.valido) {
        throw new ApiError(
          422,
          "TRABALHO_INVALIDO",
          "O trabalho solicitado é inválido.",
          avaliacao.erros,
        );
      }
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "trabalho.administrar");
        const chave = `trabalho:${idempotencyKey}`;
        const anterior = await obterIdempotente(cliente, validado.tenantId, chave);
        if (anterior) return anterior;
        const id = randomUUID();
        const criado = await cliente.query(
          `INSERT INTO app.jobs
            (tenant_id, id, team_id, tipo, prioridade, payload, max_tentativas,
             criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING tenant_id, id, team_id, tipo, status, prioridade, payload,
                     progresso, resultado, erro, tentativas, max_tentativas,
                     criado_por, criado_em, iniciado_em, concluido_em, atualizado_em`,
          [
            validado.tenantId,
            id,
            validado.teamId || null,
            dados.tipo,
            Number(dados.prioridade) || 50,
            dados.payload,
            Number(dados.maxTentativas) || 3,
            validado.usuarioId,
          ],
        );
        const resposta = mapearTrabalho(criado.rows[0]);
        await salvarIdempotencia(cliente, validado, chave, resposta);
        await cliente.query(
          `INSERT INTO app.job_events
            (tenant_id, job_id, tipo, progresso, mensagem)
           VALUES ($1, $2, 'criado', 0, 'Trabalho adicionado à fila')`,
          [validado.tenantId, id],
        );
        return resposta;
      });
    },
    async iniciarTrabalho(contexto, trabalhoId, workerId) {
      return comContexto(contexto, async (cliente) => {
        const resultado = await cliente.query(
          `UPDATE app.jobs
              SET status = 'processando',
                  progresso = 1,
                  tentativas = tentativas + 1,
                  bloqueado_por = $2,
                  bloqueado_ate = now() + interval '15 minutes',
                  iniciado_em = coalesce(iniciado_em, now()),
                  atualizado_em = now()
            WHERE id = $1
              AND status = 'pendente'
              AND disponivel_em <= now()
          RETURNING tenant_id, id, team_id, tipo, status, prioridade, payload,
                    progresso, resultado, erro, tentativas, max_tentativas,
                    criado_por, criado_em, iniciado_em, concluido_em, atualizado_em`,
          [trabalhoId, workerId],
        );
        if (resultado.rows[0]) {
          await cliente.query(
            `INSERT INTO app.job_events
              (tenant_id, job_id, tipo, progresso, mensagem)
             VALUES ($1, $2, 'iniciado', 1, 'Processamento iniciado')`,
            [resultado.rows[0].tenant_id, trabalhoId],
          );
          return mapearTrabalho(resultado.rows[0]);
        }
        const existente = await cliente.query(
          `SELECT tenant_id, id, team_id, tipo, status, prioridade, payload,
                  progresso, resultado, erro, tentativas, max_tentativas,
                  criado_por, criado_em, iniciado_em, concluido_em, atualizado_em
             FROM app.jobs WHERE id = $1`,
          [trabalhoId],
        );
        if (!existente.rows[0]) {
          throw new ApiError(404, "TRABALHO_NAO_ENCONTRADO", "Trabalho não encontrado.");
        }
        return mapearTrabalho(existente.rows[0]);
      });
    },
    async concluirTrabalho(contexto, trabalhoId, resultadoTrabalho) {
      return comContexto(contexto, async (cliente) => {
        const resultado = await cliente.query(
          `UPDATE app.jobs
              SET status = 'concluido', progresso = 100, resultado = $2,
                  erro = NULL, bloqueado_por = NULL, bloqueado_ate = NULL,
                  concluido_em = now(), atualizado_em = now()
            WHERE id = $1 AND status = 'processando'
          RETURNING tenant_id, id, team_id, tipo, status, prioridade, payload,
                    progresso, resultado, erro, tentativas, max_tentativas,
                    criado_por, criado_em, iniciado_em, concluido_em, atualizado_em`,
          [trabalhoId, resultadoTrabalho || {}],
        );
        if (!resultado.rows[0]) {
          throw new ApiError(409, "TRABALHO_NAO_PROCESSANDO", "O trabalho não está em processamento.");
        }
        await cliente.query(
          `INSERT INTO app.job_events
            (tenant_id, job_id, tipo, progresso, mensagem, dados)
           VALUES ($1, $2, 'concluido', 100, 'Processamento concluído', $3)`,
          [resultado.rows[0].tenant_id, trabalhoId, resultadoTrabalho || {}],
        );
        return mapearTrabalho(resultado.rows[0]);
      });
    },
    async falharTrabalho(contexto, trabalhoId, erroTrabalho) {
      return comContexto(contexto, async (cliente) => {
        const resultado = await cliente.query(
          `UPDATE app.jobs
              SET status = 'falhou', erro = $2, bloqueado_por = NULL,
                  bloqueado_ate = NULL, concluido_em = now(), atualizado_em = now()
            WHERE id = $1 AND status = 'processando'
          RETURNING tenant_id, id, team_id, tipo, status, prioridade, payload,
                    progresso, resultado, erro, tentativas, max_tentativas,
                    criado_por, criado_em, iniciado_em, concluido_em, atualizado_em`,
          [trabalhoId, erroTrabalho || {}],
        );
        if (!resultado.rows[0]) {
          throw new ApiError(409, "TRABALHO_NAO_PROCESSANDO", "O trabalho não está em processamento.");
        }
        await cliente.query(
          `INSERT INTO app.job_events
            (tenant_id, job_id, tipo, progresso, mensagem, dados)
           VALUES ($1, $2, 'falhou', $3, 'Falha no processamento', $4)`,
          [
            resultado.rows[0].tenant_id,
            trabalhoId,
            Number(resultado.rows[0].progresso) || 0,
            erroTrabalho || {},
          ],
        );
        return mapearTrabalho(resultado.rows[0]);
      });
    },
    async reprocessarTrabalho(contexto, trabalhoId) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "trabalho.administrar");
        const resultado = await cliente.query(
          `UPDATE app.jobs
              SET status = 'pendente', progresso = 0, erro = NULL,
                  concluido_em = NULL, disponivel_em = now(), atualizado_em = now()
            WHERE id = $1 AND status = 'falhou' AND tentativas < max_tentativas
          RETURNING tenant_id, id, team_id, tipo, status, prioridade, payload,
                    progresso, resultado, erro, tentativas, max_tentativas,
                    criado_por, criado_em, iniciado_em, concluido_em, atualizado_em`,
          [trabalhoId],
        );
        if (!resultado.rows[0]) {
          throw new ApiError(409, "TRABALHO_NAO_REPROCESSAVEL", "O trabalho não pode ser reprocessado.");
        }
        return mapearTrabalho(resultado.rows[0]);
      });
    },
    async listarTransicoesRepositorio(contexto) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "migracao.administrar");
        const resultado = await cliente.query(
          `SELECT tenant_id, team_id, dominio_id, modo, batch_id,
                  sincronizado_em, ativado_por, ativado_em, atualizado_em
             FROM app.repository_transitions
            ORDER BY dominio_id`,
        );
        return resultado.rows.map(mapearTransicao);
      });
    },
    async alterarTransicaoRepositorio(contexto, dominioId, modo) {
      const dominios = new Set([
        "orcamentos",
        "composicoes-proprias",
        "bases-precos",
        "configuracoes",
      ]);
      if (!dominios.has(dominioId)) {
        throw new ApiError(422, "DOMINIO_INVALIDO", "O domínio informado não existe.");
      }
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "repositorio.transicionar");
        const atual = await cliente.query(
          `SELECT tenant_id, team_id, dominio_id, modo, batch_id,
                  sincronizado_em, ativado_por, ativado_em, atualizado_em
             FROM app.repository_transitions
            WHERE dominio_id = $1
            FOR UPDATE`,
          [dominioId],
        );
        if (!atual.rows[0]) {
          throw new ApiError(
            409,
            "DOMINIO_NAO_HOMOLOGADO",
            "Homologue o domínio antes de alterar sua fonte de dados.",
          );
        }
        const permitidas = {
          local: ["hibrido"],
          hibrido: ["local", "corporativo"],
          corporativo: ["hibrido"],
        };
        if (modo !== atual.rows[0].modo && !permitidas[atual.rows[0].modo]?.includes(modo)) {
          throw new ApiError(409, "TRANSICAO_INVALIDA", "A mudança de fonte solicitada não é segura.");
        }
        const resultado = await cliente.query(
          `UPDATE app.repository_transitions
              SET modo = $2, ativado_por = $3, atualizado_em = now()
            WHERE dominio_id = $1
          RETURNING tenant_id, team_id, dominio_id, modo, batch_id,
                    sincronizado_em, ativado_por, ativado_em, atualizado_em`,
          [dominioId, modo, validado.usuarioId],
        );
        return mapearTransicao(resultado.rows[0]);
      });
    },
    async fechar() {
      await pool.end();
    },
  };
}
