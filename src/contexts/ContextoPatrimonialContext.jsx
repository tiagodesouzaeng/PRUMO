import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  criarClientePrumo,
  obterConfiguracaoInfraestrutura,
  obterContextoDesenvolvimento,
} from "../services/infraestruturaCorporativa";
import {
  CONTEXTO_PATRIMONIAL_VAZIO,
  construirSelecaoPatrimonial,
  idsNoEscopoPatrimonial,
} from "../services/contextoPatrimonial";

const NIVEIS = ["cliente", "site", "predio", "sala"];
const CONTEXTO_VAZIO = CONTEXTO_PATRIMONIAL_VAZIO;
const ContextoPatrimonial = createContext(null);

function criarCliente() {
  const configuracao = obterConfiguracaoInfraestrutura();
  const contexto = obterContextoDesenvolvimento();
  if (!configuracao.apiConfigurada || !contexto) return null;
  return criarClientePrumo({ baseUrl: configuracao.apiUrl, obterContexto: () => contexto });
}

export function ContextoPatrimonialProvider({ children }) {
  const clienteApi = useMemo(criarCliente, []);
  const [contextoCorporativo, setContextoCorporativo] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [selecao, setSelecao] = useState(CONTEXTO_VAZIO);
  const [carregando, setCarregando] = useState(Boolean(clienteApi));
  const [erro, setErro] = useState("");

  const chavePreferencia = contextoCorporativo?.tenantId
    ? `prumo:contexto-patrimonial:${contextoCorporativo.tenantId}:${contextoCorporativo.teamId || "geral"}`
    : "";

  useEffect(() => {
    if (!clienteApi) return;
    let ativo = true;
    Promise.all([
      clienteApi.obterContextoCorporativo(),
      clienteApi.listarUnidadesPatrimoniais(),
    ]).then(([contexto, lista]) => {
      if (!ativo) return;
      setContextoCorporativo(contexto);
      setUnidades(lista);
      const chave = `prumo:contexto-patrimonial:${contexto.tenantId}:${contexto.teamId || "geral"}`;
      let preferencia = null;
      try { preferencia = JSON.parse(globalThis.localStorage?.getItem(chave) || "null"); } catch { /* preferência opcional */ }
      const alvo = lista.find((item) => item.id === preferencia?.sala)
        || lista.find((item) => item.id === preferencia?.predio)
        || lista.find((item) => item.id === preferencia?.site)
        || lista.find((item) => item.id === preferencia?.cliente)
        || lista.find((item) => item.nivel === "cliente")
        || null;
      setSelecao(construirSelecaoPatrimonial(alvo, lista));
      setErro("");
    }).catch((falha) => {
      if (ativo) setErro(falha.message);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [clienteApi]);

  useEffect(() => {
    if (!chavePreferencia) return;
    try { globalThis.localStorage?.setItem(chavePreferencia, JSON.stringify(selecao)); } catch { /* preferência opcional */ }
  }, [chavePreferencia, selecao]);

  function selecionar(nivel, id) {
    if (!NIVEIS.includes(nivel)) return;
    if (!id) {
      const indice = NIVEIS.indexOf(nivel);
      setSelecao((atual) => {
        const proxima = { ...atual };
        NIVEIS.slice(indice).forEach((item) => { proxima[item] = ""; });
        return proxima;
      });
      return;
    }
    const unidade = unidades.find((item) => item.id === id && item.nivel === nivel);
    if (unidade) setSelecao(construirSelecaoPatrimonial(unidade, unidades));
  }

  function selecionarUnidade(id) {
    const unidade = unidades.find((item) => item.id === id);
    if (unidade) setSelecao(construirSelecaoPatrimonial(unidade, unidades));
  }

  async function recarregar() {
    if (!clienteApi) return;
    const lista = await clienteApi.listarUnidadesPatrimoniais();
    setUnidades(lista);
    const alvoId = selecao.sala || selecao.predio || selecao.site || selecao.cliente;
    setSelecao(construirSelecaoPatrimonial(lista.find((item) => item.id === alvoId), lista));
  }

  const unidadeAtivaId = selecao.sala || selecao.predio || selecao.site || selecao.cliente || "";
  const porNivel = useMemo(() => ({
    cliente: unidades.filter((item) => item.nivel === "cliente" && item.status === "ativo"),
    site: unidades.filter((item) => item.nivel === "site" && item.parentId === selecao.cliente && item.status === "ativo"),
    predio: unidades.filter((item) => item.nivel === "predio" && item.parentId === selecao.site && item.status === "ativo"),
    sala: unidades.filter((item) => item.nivel === "sala" && item.parentId === selecao.predio && item.status === "ativo"),
  }), [unidades, selecao]);
  const idsEscopo = useMemo(() => idsNoEscopoPatrimonial(unidades, unidadeAtivaId), [unidades, unidadeAtivaId]);
  const unidadeAtiva = unidades.find((item) => item.id === unidadeAtivaId) || null;
  const clienteSelecionado = unidades.find((item) => item.id === selecao.cliente) || null;

  const valor = {
    clienteApi, contextoCorporativo, unidades, porNivel, selecao, selecionar, selecionarUnidade,
    unidadeAtivaId, unidadeAtiva, clienteSelecionado, idsEscopo, carregando, erro, recarregar,
    estaNoEscopo: (unidadeId) => !unidadeId || idsEscopo.has(unidadeId),
  };

  return <ContextoPatrimonial.Provider value={valor}>{children}</ContextoPatrimonial.Provider>;
}

export function useContextoPatrimonial() {
  const contexto = useContext(ContextoPatrimonial);
  if (!contexto) throw new Error("O contexto patrimonial precisa estar dentro do provedor global.");
  return contexto;
}
