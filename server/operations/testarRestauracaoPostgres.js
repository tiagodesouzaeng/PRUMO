import { resolve } from "node:path";
import { readdir, stat } from "node:fs/promises";
import {
  ambientePostgres,
  executarFerramenta,
  localizarFerramentaPostgres,
} from "./postgresTools.js";

const origem = process.env.PRUMO_MIGRATION_DATABASE_URL || process.env.PRUMO_DATABASE_URL;
const destino = process.env.PRUMO_RESTORE_TEST_DATABASE_URL;
if (!origem || !destino) {
  throw new Error("Configure PRUMO_MIGRATION_DATABASE_URL e PRUMO_RESTORE_TEST_DATABASE_URL.");
}
const bancoOrigem = new URL(origem).pathname.replace(/^\//, "");
const bancoDestino = new URL(destino).pathname.replace(/^\//, "");
if (bancoDestino === bancoOrigem || !/(_restore_test|_restauracao_teste)$/i.test(bancoDestino)) {
  throw new Error("O destino deve ser um banco separado terminado em _restore_test ou _restauracao_teste.");
}
if (process.env.PRUMO_RESTORE_TEST_CONFIRM !== "RECRIAR_BANCO_DE_TESTE") {
  throw new Error("Defina PRUMO_RESTORE_TEST_CONFIRM=RECRIAR_BANCO_DE_TESTE para autorizar a limpeza do banco de teste.");
}

const pasta = resolve(process.env.PRUMO_BACKUP_DIR || "outputs/backups");
const informado = String(process.env.PRUMO_BACKUP_FILE || "").trim();
const arquivo = informado || (await Promise.all((await readdir(pasta))
  .filter((item) => item.endsWith(".backup"))
  .map(async (item) => {
    const caminho = resolve(pasta, item);
    return { caminho, alteradoEm: (await stat(caminho)).mtimeMs };
  })))
  .sort((a, b) => b.alteradoEm - a.alteradoEm)
  .map(({ caminho }) => caminho)[0];
if (!arquivo) throw new Error("Nenhum backup foi localizado para restauração.");

const pgRestore = localizarFerramentaPostgres("pg_restore");
const psql = localizarFerramentaPostgres("psql");
if (!pgRestore || !psql) throw new Error("pg_restore e psql são obrigatórios.");
await executarFerramenta(pgRestore, [
  "--dbname",
  bancoDestino,
  "--clean",
  "--if-exists",
  "--no-owner",
  "--no-acl",
  "--exit-on-error",
  arquivo,
], {
  env: ambientePostgres(destino),
  nome: "pg_restore",
});
const verificacao = await executarFerramenta(psql, [
  "-X",
  "-w",
  "-At",
  "-c",
  "select count(*) from public.prumo_migrations; select to_regclass('app.audit_events') is not null;",
], {
  env: ambientePostgres(destino),
  silencioso: true,
  nome: "psql",
});
if (!/\n?t\s*$/i.test(verificacao.saida.trim())) {
  throw new Error("A restauração terminou sem a tabela de auditoria esperada.");
}
console.info(`Restauração validada no banco descartável ${bancoDestino}.`);
