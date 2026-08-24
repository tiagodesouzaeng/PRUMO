import test from "node:test";
import assert from "node:assert/strict";
import {
  criarSessaoMemoria,
  obterPerfilAcesso,
  possuiPermissao,
} from "../src/domain/acesso.js";

test("perfis concedem somente as permissões previstas", () => {
  assert.equal(possuiPermissao("administrador", "usuarios.administrar"), true);
  assert.equal(possuiPermissao("orcamentista", "orcamento.editar"), true);
  assert.equal(possuiPermissao("orcamentista", "orcamento.aprovar"), false);
  assert.equal(possuiPermissao("consulta", "orcamento.editar"), false);
  assert.equal(obterPerfilAcesso("inexistente"), null);
});

test("sessão permanece em memória e não serializa o token", () => {
  const gerenciador = criarSessaoMemoria();
  gerenciador.iniciar({
    usuario: { id: "USR-1", nome: "Teste", email: "teste@prumo.local" },
    perfilId: "gestor",
    accessToken: "segredo-transitorio",
  });
  assert.equal(gerenciador.pode("orcamento.aprovar"), true);
  assert.equal(gerenciador.pode("usuarios.administrar"), false);
  assert.equal("accessToken" in gerenciador.serializarIdentidade(), false);
  gerenciador.encerrar();
  assert.equal(gerenciador.obter(), null);
});

test("sessão troca de empresa somente quando existe vínculo ativo", () => {
  const gerenciador = criarSessaoMemoria();
  gerenciador.iniciar({
    usuario: { id: "USR-1", nome: "Teste" },
    perfilId: "consulta",
    tenantId: "EMP-1",
    teamId: "EQ-1",
    vinculos: [
      {
        tenantId: "EMP-1",
        tenantNome: "Empresa 1",
        perfilId: "orcamentista",
        equipes: ["EQ-1"],
      },
      {
        tenantId: "EMP-2",
        tenantNome: "Empresa 2",
        perfilId: "consulta",
        equipes: ["EQ-2"],
      },
    ],
    accessToken: "segredo-transitorio",
  });

  assert.equal(gerenciador.contextoCorporativo().tenantId, "EMP-1");
  assert.equal(gerenciador.pode("orcamento.editar"), true);
  gerenciador.selecionarEmpresa("EMP-2", "EQ-2");
  assert.equal(gerenciador.contextoCorporativo().tenantId, "EMP-2");
  assert.equal(gerenciador.pode("orcamento.editar"), false);
  assert.throws(() => gerenciador.selecionarEmpresa("EMP-3"), /não possui vínculo/);
  assert.equal("accessToken" in gerenciador.serializarIdentidade(), false);
});
