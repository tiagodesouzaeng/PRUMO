import test from "node:test";
import assert from "node:assert/strict";
import {
  carregarOrcamentosCorporativosSeAtivo,
  sincronizarOrcamentosCorporativos,
} from "../src/services/repositorioCorporativo.js";

function criarStorage() {
  const dados = new Map();
  return {
    getItem: (chave) => dados.get(chave) || null,
    setItem: (chave, valor) => dados.set(chave, String(valor)),
  };
}

test("modo corporativo carrega o PostgreSQL preservando o identificador local", async () => {
  const storage = criarStorage();
  const cliente = {
    listarTransicoesRepositorio: async () => [{
      dominioId: "orcamentos",
      modo: "corporativo",
    }],
    listar: async () => [{
      id: "ORC-DB",
      nome: "Obra corporativa",
      versao: 3,
      dados: { idOrigemMigracao: "ORC-LOCAL", itens: [] },
    }],
  };
  const resultado = await carregarOrcamentosCorporativosSeAtivo({ cliente, storage });
  assert.equal(resultado.modo, "corporativo");
  assert.equal(resultado.orcamentos[0].id, "ORC-LOCAL");
  assert.deepEqual(resultado.orcamentos[0]._corporativo, { id: "ORC-DB", versao: 3 });
});

test("modo híbrido sincroniza no servidor e mantém o cache local como proteção", async () => {
  const storage = criarStorage();
  const criados = [];
  const cliente = {
    listarTransicoesRepositorio: async () => [{
      dominioId: "orcamentos",
      modo: "hibrido",
    }],
    criar: async (_recurso, dados) => {
      criados.push(dados);
      return { id: "ORC-DB-1", versao: 1 };
    },
    atualizar: async () => {
      throw new Error("não deveria atualizar na primeira sincronização");
    },
  };
  const resultado = await sincronizarOrcamentosCorporativos(
    [{ id: "ORC-1", nome: "Obra local", itens: [] }],
    { cliente, storage },
  );
  assert.equal(resultado.modo, "hibrido");
  assert.equal(resultado.sincronizados, 1);
  assert.equal(criados[0].nome, "Obra local");
});
