import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { carregarConfiguracaoServidor } from "./config.js";

const { Client } = pg;
const databaseUrlMigracoes = process.env.PRUMO_MIGRATION_DATABASE_URL
  || process.env.PRUMO_DATABASE_URL;
const configuracao = carregarConfiguracaoServidor({
  ...process.env,
  PRUMO_API_STORAGE: "postgres",
  PRUMO_DATABASE_URL: databaseUrlMigracoes,
});
const pasta = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const cliente = new Client({
  connectionString: configuracao.databaseUrl,
  ssl: configuracao.databaseSsl ? { rejectUnauthorized: true } : false,
});

await cliente.connect();
try {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS public.prumo_migrations (
      arquivo text PRIMARY KEY,
      checksum text NOT NULL,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await cliente.query("SELECT pg_advisory_lock(hashtext('prumo-migrations'))");
  const arquivos = (await readdir(pasta)).filter((arquivo) => arquivo.endsWith(".sql")).sort();
  for (const arquivo of arquivos) {
    const sql = await readFile(join(pasta, arquivo), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const anterior = await cliente.query(
      "SELECT checksum FROM public.prumo_migrations WHERE arquivo = $1",
      [arquivo],
    );
    if (anterior.rows[0]) {
      if (anterior.rows[0].checksum !== checksum) {
        throw new Error(`A migração já aplicada ${arquivo} foi alterada.`);
      }
      continue;
    }
    await cliente.query("BEGIN");
    try {
      await cliente.query(sql);
      await cliente.query(
        "INSERT INTO public.prumo_migrations (arquivo, checksum) VALUES ($1, $2)",
        [arquivo, checksum],
      );
      await cliente.query("COMMIT");
      console.info(`Migração aplicada: ${arquivo}`);
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await cliente.query("SELECT pg_advisory_unlock(hashtext('prumo-migrations'))").catch(() => {});
  await cliente.end();
}
