import test from "node:test";
import assert from "node:assert/strict";
import {
  criarSolicitacaoAtualizacaoPrecos,
  criarSolicitacaoTrabalho,
  TIPOS_TRABALHO_CORPORATIVO,
} from "../src/domain/trabalhosCorporativos.js";

const contexto = { tenantId: "EMP-1", teamId: "EQ-1", usuarioId: "USR-1" };

test("trabalho assíncrono sempre pertence a empresa e usuário", () => {
  const trabalho = criarSolicitacaoTrabalho({
    tipo: TIPOS_TRABALHO_CORPORATIVO.IMPORTAR_BASE,
    contexto,
  });
  assert.equal(trabalho.tenantId, "EMP-1");
  assert.equal(trabalho.status, "aguardando");
  assert.throws(
    () => criarSolicitacaoTrabalho({
      tipo: TIPOS_TRABALHO_CORPORATIVO.IMPORTAR_BASE,
      contexto: {},
    }),
    /Empresa e usuário/,
  );
});

test("BL-004 nasce como simulação e prepara nova revisão", () => {
  const solicitacao = criarSolicitacaoAtualizacaoPrecos({
    contexto,
    orcamentoId: "ORC-1",
    revisaoOrigem: "R2",
    publicacoesDestino: [{ baseId: "SINAPI", publicacaoId: "2026-06" }],
  });
  assert.equal(solicitacao.parametros.somenteSimulacao, true);
  assert.equal(solicitacao.parametros.atualizarComposicoesPropriasRecursivamente, true);
  assert.equal(solicitacao.parametros.criarNovaRevisaoAoAplicar, true);
  assert.match(solicitacao.idempotencyKey, /ORC-1/);
});
