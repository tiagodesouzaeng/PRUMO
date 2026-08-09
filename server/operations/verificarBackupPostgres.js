import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { executarFerramenta, localizarFerramentaPostgres } from "./postgresTools.js";

const pasta = resolve(process.env.PRUMO_BACKUP_DIR || "outputs/backups");
const informado = String(process.env.PRUMO_BACKUP_FILE || "").trim();
const arquivos = informado
  ? [resolve(informado)]
  : (await Promise.all((await readdir(pasta))
    .filter((arquivo) => arquivo.endsWith(".backup"))
    .map(async (arquivo) => {
      const caminho = join(pasta, arquivo);
      return { caminho, alteradoEm: (await stat(caminho)).mtimeMs };
    })))
    .sort((a, b) => b.alteradoEm - a.alteradoEm)
    .map(({ caminho }) => caminho);
const arquivo = arquivos[0];
if (!arquivo) throw new Error("Nenhum backup foi localizado para verificação.");

const pgRestore = localizarFerramentaPostgres("pg_restore");
if (!pgRestore) throw new Error("pg_restore não foi localizado.");
const { saida } = await executarFerramenta(pgRestore, ["--list", arquivo], {
  silencioso: true,
  nome: "pg_restore --list",
});
if (!saida.includes("TABLE") || !saida.includes("SCHEMA - app")) {
  throw new Error("O arquivo não contém a estrutura esperada do PRUMO.");
}

const conteudo = await readFile(arquivo);
const hash = createHash("sha256").update(conteudo).digest("hex");
try {
  const manifesto = JSON.parse(await readFile(`${arquivo}.json`, "utf8"));
  if (manifesto.sha256 !== hash) throw new Error("O SHA-256 diverge do manifesto do backup.");
} catch (erro) {
  if (erro.code !== "ENOENT") throw erro;
}
console.info(`Backup estruturalmente válido: ${arquivo}`);
console.info(`SHA-256 ${hash}`);
