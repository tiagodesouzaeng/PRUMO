import { useEffect, useMemo, useState } from "react";
import { importarArquivoBasePrecos } from "../services/sinapiImport";
import {
  arquivarBasePrecos,
  carregarItensComposicaoBase,
  carregarReferenciasBase,
  listarBasesPrecos,
  restaurarBasePrecos,
  salvarBasePrecos,
} from "../services/basePrecosRepository";
import {
  listarComposicoesProprias,
  removerComposicaoPropria,
  salvarComposicaoPropria,
} from "../services/composicoesPropriasRepository";

export const BASE_PROPRIA_ID = "base-propria-prumo";
export const BASES_TODAS_ID = "todas-as-bases-prumo";

export default function useBasesPrecos() {
  const [basesImportadas, setBasesImportadas] = useState([]);
  const [basesExcluidas, setBasesExcluidas] = useState([]);
  const [composicoesProprias, setComposicoesProprias] = useState(listarComposicoesProprias);
  const [baseAtivaId, setBaseAtivaId] = useState("");
  const [referencias, setReferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarBasesPrecos({ incluirExcluidas: true })
      .then((encontradas) => {
        const ativas = encontradas.filter((base) => base.status !== "excluida");
        setBasesImportadas(ativas);
        setBasesExcluidas(encontradas.filter((base) => base.status === "excluida"));
        setBaseAtivaId((atual) => atual || ativas[0]?.id || BASE_PROPRIA_ID);
      })
      .catch((error) => console.error("Não foi possível carregar as bases de preços.", error))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const recarregar = () => setComposicoesProprias(listarComposicoesProprias());
    globalThis.addEventListener?.("prumo-composicoes-proprias", recarregar);
    return () => globalThis.removeEventListener?.("prumo-composicoes-proprias", recarregar);
  }, []);

  const basePropria = useMemo(() => ({
    id: BASE_PROPRIA_ID,
    titulo: "Base própria PRUMO",
    fonte: "PRÓPRIA",
    uf: "GERAL",
    referencia: "Atual",
    regime: "PRÓPRIO",
    total: composicoesProprias.length,
    registros: composicoesProprias.length,
    insumos: 0,
    composicoes: composicoesProprias.length,
    itensComposicao: composicoesProprias.reduce(
      (total, item) => total + (item.componentes?.length || 0),
      0,
    ),
    semPreco: 0,
    statusPreco: "Base corporativa",
    propria: true,
  }), [composicoesProprias]);
  const bases = useMemo(
    () => [...basesImportadas, basePropria],
    [basesImportadas, basePropria],
  );
  const baseTodas = useMemo(() => ({
    id: BASES_TODAS_ID,
    titulo: "Todas as bases disponíveis",
    fonte: "TODAS",
    uf: "MÚLTIPLAS",
    referencia: "Todas",
    regime: "CONSOLIDADO",
    registros: bases.reduce((total, base) => total + Number(base.registros || 0), 0),
    total: bases.reduce((total, base) => total + Number(base.total || (Number(base.composicoes || 0) + Number(base.insumos || 0))), 0),
    insumos: bases.reduce((total, base) => total + Number(base.insumos || 0), 0),
    composicoes: bases.reduce((total, base) => total + Number(base.composicoes || 0), 0),
    ufsDisponiveis: [...new Set(bases.flatMap((base) => base.ufsDisponiveis || [base.uf]).filter(Boolean))],
    todas: true,
  }), [bases]);
  const basesSelecionaveis = useMemo(() => [baseTodas, ...bases], [baseTodas, bases]);

  useEffect(() => {
    let ativo = true;
    if (!baseAtivaId) {
      setReferencias([]);
      setCarregando(false);
      return () => { ativo = false; };
    }
    if (baseAtivaId === BASE_PROPRIA_ID) {
      setReferencias(composicoesProprias.map((composicao) => ({
        uid: `${BASE_PROPRIA_ID}:composicao:${composicao.codigo}`,
        codigo: composicao.codigo,
        descricao: composicao.descricao,
        unidade: composicao.unidade,
        preco: composicao.custoUnitario,
        tipo: "composicao",
        basePrecoId: BASE_PROPRIA_ID,
        semPreco: false,
      })));
      setCarregando(false);
      return () => { ativo = false; };
    }
    if (baseAtivaId === BASES_TODAS_ID) {
      setCarregando(true);
      Promise.all(basesImportadas.map(async (base) => (
        (await carregarReferenciasBase(base.id)).map((referencia) => ({
          ...referencia,
          basePrecoId: base.id,
          baseTitulo: base.titulo,
          baseUf: base.uf,
          baseReferencia: base.referencia,
        }))
      )))
        .then((grupos) => {
          if (!ativo) return;
          const proprias = composicoesProprias.map((composicao) => ({
            ...composicao,
            uid: `${BASE_PROPRIA_ID}:composicao:${composicao.codigo}`,
            tipo: "composicao",
            preco: composicao.custoUnitario,
            basePrecoId: BASE_PROPRIA_ID,
            baseTitulo: basePropria.titulo,
            semPreco: false,
          }));
          setReferencias([...grupos.flat(), ...proprias]);
        })
        .catch((error) => console.error("Não foi possível consolidar as bases.", error))
        .finally(() => { if (ativo) setCarregando(false); });
      return () => { ativo = false; };
    }
    setCarregando(true);
    carregarReferenciasBase(baseAtivaId)
      .then((encontradas) => {
        if (ativo) setReferencias(encontradas);
      })
      .catch((error) => console.error("Não foi possível carregar o catálogo selecionado.", error))
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => { ativo = false; };
  }, [baseAtivaId, composicoesProprias, basesImportadas]);

  const baseAtiva = useMemo(
    () => basesSelecionaveis.find((base) => base.id === baseAtivaId),
    [basesSelecionaveis, baseAtivaId],
  );

  async function recarregarBases() {
    const todas = await listarBasesPrecos({ incluirExcluidas: true });
    const ativas = todas.filter((base) => base.status !== "excluida");
    setBasesImportadas(ativas);
    setBasesExcluidas(todas.filter((base) => base.status === "excluida"));
    return ativas;
  }

  async function importar(arquivo, metadados) {
    setCarregando(true);
    try {
      const resultado = await importarArquivoBasePrecos(arquivo, metadados);
      await salvarBasePrecos(resultado.base, resultado.referencias, arquivo);
      const precos = new Map(
        resultado.referencias
          .filter((item) => ["composicao", "insumo"].includes(item.tipo) && !item.semPreco)
          .map((item) => [`${item.tipo}:${item.codigo}`, item.preco]),
      );
      composicoesProprias.forEach((composicao) => {
        let alterada = false;
        const componentes = (composicao.componentes || []).map((componente) => {
          if (componente.basePrecoId !== resultado.base.id) return componente;
          const preco = precos.get(`${componente.referenciaTipo}:${componente.referenciaCodigo}`);
          if (preco == null) return componente;
          alterada = true;
          return { ...componente, preco };
        });
        if (alterada) salvarPropria({ ...composicao, componentes });
      });
      const atualizadas = await recarregarBases();
      setBasesImportadas(atualizadas);
      setBaseAtivaId(resultado.base.id);
      setReferencias(resultado.referencias);
      return resultado;
    } finally {
      setCarregando(false);
    }
  }

  async function remover(baseId) {
    if (baseId === BASE_PROPRIA_ID) return;
    await arquivarBasePrecos(baseId);
    const atualizadas = await recarregarBases();
    setBasesImportadas(atualizadas);
    setBaseAtivaId(atualizadas[0]?.id || BASE_PROPRIA_ID);
  }

  async function restaurar(baseId) {
    await restaurarBasePrecos(baseId);
    const atualizadas = await recarregarBases();
    setBaseAtivaId(baseId);
    return atualizadas;
  }

  function salvarPropria(dados) {
    const componentes = dados.componentes || [];
    const custoUnitario = componentes.length
      ? componentes.reduce(
        (total, item) => total + Number(item.coeficiente) * Number(item.preco),
        0,
      )
      : Number(dados.custoUnitario) || 0;
    const salva = salvarComposicaoPropria({ ...dados, custoUnitario, componentes });
    setComposicoesProprias(listarComposicoesProprias());
    return salva;
  }

  function removerPropria(composicaoId) {
    removerComposicaoPropria(composicaoId);
    setComposicoesProprias(listarComposicoesProprias());
  }

  async function carregarItensComposicao(baseId, codigo, uf = "RS") {
    if (baseId === BASE_PROPRIA_ID) {
      return composicoesProprias.find((item) => item.codigo === codigo)?.componentes || [];
    }
    return carregarItensComposicaoBase(baseId, codigo, uf);
  }

  return {
    bases,
    basesSelecionaveis,
    basesExcluidas,
    baseAtiva,
    baseAtivaId,
    setBaseAtivaId,
    referencias,
    carregando,
    importar,
    remover,
    restaurar,
    usuarioAdministrador: true,
    composicoesProprias,
    salvarComposicaoPropria: salvarPropria,
    removerComposicaoPropria: removerPropria,
    carregarItensComposicao,
  };
}
