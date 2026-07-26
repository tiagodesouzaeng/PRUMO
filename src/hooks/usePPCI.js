/* =========================================================
   RELEASE........: v2.6.0 RC1
   ARQUIVO........: src/hooks/usePPCI.js
   DESCRIÇÃO......: Carregamento dos PPCIs com estados de loading e erro
========================================================= */

import { useCallback, useEffect, useState } from "react";
import { getPPCIs } from "../services/api";

export default function usePPCI() {
  const [ppcis, setPpcis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      const dados = await getPPCIs();

      if (!Array.isArray(dados)) {
        throw new Error("A API não retornou uma lista válida de PPCIs.");
      }

      setPpcis(dados);

      setUltimaAtualizacao(
        new Date().toLocaleString("pt-BR")
      );
    } catch (erroCapturado) {
      console.error("Erro ao carregar PPCIs:", erroCapturado);

      setErro(
        erroCapturado?.message ||
          "Não foi possível carregar os dados dos PPCIs."
      );

      setPpcis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return {
    ppcis,
    setPpcis,
    loading,
    erro,
    ultimaAtualizacao,
    carregarDados,
  };
}
