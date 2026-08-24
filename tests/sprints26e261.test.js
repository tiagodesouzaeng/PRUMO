import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { criarAplicacaoApi } from "../server/app.js";
import { criarAutenticacaoLocal, derivarHashSenhaLocal, extrairTokenBearer } from "../server/auth/localAdmin.js";
import { criarRepositorioMemoria } from "../server/db/memoryRepository.js";
import { carregarConfiguracaoServidor } from "../server/config.js";
import { MODULOS_PLATAFORMA, PERMISSOES_PLATAFORMA } from "../shared/platform.js";

function authTeste() {
  const salt = randomBytes(16).toString("hex");
  return criarAutenticacaoLocal({
    habilitada: true,
    usuario: "admin",
    subject: "local-admin",
    passwordSalt: salt,
    passwordHash: derivarHashSenhaLocal("senha-de-teste", salt),
    sessionSecret: randomBytes(48).toString("base64url"),
    expiresMinutes: 5,
  });
}

test("contingência local emite sessão curta, protege contexto e permite revogação", async (t) => {
  const localAuth = authTeste();
  const repository = criarRepositorioMemoria({
    tenants: [{ id: "EMP-1", nome: "Empresa", status: "ativo" }],
    memberships: [{ tenantId: "EMP-1", subject: "local-admin", perfilId: "administrador", teamIds: ["EQ-1"], status: "ativo" }],
  });
  const app = await criarAplicacaoApi({
    repository,
    localAuth,
    authenticate: async (request) => localAuth.verificarToken(extrairTokenBearer(request.headers.authorization)),
  });
  t.after(() => app.close());

  const invalido = await app.inject({ method: "POST", url: "/auth/local/login", payload: { usuario: "admin", senha: "incorreta" } });
  assert.equal(invalido.statusCode, 401);
  const login = await app.inject({ method: "POST", url: "/auth/local/login", payload: { usuario: "admin", senha: "senha-de-teste" } });
  assert.equal(login.statusCode, 200, login.body);
  assert.equal(login.json().usuario.modo, "contingencia");
  const token = login.json().accessToken;
  const contexto = await app.inject({ method: "GET", url: "/v1/context", headers: { authorization: `Bearer ${token}`, "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1" } });
  assert.equal(contexto.statusCode, 200, contexto.body);
  await app.inject({ method: "POST", url: "/auth/local/logout", headers: { authorization: `Bearer ${token}` } });
  const revogado = await app.inject({ method: "GET", url: "/v1/context", headers: { authorization: `Bearer ${token}`, "x-prumo-tenant-id": "EMP-1", "x-prumo-team-id": "EQ-1" } });
  assert.equal(revogado.statusCode, 401);
});

test("configuração recusa contingência sem material criptográfico", () => {
  assert.throws(() => carregarConfiguracaoServidor({ NODE_ENV: "development", PRUMO_API_STORAGE: "memory", PRUMO_LOCAL_ADMIN_ENABLED: "true" }), /exige hash, salt e segredo/);
});

test("catálogo consolida PPCI e bases sem manter módulos duplicados", () => {
  const ids = MODULOS_PLATAFORMA.map((item) => item.id);
  assert.equal(ids.includes("ppci"), false);
  assert.equal(ids.includes("bases-precos"), false);
  assert.equal(MODULOS_PLATAFORMA.find((item) => item.id === "planejamento").nome, "Solicitações e Investimentos");
  assert.equal(PERMISSOES_PLATAFORMA.find((item) => item.id === "ppci.consultar").moduloId, "regularidade");
  assert.equal(PERMISSOES_PLATAFORMA.find((item) => item.id === "bases.consultar").moduloId, "orcamentos");
  assert.equal(PERMISSOES_PLATAFORMA.find((item) => item.id === "bases.administrar").moduloId, "administracao");
});

test("navegação apresenta os módulos consolidados e login não contém senha embutida", async () => {
  const [nav, login, orcamento, regularidade] = await Promise.all([
    readFile(new URL("../src/components/Navigation/navItems.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Login.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Orcamento.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Regularidade.jsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(nav, /id: "ppci"|id: "alertas"|id: "bases-precos"/);
  assert.match(nav, /Solicitações/);
  assert.match(orcamento, /Bases e composições/);
  assert.match(regularidade, /listarPpcis\(\)/);
  assert.match(regularidade, /PPCI e segurança/);
  assert.doesNotMatch(regularidade, /from "\.\/PPCI"/);
  assert.doesNotMatch(login, /name=["']senha["'][^>]*value=/i);
  assert.match(orcamento, /Base gerenciada pelo PRUMO/);
  assert.doesNotMatch(orcamento, /baseAtiva\.hash\.slice/);
  const repositorioPostgres = await readFile(new URL("../server/db/postgresRepository.js", import.meta.url), "utf8");
  assert.match(repositorioPostgres, /WHERE m\.status='ativo' ORDER BY m\.ordem/);
});
