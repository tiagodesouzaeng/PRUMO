import { useEffect, useMemo, useState } from "react";
import {
  calcularDistribuicaoDesconto,
  calcularTotais,
  calcularDataFimPorPrazo,
  criarPeriodosMedicao,
  criarId,
  criarOrcamento,
  distribuirSaldoInteiroNosVazios,
  distribuirSaldoNosVazios,
  normalizarPlanejamentoObra,
  normalizarOrcamento,
  numeroSeguro,
  REGRA_CALCULO_ATUAL,
  truncarMoeda,
  validarMedicaoAcumulada,
} from "../domain/orcamento";
import {
  descendentesEap,
  moverItemEap,
  reclassificarEap,
} from "../domain/eap";
import {
  carregarOrcamentoAtivo,
  carregarOrcamentos,
  restaurarOrcamentos,
  salvarOrcamentoAtivo,
  salvarOrcamentos,
} from "../services/orcamentoRepository";
import {
  carregarOrcamentosCorporativosSeAtivo,
  sincronizarOrcamentosCorporativos,
} from "../services/repositorioCorporativo";

function resumirBasesDosItens(itens) {
  const nomes = [...new Set(
    itens
      .filter((item) => item.tipo !== "grupo")
      .map((item) => item.fonte?.split("·")[0]?.trim())
      .filter(Boolean),
  )];
  return nomes.join(", ") || "Preços manuais";
}

function capturarEstadoRevisao(orcamento) {
  return structuredClone({
    itens: orcamento.itens,
    composicoes: orcamento.composicoes,
    bdi: orcamento.bdi,
    bdiComponentes: orcamento.bdiComponentes,
    bdiDiferenciadoComponentes: orcamento.bdiDiferenciadoComponentes,
    encargosSociais: orcamento.encargosSociais,
    descontoGlobal: orcamento.descontoGlobal,
    historicoCalculo: orcamento.historicoCalculo,
    inicioObra: orcamento.inicioObra,
    fimObra: orcamento.fimObra,
    prazoDias: orcamento.prazoDias,
    intervaloMedicaoDias: orcamento.intervaloMedicaoDias,
    cronogramaQuantidades: orcamento.cronogramaQuantidades,
    histogramaEquipes: orcamento.histogramaEquipes,
    suprimentosConfig: orcamento.suprimentosConfig,
    medicoes: orcamento.medicoes,
  });
}

function criarRegistroRevisao(orcamento, codigo, sobrescritas = {}) {
  const totais = calcularTotais(orcamento);
  return {
    id: sobrescritas.id || criarId("rev"),
    codigo,
    status: sobrescritas.status || orcamento.status,
    bases: resumirBasesDosItens(orcamento.itens),
    total: totais.precoTotal,
    variacao: sobrescritas.variacao || 0,
    autor: sobrescritas.autor || "Usuário atual",
    publicada: sobrescritas.publicada ?? false,
    ativa: sobrescritas.ativa ?? false,
    inativa: sobrescritas.inativa ?? false,
    data: new Date().toISOString(),
    snapshot: structuredClone(orcamento.itens),
    estado: capturarEstadoRevisao(orcamento),
    calculo: {
      descontoGlobal: structuredClone(orcamento.descontoGlobal),
      versaoRegra: REGRA_CALCULO_ATUAL,
      totais,
    },
    natureza: sobrescritas.natureza || "Revisão ordinária",
    motivo: sobrescritas.motivo || "",
    variacaoPrazoDias: numeroSeguro(sobrescritas.variacaoPrazoDias),
  };
}

