import { randomUUID } from "node:crypto";
import { ApiError } from "../errors.js";
import {
  MODULOS_PLATAFORMA,
  obterModulosPermitidos,
  obterPermissoesPerfil,
} from "../domain/platform.js";
import { validarPacoteNoServidor } from "../domain/migration.js";
import { validarSolicitacaoTrabalho } from "../domain/jobs.js";

function copiar(valor) {
  return structuredClone(valor);
}

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
    return {
      tenantId,
      tenantNome: tenant.nome,
      teamId,
      perfilId: membership.perfilId,
      usuarioId: identity.subject,
      permissoes,
      modulos: obterModulosPermitidos(permissoes, MODULOS_PLATAFORMA),
    };
  }

  function exigirPermissao(contexto, permissao) {
    if (!contexto.permissoes.includes(permissao)) {
      throw new ApiError(403, "PERMISSAO_NEGADA", "O perfil não permite executar esta operação.");
    }
  }

  function visivel(registro, contexto) {
    return registro.tenantId === contexto.tenantId
      && (!registro.teamId || registro.teamId === contexto.teamId);
  }

  return {
    tipo: "memory",
    async health() {
      return { ok: true, banco: "memória de desenvolvimento" };
    },
    async validarContexto(contexto) {
      return validarContexto(contexto);
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
      const agora = new Date().toISOString();
      const item = {
        id: randomUUID(),
        tenantId: contexto.tenantId,
        teamId: contexto.teamId,
        unidadeId: dados.unidadeId || "",
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
