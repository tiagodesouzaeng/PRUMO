import { useEffect, useMemo, useState } from "react";
import {
  criarId,
  criarOrcamento,
  numeroSeguro,
} from "../domain/orcamento";
import {
  carregarOrcamentoAtivo,
  carregarOrcamentos,
  restaurarOrcamentos,
  salvarOrcamentoAtivo,
  salvarOrcamentos,
} from "../services/orcamentoRepository";

export default function useOrcamentos() {
  const [orcamentos, setOrcamentos] = useState(carregarOrcamentos);
  const [orcamentoAtivoId, setOrcamentoAtivoId] = useState(
    () => carregarOrcamentoAtivo() || carregarOrcamentos()[0]?.id || "",
  );

  const orcamentoAtivo = useMemo(
    () => orcamentos.find((item) => item.id === orcamentoAtivoId) || orcamentos[0],
    [orcamentos, orcamentoAtivoId],
  );

  useEffect(() => {
    salvarOrcamentos(orcamentos);
  }, [orcamentos]);

  useEffect(() => {
    salvarOrcamentoAtivo(orcamentoAtivoId);
  }, [orcamentoAtivoId]);

  function atualizarAtivo(transformar) {
    setOrcamentos((atuais) => atuais.map((orcamento) => (
      orcamento.id === orcamentoAtivo.id
        ? { ...transformar(orcamento), atualizadoEm: new Date().toISOString() }
        : orcamento
    )));
  }

  function adicionarItem(dados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: [
        ...orcamento.itens,
        {
          id: criarId("item"),
          codigo: dados.codigo.trim(),
          descricao: dados.descricao.trim(),
          fonte: dados.fonte.trim(),
          quantidade: numeroSeguro(dados.quantidade),
          unidade: dados.unidade.trim().toUpperCase(),
          unitario: numeroSeguro(dados.unitario),
        },
      ],
    }));
  }

  function removerItem(itemId) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: orcamento.itens.filter((item) => item.id !== itemId),
    }));
  }

  function adicionarOrcamento(dados) {
    const novo = criarOrcamento(dados);
    setOrcamentos((atuais) => [...atuais, novo]);
    setOrcamentoAtivoId(novo.id);
  }

  function criarRevisao() {
    atualizarAtivo((orcamento) => {
      const numeroAtual = Number(orcamento.revisao.replace(/\D/g, "")) || 0;
      const codigo = `R${String(numeroAtual + 1).padStart(2, "0")}`;
      const atual = orcamento.revisoes[0];
      const novaRevisao = {
        id: criarId("rev"),
        codigo,
        status: "Em elaboração",
        base: orcamento.base,
        total: atual?.total || 0,
        variacao: 0,
        autor: "Usuário atual",
        publicada: false,
        data: new Date().toISOString(),
      };

      return {
        ...orcamento,
        revisao: codigo,
        status: "Em elaboração",
        revisoes: [novaRevisao, ...orcamento.revisoes],
      };
    });
  }

  function restaurarDados() {
    const iniciais = restaurarOrcamentos();
    setOrcamentos(iniciais);
    setOrcamentoAtivoId(iniciais[0]?.id || "");
  }

  return {
    orcamentos,
    orcamentoAtivo,
    orcamentoAtivoId,
    setOrcamentoAtivoId,
    adicionarItem,
    removerItem,
    adicionarOrcamento,
    criarRevisao,
    restaurarDados,
  };
}
