/* =====================================================
   RELEASE........: v6.5.0 RC1
   ARQUIVO........: src/domain/ppciAlertas.js
   DESCRIÇÃO......: Motor de classificação de alertas operacionais PPCI,
                    score de risco e priorização automática
===================================================== */

import { PPCI_CAMPOS } from "./ppciCampos";
import { obterDiasParaVencer } from "../utils/ppciUtils";

export const PPCI_ALERTAS = Object.freeze({
  VENCIDO: Object.freeze({
    id: "vencido",
    label: "Vencido",
    nivel: "critico",
    descricao: "PPCI com data limite vencida.",
  }),
  CRITICO: Object.freeze({
    id: "critico",
    label: "Crítico",
    nivel: "critico",
    descricao: "PPCI com vencimento em até 60 dias.",
  }),
  ATENCAO: Object.freeze({
    id: "atencao",
    label: "Atenção",
    nivel: "atencao",
    descricao: "PPCI com vencimento entre 61 e 180 dias.",
  }),
  REGULAR: Object.freeze({
    id: "regular",
    label: "Regular",
    nivel: "regular",
    descricao: "PPCI com prazo superior a 180 dias.",
  }),
  SEM_DATA: Object.freeze({
    id: "sem_data",
    label: "Sem data limite",
    nivel: "atencao",
    descricao: "PPCI sem data limite cadastrada.",
  }),
  SEM_RESPONSAVEL: Object.freeze({
    id: "sem_responsavel",
    label: "Sem responsável",
    nivel: "critico",
    descricao: "PPCI sem responsável cadastrado.",
  }),
});

export const PPCI_ALERTAS_LISTA = Object.freeze(Object.values(PPCI_ALERTAS));

export const PPCI_ALERTAS_MAPA = Object.freeze(
  PPCI_ALERTAS_LISTA.reduce((mapa, alerta) => {
    mapa[alerta.id] = alerta;
    return mapa;
  }, {})
);

export const PPCI_PRIORIDADE_OPERACIONAL = Object.freeze({
  ALTA: Object.freeze({
    id: "alta",
    label: "Alta prioridade",
    classe: "risco-alto",
  }),
  MEDIA: Object.freeze({
    id: "media",
    label: "Média prioridade",
    classe: "risco-medio",
  }),
  BAIXA: Object.freeze({
    id: "baixa",
    label: "Baixa prioridade",
    classe: "risco-baixo",
  }),
});

