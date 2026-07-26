/* =====================================================
   RELEASE........: v5.7.0 RC1
   ARQUIVO........: src/hooks/useQualidadeDados.js
   DESCRIÇÃO......: Consolida indicadores, rankings, checklist e registros
                    de pendências de qualidade cadastral da base PPCI
===================================================== */

import { useMemo } from "react";
import { PPCI_CAMPOS } from "../domain/ppciCampos";

const CAMPOS_CRITICOS = Object.freeze([
  {
    id: "semStatus",
    label: "Sem status",
    campo: PPCI_CAMPOS.STATUS,
    nivel: "critico",
    descricao: "PPCIs sem Status / Situação informado.",
    acao: "Definir a situação atual do PPCI na base.",
  },
  {
    id: "semResponsavel",
    label: "Sem responsável",
    campo: PPCI_CAMPOS.RESPONSAVEL,
    nivel: "critico",
    descricao: "PPCIs sem responsável definido.",
    acao: "Atribuir um responsável operacional pelo acompanhamento.",
  },
  {
    id: "semVencimento",
    label: "Sem vencimento",
    campo: PPCI_CAMPOS.DATA_VENCIMENTO,
    nivel: "critico",
    descricao: "PPCIs sem data limite / vencimento.",
    acao: "Informar a data limite ou vencimento do processo.",
  },
  {
    id: "semPredio",
    label: "Sem prédio",
    campo: PPCI_CAMPOS.PREDIO,
    nivel: "critico",
    descricao: "PPCIs sem Prédio / Edificação informado.",
    acao: "Vincular o PPCI à edificação correspondente.",
  },
]);

const CAMPOS_OPERACIONAIS = Object.freeze([
  {
    id: "semProcesso",
    label: "Sem processo",
    campo: PPCI_CAMPOS.PROCESSO,
    nivel: "atencao",
    descricao: "PPCIs sem número do processo CBMRS.",
    acao: "Informar o número do processo ou protocolo CBMRS.",
  },
  {
    id: "semPrioridade",
    label: "Sem prioridade",
    campo: PPCI_CAMPOS.PRIORIDADE,
    nivel: "atencao",
    descricao: "PPCIs sem prioridade informada.",
    acao: "Classificar a prioridade de acompanhamento.",
  },
  {
    id: "semCategoria",
    label: "Sem categoria",
    campo: PPCI_CAMPOS.CATEGORIA,
    nivel: "atencao",
    descricao: "PPCIs sem categoria classificada.",
    acao: "Classificar a categoria do registro.",
  },
  {
    id: "semLinkProcesso",
    label: "Sem link",
    campo: PPCI_CAMPOS.LINK_PROCESSO,
    nivel: "atencao",
    descricao: "PPCIs sem link do processo.",
    acao: "Adicionar link de consulta ao processo ou documento de apoio.",
  },
  {
    id: "semProximoPasso",
    label: "Sem próximo passo",
    campo: PPCI_CAMPOS.PROXIMO_PASSO,
    nivel: "atencao",
    descricao: "PPCIs sem providência / próximo passo registrado.",
    acao: "Registrar a próxima ação necessária para avanço do processo.",
  },
]);

const CAMPOS_AVALIADOS = Object.freeze([
  ...CAMPOS_CRITICOS,
  ...CAMPOS_OPERACIONAIS,
]);

function valorVazio(valor) {
  if (valor === null || valor === undefined) return true;

  const texto = String(valor).trim();

  if (!texto) return true;

  return [
    "-",
    "--",
    "na",
    "n/a",
    "não informado",
    "nao informado",
    "sem informação",
    "sem informacao",
  ].includes(texto.toLowerCase());
}

function valorAgrupamento(valor, padrao) {
  return valorVazio(valor) ? padrao : String(valor).trim();
}

function resumirRegistro(item) {
  return {
    id: item?.[PPCI_CAMPOS.ID] || "Sem ID",
    unidade: item?.[PPCI_CAMPOS.UNIDADE] || "Sem unidade",
    predio: item?.[PPCI_CAMPOS.PREDIO] || "Sem prédio",
    status: item?.[PPCI_CAMPOS.STATUS] || "Sem status",
    responsavel: item?.[PPCI_CAMPOS.RESPONSAVEL] || "Sem responsável",
    vencimento: item?.[PPCI_CAMPOS.DATA_VENCIMENTO] || "Sem vencimento",
    item,
  };
}

function resumirItens(itens, limite = 8) {
  return itens.slice(0, limite).map(resumirRegistro);
}

function obterPendenciasDoRegistro(item) {
  return CAMPOS_AVALIADOS.filter((definicao) =>
    valorVazio(item?.[definicao.campo])
  );
}

function calcularSaude(totalRegistros, totalPendencias) {
  const totalCamposEsperados = totalRegistros * CAMPOS_AVALIADOS.length;

  if (!totalCamposEsperados) return 0;

  return Math.max(
    0,
    Math.round(
      ((totalCamposEsperados - totalPendencias) / totalCamposEsperados) * 100
    )
  );
}

