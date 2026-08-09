import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export function ambientePostgres(connectionString, ambiente = process.env) {
  const url = new URL(connectionString);
  return {
    ...ambiente,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

export function localizarFerramentaPostgres(nome, ambiente = process.env) {
  const extensao = process.platform === "win32" ? ".exe" : "";
  const binConfigurado = String(ambiente.PRUMO_POSTGRES_BIN || "").trim();
  const candidatos = [
    binConfigurado && join(binConfigurado, `${nome}${extensao}`),
    process.platform === "win32" && join("C:\\Program Files\\PostgreSQL\\18\\bin", `${nome}.exe`),
    `${nome}${extensao}`,
  ].filter(Boolean);
  return candidatos.find((candidato) => candidato === `${nome}${extensao}` || existsSync(candidato));
}

export async function executarFerramenta(comando, argumentos, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const processo = spawn(comando, argumentos, {
      env: opcoes.env || process.env,
      cwd: opcoes.cwd || process.cwd(),
      stdio: opcoes.silencioso ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let saida = "";
    let erro = "";
    if (opcoes.silencioso) {
      processo.stdout.on("data", (parte) => { saida += parte; });
      processo.stderr.on("data", (parte) => { erro += parte; });
    }
    processo.on("error", reject);
    processo.on("close", (codigo) => {
      if (codigo === 0) resolve({ saida, erro });
      else reject(new Error(`${opcoes.nome || comando} terminou com código ${codigo}.${erro ? ` ${erro.trim()}` : ""}`));
    });
  });
}
