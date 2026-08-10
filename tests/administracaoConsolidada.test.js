import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PERMISSOES_PADRAO_POR_PERFIL } from "../shared/platform.js";

const arquivo = new URL("../src/pages/Administracao.jsx", import.meta.url);

test("Administração expõe somente áreas operacionais na navegação", async () => {
  const codigo = await readFile(arquivo, "utf8");
  const abas = codigo.match(/const ABAS_ADMIN = \[([\s\S]*?)\];/)?.[1] || "";
  for (const aba of ["Visão operacional", "Módulos e produto", "Perfis e permissões", "Integrações", "Bases de preços", "Operação técnica", "Auditoria"]) assert.match(abas, new RegExp(aba));
  for (const demonstracao of ["Empresas e equipes", "Fontes de dados", "Cadastros mestres", "Parâmetros"]) assert.doesNotMatch(abas, new RegExp(demonstracao));
  assert.match(codigo, /Nenhum arquivo foi importado por esta ação/);
  assert.match(codigo, /PERMISSOES_PADRAO_POR_PERFIL/);
});

test("perfis administrativos canônicos incluem Patrimônio e Planejamento", () => {
  assert.ok(PERMISSOES_PADRAO_POR_PERFIL.administrador.includes("patrimonio.editar"));
  assert.ok(PERMISSOES_PADRAO_POR_PERFIL.administrador.includes("planejamento.aprovar"));
  assert.ok(PERMISSOES_PADRAO_POR_PERFIL.gestor.includes("planejamento.priorizar"));
  assert.ok(PERMISSOES_PADRAO_POR_PERFIL.aprovador.includes("planejamento.aprovar"));
});