function gerarRanking(ppcis, campoAgrupamento, padrao, limite = 12) {
  const mapa = new Map();

  ppcis.forEach((item, index) => {
    const nome = valorAgrupamento(item?.[campoAgrupamento], padrao);
    const chave = nome.toLowerCase();
    const pendencias = obterPendenciasDoRegistro(item);
    const id = item?.[PPCI_CAMPOS.ID] || `linha-${index}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        nome,
        total: 0,
        totalPendencias: 0,
        pendenciasCriticas: 0,
        pendenciasAtencao: 0,
        registrosComPendencia: new Set(),
      });
    }

    const grupo = mapa.get(chave);
    grupo.total += 1;
    grupo.totalPendencias += pendencias.length;

    if (pendencias.length) {
      grupo.registrosComPendencia.add(id);
    }

    pendencias.forEach((pendencia) => {
      if (pendencia.nivel === "critico") {
        grupo.pendenciasCriticas += 1;
      } else {
        grupo.pendenciasAtencao += 1;
      }
    });
  });

  return [...mapa.values()]
    .map((grupo) => ({
      nome: grupo.nome,
      total: grupo.total,
      registrosComPendencia: grupo.registrosComPendencia.size,
      totalPendencias: grupo.totalPendencias,
      pendenciasCriticas: grupo.pendenciasCriticas,
      pendenciasAtencao: grupo.pendenciasAtencao,
      percentualSaude: calcularSaude(grupo.total, grupo.totalPendencias),
    }))
    .sort((a, b) => {
      if (b.pendenciasCriticas !== a.pendenciasCriticas) {
        return b.pendenciasCriticas - a.pendenciasCriticas;
      }

      if (b.totalPendencias !== a.totalPendencias) {
        return b.totalPendencias - a.totalPendencias;
      }

      return a.percentualSaude - b.percentualSaude;
    })
    .slice(0, limite);
}

function gerarChecklist(itens = []) {
  return itens
    .filter((item) => item.quantidade > 0)
    .map((item) => ({
      id: item.id,
      label: item.label,
      campo: item.campo,
      nivel: item.nivel,
      prioridade: item.nivel === "critico" ? "Alta" : "Média",
      quantidade: item.quantidade,
      percentual: item.percentual,
      descricao: item.descricao,
      acao: item.acao,
      registros: item.registros,
    }))
    .sort((a, b) => {
      const pesoA = a.nivel === "critico" ? 1 : 2;
      const pesoB = b.nivel === "critico" ? 1 : 2;

      if (pesoA !== pesoB) return pesoA - pesoB;
      return b.quantidade - a.quantidade;
    });
}

function gerarResumoPrioridade(checklist = []) {
  const alta = checklist.filter((item) => item.prioridade === "Alta").length;
  const media = checklist.filter((item) => item.prioridade === "Média").length;

  return {
    alta,
    media,
    total: checklist.length,
  };
}

export default function useQualidadeDados(ppcis = []) {
  return useMemo(() => {
    const total = Array.isArray(ppcis) ? ppcis.length : 0;

    if (!total) {
      return {
        total: 0,
        percentualPreenchimento: 0,
        camposAvaliados: CAMPOS_AVALIADOS.length,
        totalPendencias: 0,
        pendenciasCriticas: 0,
        pendenciasAtencao: 0,
        registrosComPendencia: 0,
        registrosCompletos: 0,
        itens: [],
        registrosPendentes: [],
        rankingUnidades: [],
        rankingResponsaveis: [],
        checklistSaneamento: [],
        resumoChecklist: { alta: 0, media: 0, total: 0 },
      };
    }

    const itens = CAMPOS_AVALIADOS.map((definicao) => {
      const registrosOriginais = ppcis.filter((item) =>
        valorVazio(item?.[definicao.campo])
      );

      const registros = registrosOriginais.map((item) => ({
        ...resumirRegistro(item),
        pendenciaId: definicao.id,
        pendencia: definicao.label,
        nivel: definicao.nivel,
        descricao: definicao.descricao,
        acao: definicao.acao,
        campo: definicao.campo,
      }));

      return {
        ...definicao,
        quantidade: registros.length,
        percentual: Math.round((registros.length / total) * 100),
        exemplos: resumirItens(registrosOriginais),
        registros,
      };
    });

    const idsComPendencia = new Set();

    ppcis.forEach((item, index) => {
      const possuiPendencia = obterPendenciasDoRegistro(item).length > 0;

      if (possuiPendencia) {
        idsComPendencia.add(item?.[PPCI_CAMPOS.ID] || `linha-${index}`);
      }
    });

    const totalCamposEsperados = total * CAMPOS_AVALIADOS.length;
    const totalPendencias = itens.reduce(
      (soma, item) => soma + item.quantidade,
      0
    );

    const pendenciasCriticas = itens
      .filter((item) => item.nivel === "critico")
      .reduce((soma, item) => soma + item.quantidade, 0);

    const pendenciasAtencao = itens
      .filter((item) => item.nivel === "atencao")
      .reduce((soma, item) => soma + item.quantidade, 0);

    const percentualPreenchimento = totalCamposEsperados
      ? Math.round(
          ((totalCamposEsperados - totalPendencias) / totalCamposEsperados) * 100
        )
      : 0;

    const registrosPendentes = itens.flatMap((item) => item.registros);
    const checklistSaneamento = gerarChecklist(itens);

    return {
      total,
      percentualPreenchimento,
      camposAvaliados: CAMPOS_AVALIADOS.length,
      totalPendencias,
      pendenciasCriticas,
      pendenciasAtencao,
      registrosComPendencia: idsComPendencia.size,
      registrosCompletos: total - idsComPendencia.size,
      itens,
      registrosPendentes,
      rankingUnidades: gerarRanking(
        ppcis,
        PPCI_CAMPOS.UNIDADE,
        "Sem unidade"
      ),
      rankingResponsaveis: gerarRanking(
        ppcis,
        PPCI_CAMPOS.RESPONSAVEL,
        "Sem responsável"
      ),
      checklistSaneamento,
      resumoChecklist: gerarResumoPrioridade(checklistSaneamento),
    };
  }, [ppcis]);
}
