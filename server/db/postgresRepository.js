import pg from "pg";
import { randomUUID } from "node:crypto";
import { ApiError } from "../errors.js";
import { PERMISSOES_PLATAFORMA } from "../domain/platform.js";
import { validarPacoteNoServidor } from "../domain/migration.js";
import { validarSolicitacaoTrabalho } from "../domain/jobs.js";

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
          WHERE m.status = 'ativo'
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

  async function registrarEvento(cliente, contexto, {
    moduleId,
    eventType,
    aggregateType,
    aggregateId,
    payload = {},
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
        });
        return resposta;
      });
    },
    async atualizarOrcamento(contexto, id, dados, versaoEsperada) {
      return comContexto(contexto, async (cliente, validado) => {
        exigirPermissao(validado, "orcamento.editar");
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
          `SELECT tenant_id, id, team_id, unidade_id, codigo, nome, tipo, status,
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
        const resultado = await cliente.query(
          `INSERT INTO app.empreendimentos
            (tenant_id, id, team_id, unidade_id, codigo, nome, tipo, status, dados, criado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING tenant_id, id, team_id, unidade_id, codigo, nome, tipo, status,
                     dados, versao, criado_por, criado_em, atualizado_em`,
          [
            validado.tenantId,
            randomUUID(),
            validado.teamId || null,
            dados.unidadeId || null,
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
