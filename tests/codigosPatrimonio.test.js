import test from "node:test";
import assert from "node:assert/strict";
import { sugerirCodigoPatrimonial } from "../src/services/codigosPatrimonio.js";

test("sugere códigos patrimoniais sequenciais por nível e unidade pai", () => {
  const unidades = [
    { nivel: "cliente", codigo: "C-01", parentId: "" },
    { nivel: "cliente", codigo: "LEGADO", parentId: "" },
    { nivel: "site", codigo: "S-01", parentId: "cliente-a" },
    { nivel: "site", codigo: "S-02", parentId: "cliente-a" },
    { nivel: "site", codigo: "S-09", parentId: "cliente-b" },
    { nivel: "predio", codigo: "P-01", parentId: "site-a" },
    { nivel: "sala", codigo: "SL-99", parentId: "predio-a" },
  ];

  assert.equal(sugerirCodigoPatrimonial("cliente", "", unidades), "C-02");
  assert.equal(sugerirCodigoPatrimonial("site", "cliente-a", unidades), "S-03");
  assert.equal(sugerirCodigoPatrimonial("site", "cliente-b", unidades), "S-10");
  assert.equal(sugerirCodigoPatrimonial("predio", "site-a", unidades), "P-02");
  assert.equal(sugerirCodigoPatrimonial("sala", "predio-a", unidades), "SL-100");
});

test("inicia a sequência em 01 e ignora níveis desconhecidos", () => {
  assert.equal(sugerirCodigoPatrimonial("cliente", "", []), "C-01");
  assert.equal(sugerirCodigoPatrimonial("site", "cliente-a", []), "S-01");
  assert.equal(sugerirCodigoPatrimonial("predio", "site-a", []), "P-01");
  assert.equal(sugerirCodigoPatrimonial("sala", "predio-a", []), "SL-01");
  assert.equal(sugerirCodigoPatrimonial("desconhecido", "", []), "");
});
