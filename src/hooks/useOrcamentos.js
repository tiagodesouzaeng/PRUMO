import { useEffect, useMemo, useState } from "react";
import {
  calcularTotais,
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

  function salvarItem(dados, itemId = "") {
    atualizarAtivo((orcamento) => {
      const original = orcamento.itens.find((item) => item.id === itemId);
      const codigoNovo = dados.codigo.trim();
      const itemAtualizado = {
        tipo: dados.tipo,
        codigo: codigoNovo,
        descricao: dados.descricao.trim(),
        fonte: dados.tipo === "grupo" ? "" : dados.fonte.trim(),
        quantidade: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.quantidade),
        unidade: dados.tipo === "grupo" ? "" : dados.unidade.trim().toUpperCase(),
        unitario: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.unitario),
      };

      return {
        ...orcamento,
        itens: itemId
          ? orcamento.itens.map((item) => {
            if (item.id === itemId) return { ...item, ...itemAtualizado };
            if (
              original?.tipo === "grupo"
              && item.codigo.startsWith(`${original.codigo}.`)
              && original.codigo !== codigoNovo
            ) {
              return { ...item, codigo: `${codigoNovo}${item.codigo.slice(original.codigo.length)}` };
            }
            return item;
          })
          : [
            ...orcamento.itens,
            {
              id: criarId(dados.tipo === "grupo" ? "grp" : "item"),
              ...itemAtualizado,
            },
          ],
      };
    });
  }

  function removerItem(itemId) {
    atualizarAtivo((orcamento) => {
      const removido = orcamento.itens.find((candidato) => candidato.id === itemId);
      return {
        ...orcamento,
        itens: orcamento.itens.filter((item) => (
          item.id !== itemId
          && !(removido?.tipo === "grupo" && item.codigo.startsWith(`${removido.codigo}.`))
        )),
      };
    });
  }

  function duplicarItem(itemId) {
    atualizarAtivo((orcamento) => {
      const indice = orcamento.itens.findIndex((item) => item.id === itemId);
      if (indice < 0) return orcamento;
      const original = orcamento.itens[indice];
      const copia = {
        ...original,
        id: criarId(original.tipo === "grupo" ? "grp" : "item"),
        codigo: `${original.codigo}-CÓPIA`,
        descricao: `${original.descricao} (cópia)`,
      };
      const itens = [...orcamento.itens];
      itens.splice(indice + 1, 0, copia);
      return { ...orcamento, itens };
    });
  }

  function moverItem(itemId, direcao) {
    atualizarAtivo((orcamento) => {
      const indice = orcamento.itens.findIndex((item) => item.id === itemId);
      const itemAtual = orcamento.itens[indice];
      if (itemAtual?.tipo === "grupo") {
        let fimAtual = indice;
        while (
          fimAtual + 1 < orcamento.itens.length
          && orcamento.itens[fimAtual + 1].tipo !== "grupo"
          && orcamento.itens[fimAtual + 1].codigo.startsWith(`${itemAtual.codigo}.`)
        ) fimAtual += 1;

        const blocoAtual = orcamento.itens.slice(indice, fimAtual + 1);
        if (direcao < 0 && indice > 0) {
          let inicioAnterior = indice - 1;
          while (inicioAnterior > 0 && orcamento.itens[inicioAnterior].tipo !== "grupo") inicioAnterior -= 1;
          return {
            ...orcamento,
            itens: [
              ...orcamento.itens.slice(0, inicioAnterior),
              ...blocoAtual,
              ...orcamento.itens.slice(inicioAnterior, indice),
              ...orcamento.itens.slice(fimAtual + 1),
            ],
          };
        }

        if (direcao > 0 && fimAtual < orcamento.itens.length - 1) {
          const inicioProximo = fimAtual + 1;
          let fimProximo = inicioProximo;
          const proximo = orcamento.itens[inicioProximo];
          if (proximo.tipo === "grupo") {
            while (
              fimProximo + 1 < orcamento.itens.length
              && orcamento.itens[fimProximo + 1].tipo !== "grupo"
              && orcamento.itens[fimProximo + 1].codigo.startsWith(`${proximo.codigo}.`)
            ) fimProximo += 1;
          }
          return {
            ...orcamento,
            itens: [
              ...orcamento.itens.slice(0, indice),
              ...orcamento.itens.slice(inicioProximo, fimProximo + 1),
              ...blocoAtual,
              ...orcamento.itens.slice(fimProximo + 1),
            ],
          };
        }
        return orcamento;
      }

      const destino = indice + direcao;
      if (indice < 0 || destino < 0 || destino >= orcamento.itens.length) return orcamento;
      const itens = [...orcamento.itens];
      [itens[indice], itens[destino]] = [itens[destino], itens[indice]];
      return { ...orcamento, itens };
    });
  }

  function importarItens(itensImportados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: [
        ...orcamento.itens,
        ...itensImportados.map((item) => ({
          ...item,
          id: criarId(item.tipo === "grupo" ? "grp" : "item"),
        })),
      ],
    }));
  }

  function atualizarBdi(bdiComponentes) {
    atualizarAtivo((orcamento) => ({ ...orcamento, bdiComponentes }));
  }

  function adicionarComposicao(dados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      composicoes: [
        ...orcamento.composicoes,
        {
          id: criarId("comp"),
          codigo: dados.codigo.trim().toUpperCase(),
          descricao: dados.descricao.trim(),
          unidade: dados.unidade.trim().toUpperCase(),
          custoUnitario: numeroSeguro(dados.custoUnitario),
        },
      ],
    }));
  }

  function removerComposicao(composicaoId) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      composicoes: orcamento.composicoes.filter((item) => item.id !== composicaoId),
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
      const totais = calcularTotais(orcamento);
      const novaRevisao = {
        id: criarId("rev"),
        codigo,
        status: "Em elaboração",
        base: orcamento.base,
        total: totais.precoTotal,
        variacao: 0,
        autor: "Usuário atual",
        publicada: false,
        data: new Date().toISOString(),
        snapshot: structuredClone(orcamento.itens),
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
    salvarItem,
    removerItem,
    duplicarItem,
    moverItem,
    importarItens,
    atualizarBdi,
    adicionarComposicao,
    removerComposicao,
    adicionarOrcamento,
    criarRevisao,
    restaurarDados,
  };
}
