import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../errors.js";

export function gerarCredencialPortal() {
  const token=randomBytes(24).toString("base64url");
  return { token, tokenHash:createHash("sha256").update(token).digest("hex"), tokenPrefixo:token.slice(0,8) };
}

export function validarEscopoPortal(tipo, escopo={}) {
  const permitidos={cliente:["clienteId","siteIds","obraIds","documentoIds"],fornecedor:["fornecedorId","processoIds","contratoIds","documentoIds"],fiscalizacao:["obraIds","contratoIds","medicaoIds","documentoIds"]};
  if (!permitidos[tipo]) throw new ApiError(422,"TIPO_PORTAL_INVALIDO","Informe um tipo de portal válido.");
  const invalidos=Object.keys(escopo).filter(chave=>!permitidos[tipo].includes(chave));
  if (invalidos.length) throw new ApiError(422,"ESCOPO_PORTAL_INVALIDO","O escopo contém campos incompatíveis com o tipo de portal.",invalidos);
  return escopo;
}
