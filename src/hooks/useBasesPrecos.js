import { useEffect, useMemo, useState } from "react";
import { importarArquivoBasePrecos } from "../services/sinapiImport";
import {
  carregarItensComposicaoBase,
  carregarReferenciasBase,
  listarBasesPrecos,
  removerBasePrecos,
  salvarBasePrecos,
} from "../services/basePrecosRepository";

export default function useBasesPrecos() {
  const [bases, setBases] = useState([]);
  const [baseAtivaId, setBaseAtivaId] = useState("");
  const [referencias, setReferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarBasesPrecos()
      .then((encontradas) => {
        setBases(encontradas);
        setBaseAtivaId((atual) => atual || encontradas[0]?.id || "");
      })
      .catch((error) => console.error("Não foi possível carregar as bases de preços.", error))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    let ativo = true;
    if (!baseAtivaId) {
      setReferencias([]);
      setCarregando(false);
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
  }, [baseAtivaId]);

  const baseAtiva = useMemo(
    () => bases.find((base) => base.id === baseAtivaId),
    [bases, baseAtivaId],
  );

  async function importar(arquivo, metadados) {
    setCarregando(true);
    try {
      const resultado = await importarArquivoBasePrecos(arquivo, metadados);
      await salvarBasePrecos(resultado.base, resultado.referencias);
      const atualizadas = await listarBasesPrecos();
      setBases(atualizadas);
      setBaseAtivaId(resultado.base.id);
      setReferencias(resultado.referencias);
      return resultado;
    } finally {
      setCarregando(false);
    }
  }

  async function remover(baseId) {
    await removerBasePrecos(baseId);
    const atualizadas = await listarBasesPrecos();
    setBases(atualizadas);
    setBaseAtivaId(atualizadas[0]?.id || "");
  }

  return {
    bases,
    baseAtiva,
    baseAtivaId,
    setBaseAtivaId,
    referencias,
    carregando,
    importar,
    remover,
    carregarItensComposicao: (codigo) => (
      carregarItensComposicaoBase(baseAtivaId, codigo)
    ),
  };
}
