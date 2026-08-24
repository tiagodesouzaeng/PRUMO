/* =========================================================
   RELEASE........: v2.6.0 RC1
   ARQUIVO........: src/hooks/usePPCI.js
   DESCRIÇÃO......: Carregamento dos PPCIs com estados de loading e erro
========================================================= */

import { useCallback, useEffect, useState } from "react";
import { criarClientePrumo, obterConfiguracaoInfraestrutura, obterContextoDesenvolvimento } from "../services/infraestruturaCorporativa";
import { PPCI_CAMPOS } from "../domain/ppciCampos";

function compatibilizar(item) {
  return {
    ...item,
    [PPCI_CAMPOS.ID]: item.id,
    [PPCI_CAMPOS.UNIDADE]: item.localNivel === "site" ? item.local : "",
    [PPCI_CAMPOS.PREDIO]: item.local || item.localCodigo || "",
    [PPCI_CAMPOS.PROCESSO]: item.numeroProcesso || "",
    [PPCI_CAMPOS.PRIORIDADE]: item.classificacaoRisco === "especial" ? 1 : item.classificacaoRisco === "alto" ? 2 : 3,
    [PPCI_CAMPOS.CATEGORIA]: item.ocupacao || "Segurança predial",
    [PPCI_CAMPOS.STATUS]: item.statusCalculado || item.status,
    [PPCI_CAMPOS.CONCLUSAO]: item.fase === "concluido" ? 100 : item.fase === "vistoria" ? 85 : item.fase === "analise" ? 60 : 30,
    [PPCI_CAMPOS.DESCRICAO]: item.titulo,
    [PPCI_CAMPOS.PROXIMO_PASSO]: item.proximoPasso || "",
    [PPCI_CAMPOS.RESPONSAVEL]: item.responsavel || "",
    [PPCI_CAMPOS.DATA_ENTRADA]: item.criadoEm?.slice?.(0, 10) || "",
    [PPCI_CAMPOS.DATA_INICIO]: item.dataProtocolo || "",
    [PPCI_CAMPOS.DATA_ENTREGA]: item.dataAprovacao || "",
    [PPCI_CAMPOS.DATA_VENCIMENTO]: item.dataValidade || "",
    [PPCI_CAMPOS.OBSERVACOES]: item.dados?.observacoes || "",
  };
}

export default function usePPCI() {
  const [ppcis, setPpcis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      const configuracao = obterConfiguracaoInfraestrutura();
      if (!configuracao.apiConfigurada) throw new Error("A API local do PRUMO não está configurada.");
      const cliente = criarClientePrumo({ baseUrl: configuracao.apiUrl, obterContexto: () => obterContextoDesenvolvimento() });
      const dados = await cliente.listarPpcis();

      if (!Array.isArray(dados)) {
        throw new Error("A API não retornou uma lista válida de PPCIs.");
      }

      setPpcis(dados.map(compatibilizar));

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
