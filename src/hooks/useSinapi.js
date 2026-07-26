import { useEffect, useMemo, useState } from "react";
import { importarArquivoSinapi } from "../services/sinapiImport";
import {
  carregarReferenciasSinapi,
  listarBasesSinapi,
  removerBaseSinapi,
  salvarBaseSinapi,
} from "../services/sinapiRepository";

export default function useSinapi() {
  const [bases, setBases] = useState([]);
  const [baseAtivaId, setBaseAtivaId] = useState("");
  const [referencias, setReferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarBasesSinapi()
      .then((encontradas) => {
        setBases(encontradas);
        setBaseAtivaId((atual) => atual || encontradas[0]?.id || "");
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!baseAtivaId) {
      setReferencias([]);
      return;
    }
    carregarReferenciasSinapi(baseAtivaId).then(setReferencias);
  }, [baseAtivaId]);

  const baseAtiva = useMemo(
    () => bases.find((base) => base.id === baseAtivaId),
    [bases, baseAtivaId],
  );

  async function importar(arquivo, metadados) {
    setCarregando(true);
    try {
      const resultado = await importarArquivoSinapi(arquivo, metadados);
      await salvarBaseSinapi(resultado.base, resultado.referencias);
      const atualizadas = await listarBasesSinapi();
      setBases(atualizadas);
      setBaseAtivaId(resultado.base.id);
      setReferencias(resultado.referencias);
      return resultado;
    } finally {
      setCarregando(false);
    }
  }

  async function remover(baseId) {
    await removerBaseSinapi(baseId);
    const atualizadas = await listarBasesSinapi();
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
  };
}
