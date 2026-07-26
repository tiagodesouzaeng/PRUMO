/* =========================================================
   RELEASE........: v1.0.0 RC1
   ARQUIVO........: src/hooks/usePPCI.js

   RESPONSABILIDADE:
   Centralizar o carregamento dos PPCIs.
========================================================= */

import { useCallback, useEffect, useState } from "react";
import { getPPCIs } from "../services/api";

export default function usePPCI() {

  const [ppcis, setPpcis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");

  const carregarDados = useCallback(async () => {

    try {

      setLoading(true);

      const dados = await getPPCIs();

      setPpcis(dados);

      setUltimaAtualizacao(
        new Date().toLocaleString("pt-BR")
      );

    } catch (erro) {

      console.error("Erro ao carregar PPCIs:", erro);

      console.error(erro);

      // TODO: integrar com sistema de notificações da aplicação.

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
    ultimaAtualizacao,
    carregarDados
  };

}
