import { useEffect, useMemo, useState } from "react";
import {
  calcularDistribuicaoDesconto,
  calcularTotais,
  criarId,
  criarOrcamento,
  numeroSeguro,
  REGRA_CALCULO_ATUAL,
  truncarMoeda,
} from "../domain/orcamento";
import {
  descendentesEap,
  moverItemEap,
  reclassificarEap,
} from "../domain/eap";
import {
  carregarOrcamentoAtivo,
  carregarOrcamentos,
  restaurarOrcamentos,
  salvarOrcamentoAtivo,
  salvarOrcamentos,
} from "../services/orcamentoRepository";

function resumirBasesDosItens(itens) {
  const nomes = [...new Set(
    itens
      .filter((item) => item.tipo !== "grupo")
      .map((item) => item.fonte?.split("·")[0]?.trim())
      .filter(Boolean),
  )];
  return nomes.join(", ") || "Preços manuais";
}

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
        parentId: dados.parentId || "",
        nivelEap: dados.tipo === "grupo" ? (dados.nivelEap || "disciplina") : "",
        fonte: dados.tipo === "grupo" ? "" : dados.fonte.trim(),
        quantidade: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.quantidade),
        unidade: dados.tipo === "grupo" ? "" : dados.unidade.trim().toUpperCase(),
        unitario: dados.tipo === "grupo" ? 0 : numeroSeguro(dados.unitario),
        basePrecoId: dados.tipo === "grupo" ? "" : (dados.basePrecoId || ""),
        referenciaCodigo: dados.tipo === "grupo" ? "" : (dados.referenciaCodigo || ""),
        referenciaTipo: dados.tipo === "grupo" ? "" : (dados.referenciaTipo || "composicao"),
      };
      let itensAtualizados;

      if (itemId) {
        itensAtualizados = orcamento.itens.map((item) => (
          item.id === itemId ? { ...item, ...itemAtualizado } : item
        ));
      } else {
        const novoItem = {
          id: dados.id || criarId(dados.tipo === "grupo" ? "grp" : "item"),
          ...itemAtualizado,
        };
        itensAtualizados = [...orcamento.itens];

        itensAtualizados.push(novoItem);
      }

      return {
        ...orcamento,
        itens: reclassificarEap(itensAtualizados),
      };
    });
  }

  function removerItem(itemId) {
    atualizarAtivo((orcamento) => {
      const removido = orcamento.itens.find((candidato) => candidato.id === itemId);
      const descendentes = removido?.tipo === "grupo"
        ? descendentesEap(orcamento.itens, itemId)
        : new Set();
      return {
        ...orcamento,
        itens: orcamento.itens.filter((item) => (
          item.id !== itemId
          && !descendentes.has(item.id)
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
      const itens = [...orcamento.itens, copia];
      return { ...orcamento, itens: reclassificarEap(itens) };
    });
  }

  function moverItem(itemId, direcao) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: moverItemEap(orcamento.itens, itemId, direcao),
    }));
  }

  function importarItens(itensImportados) {
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: reclassificarEap([
        ...orcamento.itens,
        ...itensImportados.map((item) => ({
          ...item,
          id: criarId(item.tipo === "grupo" ? "grp" : "item"),
        })),
      ]),
    }));
  }

  function atualizarBdi(bdiComponentes) {
    atualizarAtivo((orcamento) => ({ ...orcamento, bdiComponentes }));
  }

  function atualizarDescontoGlobal(dados) {
    atualizarAtivo((orcamento) => {
      const agora = new Date().toISOString();
      const usuario = "Usuário atual";
      const removendo = !dados || numeroSeguro(dados.valor) <= 0;
      const configuracao = removendo ? null : {
        tipo: dados.tipo === "valor" ? "valor" : "percentual",
        valor: numeroSeguro(dados.valor),
        atualizadoEm: agora,
        usuario,
        versaoRegra: REGRA_CALCULO_ATUAL,
      };
      const distribuicao = calcularDistribuicaoDesconto({
        ...orcamento,
        descontoGlobal: configuracao,
      });
      const registro = {
        id: criarId("calc"),
        acao: removendo ? "desconto_removido" : "desconto_aplicado",
        tipo: configuracao?.tipo || orcamento.descontoGlobal?.tipo || "",
        valorInformado: configuracao?.valor || 0,
        percentualCalculado: distribuicao.percentual,
        valorDesconto: distribuicao.valorDesconto,
        usuario,
        data: agora,
        versaoRegra: REGRA_CALCULO_ATUAL,
      };

      return {
        ...orcamento,
        descontoGlobal: configuracao,
        historicoCalculo: [registro, ...(orcamento.historicoCalculo || [])],
      };
    });
  }

  function atualizarPrecosBase(referencias, base) {
    const precos = new Map(
      referencias.filter((item) => (
        ["composicao", "insumo"].includes(item.tipo) && !item.semPreco && item.preco > 0
      )).map((item) => [`${item.tipo}:${item.codigo}`, item]),
    );
    const atualizaveis = orcamentoAtivo.itens.filter((item) => {
      const codigo = item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim();
      const tipo = item.referenciaTipo || "composicao";
      const pertenceBase = item.basePrecoId
        ? item.basePrecoId === base.id
        : item.fonte?.toUpperCase().startsWith(base.fonte);
      return item.tipo !== "grupo" && pertenceBase && precos.has(`${tipo}:${codigo}`);
    });

    atualizarAtivo((orcamento) => ({
      ...orcamento,
      itens: orcamento.itens.map((item) => {
        const codigo = item.referenciaCodigo || item.fonte?.split("·").at(-1)?.trim();
        const tipo = item.referenciaTipo || "composicao";
        const pertenceBase = item.basePrecoId
          ? item.basePrecoId === base.id
          : item.fonte?.toUpperCase().startsWith(base.fonte);
        const referencia = pertenceBase ? precos.get(`${tipo}:${codigo}`) : null;
        return referencia ? {
          ...item,
          fonte: `${base.titulo} · ${referencia.codigo}`,
          basePrecoId: base.id,
          referenciaCodigo: referencia.codigo,
          referenciaTipo: referencia.tipo,
          unidade: referencia.unidade || item.unidade,
          unitario: referencia.preco,
        } : item;
      }),
      composicoes: orcamento.composicoes.map((composicao) => {
        const componentes = (composicao.componentes || []).map((componente) => {
          if (componente.basePrecoId !== base.id) return componente;
          const referencia = precos.get(`${componente.referenciaTipo}:${componente.referenciaCodigo}`);
          return referencia ? { ...componente, preco: referencia.preco } : componente;
        });
        const possuiComponentes = componentes.length > 0;
        return {
          ...composicao,
          componentes,
          custoUnitario: possuiComponentes
            ? truncarMoeda(componentes.reduce(
              (total, componente) => (
                total + numeroSeguro(componente.coeficiente) * numeroSeguro(componente.preco)
              ),
              0,
            ))
            : composicao.custoUnitario,
        };
      }),
    }));
    return atualizaveis.length;
  }

  function adicionarComposicao(dados) {
    const componentes = (dados.componentes || []).map((componente) => ({
      ...componente,
      id: componente.id || criarId("comp-item"),
      coeficiente: numeroSeguro(componente.coeficiente),
      preco: numeroSeguro(componente.preco),
    }));
    const custoCalculado = componentes.length
      ? truncarMoeda(componentes.reduce(
        (total, componente) => (
          total + numeroSeguro(componente.coeficiente) * numeroSeguro(componente.preco)
        ),
        0,
      ))
      : numeroSeguro(dados.custoUnitario);
    atualizarAtivo((orcamento) => ({
      ...orcamento,
      composicoes: [
        ...orcamento.composicoes,
        {
          id: criarId("comp"),
          codigo: dados.codigo.trim().toUpperCase(),
          descricao: dados.descricao.trim(),
          unidade: dados.unidade.trim().toUpperCase(),
          custoUnitario: custoCalculado,
          componentes,
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
        bases: resumirBasesDosItens(orcamento.itens),
        total: totais.precoTotal,
        variacao: 0,
        autor: "Usuário atual",
        publicada: false,
        data: new Date().toISOString(),
        snapshot: structuredClone(orcamento.itens),
        calculo: {
          descontoGlobal: structuredClone(orcamento.descontoGlobal),
          versaoRegra: REGRA_CALCULO_ATUAL,
          totais,
        },
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
    atualizarDescontoGlobal,
    atualizarPrecosBase,
    adicionarComposicao,
    removerComposicao,
    adicionarOrcamento,
    criarRevisao,
    restaurarDados,
  };
}
