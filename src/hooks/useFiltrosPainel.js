/* =====================================================
   RELEASE........: v6.2.0 RC1
   ARQUIVO........: src/hooks/useFiltrosPainel.js
   DESCRIÇÃO......: Centralização dos estados e ações de filtro do Painel PPCI,
                    com persistência de ordenação, visão operacional salva,
                    filtro por pendência de qualidade cadastral e alerta operacional.
===================================================== */

import { useEffect, useMemo, useState } from "react";

import {
  limparFiltros,
  aplicarFiltroRapido,
} from "./useFiltros";

import {
  ORDENACAO_PADRAO,
  SIGIU_STORAGE_KEYS,
} from "../config/sigiuConfig";

import { normalizarFiltroAlerta } from "../domain/ppciAlertas";

function lerLocalStorage(chave) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarLocalStorage(chave, valor) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // Mantém o painel funcional mesmo quando o navegador bloquear localStorage.
  }
}

function removerLocalStorage(chave) {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // Mantém o painel funcional mesmo quando o navegador bloquear localStorage.
  }
}

function lerJSONLocalStorage(chave) {
  try {
    const valor = window.localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
}

function obterOrdenacaoInicial() {
  return lerLocalStorage(SIGIU_STORAGE_KEYS.ORDENACAO) || ORDENACAO_PADRAO;
}

function obterMetadadosVisaoSalva() {
  const visao = lerJSONLocalStorage(SIGIU_STORAGE_KEYS.VISAO_FILTROS);

  if (!visao) {
    return {
      haVisaoSalva: false,
      dataVisaoSalva: null,
    };
  }

  return {
    haVisaoSalva: true,
    dataVisaoSalva: visao.salvoEm ?? null,
  };
}

function normalizarFiltroQualidade(filtroQualidade) {
  if (!filtroQualidade || typeof filtroQualidade !== "object") return null;
  if (!filtroQualidade.id || !filtroQualidade.campo) return null;

  return {
    id: filtroQualidade.id,
    label: filtroQualidade.label ?? filtroQualidade.id,
    campo: filtroQualidade.campo,
    nivel: filtroQualidade.nivel ?? "atencao",
    descricao: filtroQualidade.descricao ?? "Pendência de qualidade cadastral.",
  };
}

export default function useFiltrosPainel() {
  const [filtro, setFiltro] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroQualidade, setFiltroQualidadeBase] = useState(null);
  const [filtroAlerta, setFiltroAlertaBase] = useState(null);
  const [ordenacao, setOrdenacao] = useState(obterOrdenacaoInicial);
  const [preferenciasVersao, setPreferenciasVersao] = useState(0);
  const [metadadosVisao, setMetadadosVisao] = useState(obterMetadadosVisaoSalva);

  const setFiltroQualidade = (valor) => {
    setFiltroQualidadeBase(normalizarFiltroQualidade(valor));
  };

  const setFiltroAlerta = (valor) => {
    setFiltroAlertaBase(normalizarFiltroAlerta(valor));
  };

  useEffect(() => {
    gravarLocalStorage(SIGIU_STORAGE_KEYS.ORDENACAO, ordenacao);
  }, [ordenacao]);

  const setters = useMemo(
    () => ({
      setFiltro,
      setFiltroSituacao,
      setFiltroStatus,
      setFiltroCategoria,
      setFiltroResponsavel,
      setFiltroUnidade,
      setFiltroQualidade,
      setFiltroAlerta,
      setOrdenacao,
    }),
    []
  );

  const filtrosAtuais = useMemo(
    () => ({
      filtro,
      filtroSituacao,
      filtroStatus,
      filtroCategoria,
      filtroResponsavel,
      filtroUnidade,
      filtroQualidade,
      filtroAlerta,
      ordenacao,
    }),
    [
      filtro,
      filtroSituacao,
      filtroStatus,
      filtroCategoria,
      filtroResponsavel,
      filtroUnidade,
      filtroQualidade,
      filtroAlerta,
      ordenacao,
    ]
  );

  const aplicarFiltro = (tipo, valor) => {
    aplicarFiltroRapido(tipo, valor, setters);
  };

  const limparTodosFiltros = () => {
    limparFiltros(setters);
  };

  const aplicarVisaoSalva = (visao) => {
    const filtros = visao?.filtros ?? {};

    setFiltro(filtros.filtro ?? "");
    setFiltroSituacao(filtros.filtroSituacao ?? "");
    setFiltroStatus(filtros.filtroStatus ?? "");
    setFiltroCategoria(filtros.filtroCategoria ?? "");
    setFiltroResponsavel(filtros.filtroResponsavel ?? "");
    setFiltroUnidade(filtros.filtroUnidade ?? "");
    setFiltroQualidade(filtros.filtroQualidade ?? null);
    setFiltroAlerta(filtros.filtroAlerta ?? null);
    setOrdenacao(filtros.ordenacao ?? ORDENACAO_PADRAO);
  };

  const salvarVisaoAtual = () => {
    const visao = {
      versao: "6.2.0-RC1",
      salvoEm: new Date().toISOString(),
      filtros: filtrosAtuais,
    };

    gravarLocalStorage(
      SIGIU_STORAGE_KEYS.VISAO_FILTROS,
      JSON.stringify(visao)
    );

    setMetadadosVisao(obterMetadadosVisaoSalva());
    return visao;
  };

  const restaurarVisaoSalva = () => {
    const visao = lerJSONLocalStorage(SIGIU_STORAGE_KEYS.VISAO_FILTROS);

    if (!visao) return false;

    aplicarVisaoSalva(visao);
    return true;
  };

  const limparPreferenciasLocais = () => {
    removerLocalStorage(SIGIU_STORAGE_KEYS.ORDENACAO);
    removerLocalStorage(SIGIU_STORAGE_KEYS.MODO_VISUAL);
    removerLocalStorage(SIGIU_STORAGE_KEYS.VISAO_FILTROS);

    setFiltro("");
    setFiltroSituacao("");
    setFiltroStatus("");
    setFiltroCategoria("");
    setFiltroResponsavel("");
    setFiltroUnidade("");
    setFiltroQualidade(null);
    setFiltroAlerta(null);
    setOrdenacao(ORDENACAO_PADRAO);
    setMetadadosVisao(obterMetadadosVisaoSalva());
    setPreferenciasVersao((versao) => versao + 1);
  };

  return {
    filtro,
    setFiltro,

    filtroSituacao,
    setFiltroSituacao,

    filtroStatus,
    setFiltroStatus,

    filtroCategoria,
    setFiltroCategoria,

    filtroResponsavel,
    setFiltroResponsavel,

    filtroUnidade,
    setFiltroUnidade,

    filtroQualidade,
    setFiltroQualidade,

    filtroAlerta,
    setFiltroAlerta,

    ordenacao,
    setOrdenacao,

    aplicarFiltro,
    limparTodosFiltros,

    filtrosAtuais,
    salvarVisaoAtual,
    restaurarVisaoSalva,
    limparPreferenciasLocais,
    preferenciasVersao,
    haVisaoSalva: metadadosVisao.haVisaoSalva,
    dataVisaoSalva: metadadosVisao.dataVisaoSalva,
  };
}