export function valorVazioOperacional(valor) {
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

function normalizarConclusao(valor) {
  const numero = Number(valor);

  if (Number.isNaN(numero)) return 0;

  if (numero <= 1) return Math.max(0, Math.min(100, numero * 100));

  return Math.max(0, Math.min(100, numero));
}

function obterPrioridadeManual(valor) {
  const prioridade = Number(valor);

  if (Number.isNaN(prioridade)) return 0;

  return prioridade;
}

function classificarPrioridadeOperacional(score) {
  if (score >= 70) return PPCI_PRIORIDADE_OPERACIONAL.ALTA;
  if (score >= 35) return PPCI_PRIORIDADE_OPERACIONAL.MEDIA;
  return PPCI_PRIORIDADE_OPERACIONAL.BAIXA;
}

export function obterAlertaPrazoPPCI(item = {}) {
  const dataVencimento = item?.[PPCI_CAMPOS.DATA_VENCIMENTO];
  const dias = obterDiasParaVencer(dataVencimento);

  if (dias === null) {
    return {
      ...PPCI_ALERTAS.SEM_DATA,
      dias,
      textoPrazo: "Sem data limite",
    };
  }

  if (dias < 0) {
    return {
      ...PPCI_ALERTAS.VENCIDO,
      dias,
      textoPrazo: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`,
    };
  }

  if (dias === 0) {
    return {
      ...PPCI_ALERTAS.CRITICO,
      dias,
      textoPrazo: "Vence hoje",
    };
  }

  if (dias <= 60) {
    return {
      ...PPCI_ALERTAS.CRITICO,
      dias,
      textoPrazo: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`,
    };
  }

  if (dias <= 180) {
    return {
      ...PPCI_ALERTAS.ATENCAO,
      dias,
      textoPrazo: `Vence em ${dias} dias`,
    };
  }

  return {
    ...PPCI_ALERTAS.REGULAR,
    dias,
    textoPrazo: `Vence em ${dias} dias`,
  };
}

export function obterAlertasPPCI(item = {}) {
  const alertas = [obterAlertaPrazoPPCI(item)];

  if (valorVazioOperacional(item?.[PPCI_CAMPOS.RESPONSAVEL])) {
    alertas.push({
      ...PPCI_ALERTAS.SEM_RESPONSAVEL,
      dias: null,
      textoPrazo: "Sem responsável cadastrado",
    });
  }

  return alertas;
}

export function calcularScoreOperacionalPPCI(item = {}) {
  const criterios = [];
  let score = 0;

  const alertaPrazo = obterAlertaPrazoPPCI(item);
  const prioridadeManual = obterPrioridadeManual(item?.[PPCI_CAMPOS.PRIORIDADE]);
  const conclusao = normalizarConclusao(item?.[PPCI_CAMPOS.CONCLUSAO]);
  const semResponsavel = valorVazioOperacional(item?.[PPCI_CAMPOS.RESPONSAVEL]);
  const semLinkProcesso = valorVazioOperacional(item?.[PPCI_CAMPOS.LINK_PROCESSO]);
  const semProximoPasso = valorVazioOperacional(item?.[PPCI_CAMPOS.PROXIMO_PASSO]);

  function adicionarCriterio(id, label, peso) {
    if (!peso) return;

    score += peso;
    criterios.push({ id, label, peso });
  }

  switch (alertaPrazo.id) {
    case PPCI_ALERTAS.VENCIDO.id:
      adicionarCriterio("prazo_vencido", alertaPrazo.textoPrazo, 35);
      break;

    case PPCI_ALERTAS.CRITICO.id:
      adicionarCriterio("prazo_critico", alertaPrazo.textoPrazo, 28);
      break;

    case PPCI_ALERTAS.ATENCAO.id:
      adicionarCriterio("prazo_atencao", alertaPrazo.textoPrazo, 12);
      break;

    case PPCI_ALERTAS.SEM_DATA.id:
      adicionarCriterio("sem_data", "Sem data limite", 18);
      break;

    default:
      break;
  }

  if (semResponsavel) {
    adicionarCriterio("sem_responsavel", "Sem responsável", 25);
  }

  if (prioridadeManual === 1) {
    adicionarCriterio("prioridade_1", "Prioridade manual P1", 22);
  } else if (prioridadeManual === 2) {
    adicionarCriterio("prioridade_2", "Prioridade manual P2", 12);
  } else if (prioridadeManual === 3) {
    adicionarCriterio("prioridade_3", "Prioridade manual P3", 4);
  }

  if (conclusao < 25) {
    adicionarCriterio("baixa_conclusao_25", "Conclusão abaixo de 25%", 14);
  } else if (conclusao < 50) {
    adicionarCriterio("baixa_conclusao_50", "Conclusão abaixo de 50%", 8);
  } else if (conclusao < 75) {
    adicionarCriterio("baixa_conclusao_75", "Conclusão abaixo de 75%", 4);
  }

  if (semProximoPasso) {
    adicionarCriterio("sem_proximo_passo", "Sem próximo passo", 8);
  }

  if (semLinkProcesso) {
    adicionarCriterio("sem_link_processo", "Sem link do processo", 4);
  }

  const scoreFinal = Math.min(100, Math.max(0, Math.round(score)));
  const classificacao = classificarPrioridadeOperacional(scoreFinal);

  return {
    score: scoreFinal,
    classificacao,
    nivel: classificacao.id,
    label: classificacao.label,
    classe: classificacao.classe,
    criterios,
    alertaPrazo,
    prioridadeManual,
    conclusao,
  };
}

export function compararRiscoOperacional(a = {}, b = {}) {
  const riscoA = calcularScoreOperacionalPPCI(a);
  const riscoB = calcularScoreOperacionalPPCI(b);

  if (riscoB.score !== riscoA.score) {
    return riscoB.score - riscoA.score;
  }

  const diasA = riscoA.alertaPrazo.dias ?? 99999;
  const diasB = riscoB.alertaPrazo.dias ?? 99999;

  if (diasA !== diasB) {
    return diasA - diasB;
  }

  const prioridadeA = riscoA.prioridadeManual || 999;
  const prioridadeB = riscoB.prioridadeManual || 999;

  if (prioridadeA !== prioridadeB) {
    return prioridadeA - prioridadeB;
  }

  return String(a?.[PPCI_CAMPOS.ID] || "").localeCompare(
    String(b?.[PPCI_CAMPOS.ID] || ""),
    "pt-BR"
  );
}

export function normalizarFiltroAlerta(filtroAlerta) {
  if (!filtroAlerta) return null;

  if (typeof filtroAlerta === "string") {
    const alerta = PPCI_ALERTAS_MAPA[filtroAlerta];
    return alerta ? { ...alerta } : null;
  }

  if (typeof filtroAlerta !== "object") return null;

  const id = filtroAlerta.id;
  const alerta = PPCI_ALERTAS_MAPA[id];

  if (!alerta) return null;

  return {
    ...alerta,
    label: filtroAlerta.label ?? alerta.label,
    descricao: filtroAlerta.descricao ?? alerta.descricao,
  };
}

export function correspondeFiltroAlerta(item = {}, filtroAlerta = null) {
  const filtro = normalizarFiltroAlerta(filtroAlerta);

  if (!filtro) return true;

  const alertaPrazo = obterAlertaPrazoPPCI(item);

  switch (filtro.id) {
    case PPCI_ALERTAS.VENCIDO.id:
    case PPCI_ALERTAS.CRITICO.id:
    case PPCI_ALERTAS.ATENCAO.id:
    case PPCI_ALERTAS.REGULAR.id:
    case PPCI_ALERTAS.SEM_DATA.id:
      return alertaPrazo.id === filtro.id;

    case PPCI_ALERTAS.SEM_RESPONSAVEL.id:
      return valorVazioOperacional(item?.[PPCI_CAMPOS.RESPONSAVEL]);

    default:
      return true;
  }
}

export function contarAlertasPPCI(ppcis = []) {
  const contadores = PPCI_ALERTAS_LISTA.reduce((mapa, alerta) => {
    mapa[alerta.id] = {
      ...alerta,
      total: 0,
      exemplos: [],
    };
    return mapa;
  }, {});

  ppcis.forEach((item) => {
    const alertaPrazo = obterAlertaPrazoPPCI(item);

    if (contadores[alertaPrazo.id]) {
      contadores[alertaPrazo.id].total += 1;
      if (contadores[alertaPrazo.id].exemplos.length < 5) {
        contadores[alertaPrazo.id].exemplos.push(item);
      }
    }

    if (valorVazioOperacional(item?.[PPCI_CAMPOS.RESPONSAVEL])) {
      contadores[PPCI_ALERTAS.SEM_RESPONSAVEL.id].total += 1;
      if (contadores[PPCI_ALERTAS.SEM_RESPONSAVEL.id].exemplos.length < 5) {
        contadores[PPCI_ALERTAS.SEM_RESPONSAVEL.id].exemplos.push(item);
      }
    }
  });

  return contadores;
}

export function calcularResumoAlertasPPCI(ppcis = []) {
  const contadores = contarAlertasPPCI(ppcis);

  const cards = [
    PPCI_ALERTAS.VENCIDO.id,
    PPCI_ALERTAS.CRITICO.id,
    PPCI_ALERTAS.ATENCAO.id,
    PPCI_ALERTAS.SEM_RESPONSAVEL.id,
    PPCI_ALERTAS.SEM_DATA.id,
  ].map((id) => contadores[id]);

  const totalCriticos =
    contadores[PPCI_ALERTAS.VENCIDO.id].total +
    contadores[PPCI_ALERTAS.CRITICO.id].total +
    contadores[PPCI_ALERTAS.SEM_RESPONSAVEL.id].total;

  const totalAtencao =
    contadores[PPCI_ALERTAS.ATENCAO.id].total +
    contadores[PPCI_ALERTAS.SEM_DATA.id].total;

  const totalRegulares = contadores[PPCI_ALERTAS.REGULAR.id].total;

  return {
    totalPPCIs: ppcis.length,
    totalCriticos,
    totalAtencao,
    totalRegulares,
    contadores,
    cards,
  };
}
