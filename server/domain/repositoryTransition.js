import { createHash } from "node:crypto";
import { serializarDeterministico } from "./migration.js";
import { normalizarOrcamentoParaParidade, ordenarManifestoRepositorio, compararManifestosRepositorio } from "../../shared/repositoryPromotion.js";

const sha256 = (valor) => createHash("sha256").update(serializarDeterministico(valor)).digest("hex");

export function criarManifestoCorporativoOrcamentos(registros = []) {
  const itens = ordenarManifestoRepositorio(registros.map((item) => ({
    id: String(item.dados?.idOrigemMigracao || item.dados?.id || item.id),
    hash: sha256(normalizarOrcamentoParaParidade(item)),
  })));
  return { total: itens.length, hash: sha256(itens), registros: itens };
}

export function validarManifestoLocal(manifesto = {}) {
  const registros = ordenarManifestoRepositorio(manifesto.registros || []);
  if (Number(manifesto.total) !== registros.length) throw new Error("A contagem do manifesto local não confere.");
  if (registros.some((item) => !item.id || !/^[0-9a-f]{64}$/.test(item.hash))) throw new Error("O manifesto local contém identificador ou hash inválido.");
  if (new Set(registros.map((item) => item.id)).size !== registros.length) throw new Error("O manifesto local contém identificadores duplicados.");
  const hash = sha256(registros);
  if (manifesto.hash !== hash) throw new Error("O hash consolidado do manifesto local não confere.");
  return { total: registros.length, hash, registros };
}

export { compararManifestosRepositorio };
