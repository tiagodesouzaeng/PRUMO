import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ambientePostgres, executarFerramenta, localizarFerramentaPostgres } from "./postgresTools.js";

const connectionString = process.env.PRUMO_BACKUP_DATABASE_URL
  || process.env.PRUMO_MIGRATION_DATABASE_URL
  || process.env.PRUMO_DATABASE_URL;
if (!connectionString) throw new Error("Configure PRUMO_BACKUP_DATABASE_URL para gerar o backup.");

const pasta = resolve(process.env.PRUMO_BACKUP_DIR || "outputs/backups");
await mkdir(pasta, { recursive: true });
const instante = new Date();
const sufixo = instante.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const arquivo = join(pasta, `prumo-${sufixo}.backup`);
const pgDump = localizarFerramentaPostgres("pg_dump");
if (!pgDump) throw new Error("pg_dump não foi localizado.");

try {
  await executarFerramenta(pgDump, [
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-acl",
    "--file",
    arquivo,
  ], {
    env: ambientePostgres(connectionString),
    nome: "pg_dump",
  });
} catch (erro) {
  await rename(arquivo, `${arquivo}.partial`).catch(() => {});
  if (/row-level security|row security/i.test(erro.message)) {
    throw new Error("O backup completo exige PRUMO_BACKUP_DATABASE_URL com uma role dedicada capaz de ler tabelas protegidas por FORCE RLS. O arquivo incompleto foi marcado como .partial.");
  }
  throw erro;
}

const conteudo = await readFile(arquivo);
const hash = createHash("sha256").update(conteudo).digest("hex");
const manifesto = {
  contrato: 1,
  criadoEm: instante.toISOString(),
  arquivo: arquivo.split(/[\\/]/).at(-1),
  tamanho: conteudo.length,
  sha256: hash,
  formato: "PostgreSQL custom",
  incluiCredenciais: false,
};
await writeFile(`${arquivo}.json`, `${JSON.stringify(manifesto, null, 2)}\n`, "utf8");
console.info(`Backup criado em ${arquivo}`);
console.info(`SHA-256 ${hash}`);