export default function useOrcamentos() {
  const [orcamentos, setOrcamentos] = useState(carregarOrcamentos);
  const [orcamentoAtivoId, setOrcamentoAtivoId] = useState(
    () => carregarOrcamentoAtivo() || carregarOrcamentos()[0]?.id || "",
  );
  const [modoRepositorio, setModoRepositorio] = useState("local");
  const [repositorioVerificado, setRepositorioVerificado] = useState(false);

  const orcamentoAtivo = useMemo(
    () => orcamentos.find((item) => item.id === orcamentoAtivoId) || orcamentos[0],
    [orcamentos, orcamentoAtivoId],
  );

  useEffect(() => {
    salvarOrcamentos(orcamentos);
  }, [orcamentos]);

  useEffect(() => {
    let ativo = true;
    carregarOrcamentosCorporativosSeAtivo()
      .then((resultado) => {
        if (!ativo) return;
        setModoRepositorio(resultado.modo);
        if (resultado.modo === "corporativo" && resultado.orcamentos.length > 0) {
          const normalizados = resultado.orcamentos.map(normalizarOrcamento);
          setOrcamentos(normalizados);
          setOrcamentoAtivoId((atual) => (
            normalizados.some((item) => item.id === atual) ? atual : normalizados[0]?.id || ""
          ));
        }
      })
      .catch((erro) => {
        console.warn("O repositório corporativo não pôde ser consultado; o cache local foi mantido.", erro);
        if (ativo) setModoRepositorio("local");
      })
      .finally(() => {
        if (ativo) setRepositorioVerificado(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!repositorioVerificado || modoRepositorio === "local") return undefined;
    const temporizador = globalThis.setTimeout(() => {
      sincronizarOrcamentosCorporativos(orcamentos).catch((erro) => {
        console.warn("A sincronização corporativa será repetida após uma nova alteração.", erro);
      });
    }, 900);
    return () => globalThis.clearTimeout(temporizador);
  }, [modoRepositorio, orcamentos, repositorioVerificado]);

  useEffect(() => {
    salvarOrcamentoAtivo(orcamentoAtivoId);
  }, [orcamentoAtivoId]);

  function atualizarAtivo(transformar) {
    setOrcamentos((atuais) => atuais.map((orcamento) => (
      orcamento.id === orcamentoAtivo.id
        ? { ...transformar(orcamento), atualizadoEm: new Date().toISOString() }
        : orcamento
    )));
  }

  function salvarItem(dados, itemId = "") {
    atualizarAtivo((orcamento) => {
      const original = orcamento.itens.find((item) => item.id === itemId);
      const codigoNovo = dados.codigo.trim();
      const itemAtualizado = {
        tipo: dados.tipo,
        codigo: codigoNovo,
        descricao: dados.descricao.trim(),
        parentId: dados.parentId || "",
        nivelEap: dados.tipo === "grupo" ? (dados.nivelEap || "disciplina") : "",
        fonte: dados.tipo === "grupo" ? "" : dados.fonte.trim(),
        quantidade: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.quantidade),
        unidade: dados.tipo === "grupo" ? "" : dados.unidade.trim().toUpperCase(),
        unitario: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.unitario),
        basePrecoId: dados.tipo === "grupo" ? "" : (dados.basePrecoId || ""),
        referenciaCodigo: dados.tipo === "grupo" ? "" : (dados.referenciaCodigo || ""),
        referenciaTipo: dados.tipo === "grupo" ? "" : (dados.referenciaTipo || "composicao"),
        percentualMaoObra: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.percentualMaoObra),
        custoMaoObra: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.custoMaoObra),
        custoMaterial: dados.tipo === "grupo"
          ? 0
          : numeroSeguro(dados.custoMaterial ?? dados.unitario),
        bdiTipo: dados.tipo === "grupo" ? "padrao" : (dados.bdiTipo || "padrao"),
        bdiDiferenciado: dados.tipo === "grupo" || dados.bdiTipo !== "diferenciado"
          ? null
          : {
            ...(dados.bdiDiferenciado || {}),
            justificativa: String(dados.bdiDiferenciado?.justificativa || "").trim(),
            responsavel: String(dados.bdiDiferenciado?.responsavel || "Usuário atual").trim(),
            atualizadoEm: new Date().toISOString(),
            referenciaNormativa: "Súmula TCU 253/2010 e Acórdão TCU 2.622/2013-Plenário",
          },
      };
      let itensAtualizados;

      if (itemId) {
        itensAtualizados = orcamento.itens.map((item) => (
          item.id === itemId ? { ...item, ...itemAtualizado } : item
        ));
      } else {
        const novoItem = {
          id: dados.id || criarId(dados.tipo === "grupo" ? "grp" : "item"),
          ...itemAtualizado,
        };
        itensAtualizados = [...orcamento.itens];

        itensAtualizados.push(novoItem);
      }

      return {
        ...orcamento,
        itens: reclassificarEap(itensAtualizados),
      };
    });
  }

  function removerItem(itemId) {
    atualizarAtivo((orcamento) => {
      const removido = orcamento.itens.find((candidato) => candidato.id === itemId);
      const descendentes = removido?.tipo === "grupo"
        ? descendentesEap(orcamento.itens, itemId)
        : new Set();
      return {
        ...orcamento,
        itens: orcamento.itens.filter((item) => (
          item.id !== itemId
          && !descendentes.has(item.id)
        )),
      };
    });
  }

  function duplicarItem(itemId) {
    atualizarAtivo((orcamento) => {
      const indice = orcamento.itens.findIndex((item) => item.id === itemId);
      if (indice < 0) return orcamento;
      const original = orcamento.itens[indice];
      const copia = {
        ...original,
        id: criarId(original.tipo === "grupo" ? "grp" : "item"),
        codigo: `${original.codigo}-CÓPIA`,
        descricao: `${original.descricao} (cópia)`,
      };
      const itens = [...orcamento.itens, copia];
      return { ...orcamento, itens: reclassificarEap(itens) };
    });
  }

  function moverItem(itemId, direcao) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: moverItemEap(orcamento.itens, itemId, direcao),
    }));
  }

  function importarItens(itensImportados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: reclassificarEap([
        ...orcamento.itens,
        ...itensImportados.map((item) => ({
          ...item,
          id: criarId(item.tipo === "grupo" ? "grp" : "item"),
        })),
      ]),
    }));
  }

  function atualizarBdi(bdiComponentes) {
    atualizarAtivo((orcamento) => ({ ...orcamento, bdiComponentes }));
  }

  function atualizarBdiDiferenciado(bdiDiferenciadoComponentes) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      bdiDiferenciadoComponentes,
      historicoCalculo: [{
        id: criarId("calc"),
        acao: "bdi_diferenciado_atualizado",
        usuario: "Usuário atual",
        data: new Date().toISOString(),
        versaoRegra: REGRA_CALCULO_ATUAL,
      }, ...(orcamento.historicoCalculo || [])],
    }));
  }

  function atualizarEncargosSociais(encargosSociais) {
    atualizarAtivo((orcamento) => ({ ...orcamento, encargosSociais }));
  }

  function atualizarDescontoGlobal(dados) {
    atualizarAtivo((orcamento) => {
      const agora = new Date().toISOString();
      const usuario = "Usuário atual";
      const removendo = !dados || numeroSeguro(dados.valor) <= 0;
      const configuracao = removendo ? null : {
        tipo: dados.tipo === "valor" ? "valor" : "percentual",
        valor: numeroSeguro(dados.valor),
        atualizadoEm: agora,
        usuario,
        versaoRegra: REGRA_CALCULO_ATUAL,
      };
      const distribuicao = calcularDistribuicaoDesconto({
        ...orcamento,
        descontoGlobal: configuracao,
      });
      const registro = {
        id: criarId("calc"),
        acao: removendo ? "desconto_removido" : "desconto_aplicado",
        tipo: configuracao?.tipo || orcamento.descontoGlobal?.tipo || "",
        valorInformado: configuracao?.valor || 0,
        percentualCalculado: distribuicao.percentual,
        valorDesconto: distribuicao.valorDesconto,
        usuario,
        data: agora,
        versaoRegra: REGRA_CALCULO_ATUAL,
      };

      return {
        ...orcamento,
        descontoGlobal: configuracao,
        historicoCalculo: [registro, ...(orcamento.historicoCalculo || [])],
      };
    });
  }

  function atualizarPlanejamento(dados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      ...normalizarPlanejamentoObra({
        ...orcamento,
        ...dados,
      }),
    }));
  }

  function atualizarCronogramaQuantidade(itemId, periodoInicio, quantidade) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      cronogramaQuantidades: {
        ...(orcamento.cronogramaQuantidades || {}),
        [itemId]: {
          ...(orcamento.cronogramaQuantidades?.[itemId] || {}),
          [periodoInicio]: quantidade === "" ? "" : Math.max(0, numeroSeguro(quantidade)),
        },
      },
    }));
  }

  function atualizarCronogramaGrupo(grupoId, periodoInicio, percentual) {
    atualizarAtivo((orcamento) => {
      const grupo = orcamento.itens.find((item) => item.id === grupoId && item.tipo === "grupo");
      if (!grupo) return orcamento;
      const vazio = percentual === "";
      const proporcao = Math.max(0, numeroSeguro(percentual)) / 100;
      const cronogramaQuantidades = structuredClone(orcamento.cronogramaQuantidades || {});
      orcamento.itens
        .filter((item) => item.tipo !== "grupo" && item.codigo.startsWith(`${grupo.codigo}.`))
        .forEach((item) => {
          cronogramaQuantidades[item.id] = {
            ...(cronogramaQuantidades[item.id] || {}),
            [periodoInicio]: vazio ? "" : numeroSeguro(item.quantidade) * proporcao,
          };
        });
      return { ...orcamento, cronogramaQuantidades };
    });
  }

  function atualizarHistogramaEquipe(funcao, periodoInicio, quantidade) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      histogramaEquipes: {
        ...(orcamento.histogramaEquipes || {}),
        [funcao]: {
          ...(orcamento.histogramaEquipes?.[funcao] || {}),
          [periodoInicio]: quantidade === ""
            ? ""
            : Math.max(0, Math.trunc(numeroSeguro(quantidade))),
        },
      },
    }));
  }

  function servicosAlvoCronograma(orcamento, itemId = "") {
    const itemAlvo = (orcamento.itens || []).find((item) => item.id === itemId);
    return (orcamento.itens || []).filter((item) => (
      item.tipo !== "grupo"
      && (
        !itemAlvo
        || item.id === itemAlvo.id
        || (itemAlvo.tipo === "grupo" && item.codigo.startsWith(`${itemAlvo.codigo}.`))
      )
    ));
  }

  function limparCronograma(itemId = "") {
    atualizarAtivo((orcamento) => {
      const periodos = criarPeriodosMedicao(orcamento);
      const cronogramaQuantidades = { ...(orcamento.cronogramaQuantidades || {}) };
      servicosAlvoCronograma(orcamento, itemId).forEach((item) => {
        cronogramaQuantidades[item.id] = Object.fromEntries(
          periodos.map((periodo) => [periodo.inicio, ""]),
        );
      });
      return {
        ...orcamento,
        cronogramaQuantidades,
      };
    });
  }

  function distribuirSaldosCronograma(itemId = "") {
    atualizarAtivo((orcamento) => {
      const periodos = criarPeriodosMedicao(orcamento);
      const atuais = orcamento.cronogramaQuantidades || {};
      const cronogramaQuantidades = { ...atuais };
      servicosAlvoCronograma(orcamento, itemId).forEach((item) => {
        cronogramaQuantidades[item.id] = distribuirSaldoNosVazios(
          item.quantidade,
          periodos,
          atuais[item.id] || {},
        );
      });
      return {
        ...orcamento,
        cronogramaQuantidades,
      };
    });
  }

  function limparHistograma(funcoes = [], periodos = [], funcaoAlvo = "") {
    atualizarAtivo((orcamento) => {
      const histogramaEquipes = { ...(orcamento.histogramaEquipes || {}) };
      funcoes
        .filter((item) => !funcaoAlvo || item.funcao === funcaoAlvo)
        .forEach((item) => {
          histogramaEquipes[item.funcao] = Object.fromEntries(
            periodos.map((periodo) => [periodo.inicio, ""]),
          );
        });
      return { ...orcamento, histogramaEquipes };
    });
  }

  function distribuirSaldosHistograma(funcoes = [], periodos = [], funcaoAlvo = "") {
    atualizarAtivo((orcamento) => {
      const atuais = orcamento.histogramaEquipes || {};
      const histogramaEquipes = { ...atuais };
      funcoes
        .filter((item) => !funcaoAlvo || item.funcao === funcaoAlvo)
        .forEach((item) => {
          const totalSugerido = periodos.reduce(
            (total, periodo) => total + numeroSeguro(item.sugerido?.[periodo.inicio]),
            0,
          );
          histogramaEquipes[item.funcao] = distribuirSaldoInteiroNosVazios(
            totalSugerido,
            periodos,
            atuais[item.funcao] || {},
          );
        });
      return {
        ...orcamento,
        histogramaEquipes,
      };
    });
  }

  function atualizarConfiguracaoSuprimentos(dados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      suprimentosConfig: {
        ...(orcamento.suprimentosConfig || {}),
        antecedenciaPadraoDias: Math.max(
          0,
          Math.round(numeroSeguro(
            dados.antecedenciaPadraoDias
              ?? orcamento.suprimentosConfig?.antecedenciaPadraoDias
              ?? 15,
          )),
        ),
        antecedenciasPorItem: {
          ...(orcamento.suprimentosConfig?.antecedenciasPorItem || {}),
          ...(dados.antecedenciasPorItem || {}),
        },
        estoquesPorItem: {
          ...(orcamento.suprimentosConfig?.estoquesPorItem || {}),
          ...(dados.estoquesPorItem || {}),
        },
        pedidos: dados.pedidos ?? orcamento.suprimentosConfig?.pedidos ?? [],
        regrasPorItem: {
          ...(orcamento.suprimentosConfig?.regrasPorItem || {}),
          ...(dados.regrasPorItem || {}),
        },
      },
    }));
  }

  function salvarMedicao(dados) {
    const validacao = validarMedicaoAcumulada(orcamentoAtivo, dados);
    if (!validacao.valida) {
      return { ok: false, erros: validacao.erros };
    }
    atualizarAtivo((orcamento) => {
      const existente = (orcamento.medicoes || []).find((medicao) => medicao.id === dados.id);
      const medicao = {
        ...existente,
        ...dados,
        valorPrevisto: numeroSeguro(dados.valorPrevisto),
        valorMedido: numeroSeguro(dados.valorMedido),
        retencoes: dados.retencoes || [],
        multas: dados.multas || [],
        documentos: dados.documentos || [],
        proposta: false,
        atualizadoEm: new Date().toISOString(),
      };
      return {
        ...orcamento,
        medicoes: existente
          ? orcamento.medicoes.map((item) => item.id === medicao.id ? medicao : item)
          : [medicao, ...(orcamento.medicoes || [])],
      };
    });
    return { ok: true, erros: [] };
  }

  function atualizarPrecosBase(referencias, base) {
    const precos = new Map(
      referencias.filter((item) => (
        ["composicao", "insumo"].includes(item.tipo) && !item.semPreco && item.preco > 0
      )).map((item) => [`${item.tipo}:${item.codigo}`, item]),
    );
    const atualizaveis = orcamentoAtivo.itens.filter((item) => {
      const codigo = item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim();
      const tipo = item.referenciaTipo || "composicao";
      const pertenceBase = item.basePrecoId
        ? item.basePrecoId === base.id
        : item.fonte?.toUpperCase().startsWith(base.fonte);
      return item.tipo !== "grupo" && pertenceBase && precos.has(`${tipo}:${codigo}`);
    });

    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: orcamento.itens.map((item) => {
        const codigo = item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim();
        const tipo = item.referenciaTipo || "composicao";
        const pertenceBase = item.basePrecoId
          ? item.basePrecoId === base.id
          : item.fonte?.toUpperCase().startsWith(base.fonte);
        const referencia = pertenceBase ? precos.get(`${tipo}:${codigo}`) : null;
        return referencia ? {
          ...item,
          fonte: `${base.titulo} · ${referencia.codigo}`,
          basePrecoId: base.id,
          referenciaCodigo: referencia.codigo,
          referenciaTipo: referencia.tipo,
          unidade: referencia.unidade || item.unidade,
          unitario: referencia.preco,
          percentualMaoObra: referencia.percentualMaoObra || 0,
          custoMaoObra: referencia.custoMaoObra || 0,
          custoMaterial: referencia.custoMaterial ?? referencia.preco,
        } : item;
      }),
      composicoes: orcamento.composicoes.map((composicao) => {
        const componentes = (composicao.componentes || []).map((componente) => {
          if (componente.basePrecoId !== base.id) return componente;
          const referencia = precos.get(`${componente.referenciaTipo}:${componente.referenciaCodigo}`);
          return referencia ? { ...componente, preco: referencia.preco } : componente;
        });
        const possuiComponentes = componentes.length > 0;
        return {
          ...composicao,
          componentes,
          custoUnitario: possuiComponentes
            ? truncarMoeda(componentes.reduce(
              (total, componente) => (
                total + numeroSeguro(componente.coeficiente) * numeroSeguro(componente.preco)
              ),
              0,
            ))
            : composicao.custoUnitario,
        };
      }),
    }));
    return atualizaveis.length;
  }

  function adicionarComposicao(dados) {
    const componentes = (dados.componentes || []).map((componente) => ({
      ...componente,
      id: componente.id || criarId("comp-item"),
      coeficiente: numeroSeguro(componente.coeficiente),
      preco: numeroSeguro(componente.preco),
    }));
    const custoCalculado = componentes.length
      ? truncarMoeda(componentes.reduce(
        (total, componente) => (
          total + numeroSeguro(componente.coeficiente) * numeroSeguro(componente.preco)
        ),
        0,
      ))
      : numeroSeguro(dados.custoUnitario);
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      composicoes: [
        ...orcamento.composicoes,
        {
          id: criarId("comp"),
          codigo: dados.codigo.trim().toUpperCase(),
          descricao: dados.descricao.trim(),
          unidade: dados.unidade.trim().toUpperCase(),
          custoUnitario: custoCalculado,
          componentes,
        },
      ],
    }));
  }

  function removerComposicao(composicaoId) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      composicoes: orcamento.composicoes.filter((item) => item.id !== composicaoId),
    }));
  }

  function adicionarOrcamento(dados) {
    const novo = criarOrcamento(dados);
    setOrcamentos((atuais) => [...atuais, novo]);
    setOrcamentoAtivoId(novo.id);
  }

  function criarRevisao(dados = {}) {
    atualizarAtivo((orcamento) => {
      const numeroAtual = Number(orcamento.revisao.replace(/\D/g, "")) || 0;
      const codigo = `R${String(numeroAtual + 1).padStart(2, "0")}`;
      const registroAtualExistente = orcamento.revisoes.find(
        (revisao) => revisao.codigo === orcamento.revisao,
      );
      const registroAtual = criarRegistroRevisao(orcamento, orcamento.revisao, {
        ...registroAtualExistente,
        id: registroAtualExistente?.id,
        ativa: false,
      });
      const variacaoPrazoDias = Math.round(numeroSeguro(dados.variacaoPrazoDias));
      const prazoNovo = Math.max(1, numeroSeguro(orcamento.prazoDias) + variacaoPrazoDias);
      const orcamentoNovaVersao = {
        ...orcamento,
        ...normalizarPlanejamentoObra({
          ...orcamento,
          prazoDias: prazoNovo,
          fimObra: calcularDataFimPorPrazo(orcamento.inicioObra, prazoNovo),
        }),
      };
      const novaRevisao = criarRegistroRevisao(orcamentoNovaVersao, codigo, {
        status: dados.natureza && dados.natureza !== "Revisão ordinária"
          ? `${dados.natureza} em elaboração`
          : "Em elaboração",
        ativa: true,
        natureza: dados.natureza,
        motivo: dados.motivo,
        variacaoPrazoDias,
      });
      const historicoSemAtual = orcamento.revisoes.filter(
        (revisao) => revisao.codigo !== orcamento.revisao,
      ).map((revisao) => ({ ...revisao, ativa: false }));

      return {
        ...orcamentoNovaVersao,
        revisao: codigo,
        status: novaRevisao.status,
        revisaoContratual: {
          natureza: novaRevisao.natureza,
          motivo: novaRevisao.motivo,
          variacaoPrazoDias: novaRevisao.variacaoPrazoDias,
          origemAprovada: String(orcamento.status || "").toLocaleLowerCase("pt-BR").includes("aprov"),
        },
        revisoes: [novaRevisao, registroAtual, ...historicoSemAtual],
      };
    });
  }

  function ativarRevisao(revisaoId) {
    atualizarAtivo((orcamento) => {
      const alvo = orcamento.revisoes.find((revisao) => revisao.id === revisaoId);
      if (!alvo || alvo.inativa) return orcamento;
      const estado = alvo.estado || { itens: alvo.snapshot || [] };
      const revisoes = orcamento.revisoes.map((revisao) => {
        if (revisao.codigo === orcamento.revisao) {
          return criarRegistroRevisao(orcamento, orcamento.revisao, {
            ...revisao,
            id: revisao.id,
            ativa: false,
          });
        }
        return { ...revisao, ativa: revisao.id === revisaoId };
      });
      return {
        ...orcamento,
        revisao: alvo.codigo,
        status: alvo.status,
        itens: structuredClone(estado.itens || alvo.snapshot || []),
        composicoes: structuredClone(estado.composicoes || orcamento.composicoes),
        bdi: estado.bdi ?? orcamento.bdi,
        bdiComponentes: structuredClone(estado.bdiComponentes || orcamento.bdiComponentes),
        bdiDiferenciadoComponentes: structuredClone(
          estado.bdiDiferenciadoComponentes || orcamento.bdiDiferenciadoComponentes,
        ),
        encargosSociais: structuredClone(estado.encargosSociais || orcamento.encargosSociais),
        descontoGlobal: structuredClone(estado.descontoGlobal ?? alvo.calculo?.descontoGlobal ?? null),
        historicoCalculo: structuredClone(estado.historicoCalculo || orcamento.historicoCalculo),
        inicioObra: estado.inicioObra || orcamento.inicioObra,
        fimObra: estado.fimObra || orcamento.fimObra,
        prazoDias: estado.prazoDias || orcamento.prazoDias,
        intervaloMedicaoDias: estado.intervaloMedicaoDias || orcamento.intervaloMedicaoDias,
        cronogramaQuantidades: structuredClone(estado.cronogramaQuantidades || {}),
        histogramaEquipes: structuredClone(estado.histogramaEquipes || {}),
        suprimentosConfig: structuredClone(
          estado.suprimentosConfig || orcamento.suprimentosConfig,
        ),
        medicoes: structuredClone(estado.medicoes || []),
        revisaoContratual: alvo.natureza ? {
          natureza: alvo.natureza,
          motivo: alvo.motivo,
          variacaoPrazoDias: alvo.variacaoPrazoDias,
          origemAprovada: alvo.natureza !== "Revisão ordinária",
        } : null,
        revisoes,
      };
    });
  }

  function alternarRevisaoInativa(revisaoId) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      revisoes: orcamento.revisoes.map((revisao) => (
        revisao.id === revisaoId && revisao.codigo !== orcamento.revisao
          ? { ...revisao, inativa: !revisao.inativa, ativa: false }
          : revisao
      )),
    }));
  }

  function excluirRevisao(revisaoId) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      revisoes: orcamento.revisoes.filter((revisao) => (
        revisao.id !== revisaoId || revisao.codigo === orcamento.revisao
      )),
    }));
  }

  function atualizarStatusOrcamento(status) {
    atualizarAtivo((orcamento) => {
      const aprovado = status === "Aprovado";
      const existente = (orcamento.revisoes || []).find(
        (revisao) => revisao.codigo === orcamento.revisao,
      );
      const orcamentoAtualizado = { ...orcamento, status };
      const registroAtual = criarRegistroRevisao(
        orcamentoAtualizado,
        orcamento.revisao,
        {
          ...existente,
          id: existente?.id,
          status,
          ativa: true,
          publicada: aprovado || existente?.publicada,
        },
      );
      return {
        ...orcamentoAtualizado,
        aprovadoEm: aprovado ? new Date().toISOString() : orcamento.aprovadoEm,
        revisoes: existente
          ? orcamento.revisoes.map((revisao) => (
            revisao.codigo === orcamento.revisao ? registroAtual : revisao
          ))
          : [registroAtual, ...(orcamento.revisoes || [])],
      };
    });
  }

  function restaurarDados() {
    const iniciais = restaurarOrcamentos();
    setOrcamentos(iniciais);
    setOrcamentoAtivoId(iniciais[0]?.id || "");
  }

  return {
    orcamentos,
    modoRepositorio,
    orcamentoAtivo,
    orcamentoAtivoId,
    setOrcamentoAtivoId,
    salvarItem,
    removerItem,
    duplicarItem,
    moverItem,
    importarItens,
    atualizarBdi,
    atualizarBdiDiferenciado,
    atualizarEncargosSociais,
    atualizarDescontoGlobal,
    atualizarPlanejamento,
    atualizarCronogramaQuantidade,
    atualizarCronogramaGrupo,
    atualizarHistogramaEquipe,
    limparCronograma,
    distribuirSaldosCronograma,
    limparHistograma,
    distribuirSaldosHistograma,
    atualizarConfiguracaoSuprimentos,
    salvarMedicao,
    atualizarPrecosBase,
    adicionarComposicao,
    removerComposicao,
    adicionarOrcamento,
    criarRevisao,
    ativarRevisao,
    alternarRevisaoInativa,
    excluirRevisao,
    atualizarStatusOrcamento,
    restaurarDados,
  };
}
