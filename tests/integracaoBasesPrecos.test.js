import test from "node:test";
import assert from "node:assert/strict";
import {
  nomeArquivoRemoto,
  validarUrlIntegracao,
} from "../src/services/integracaoBasesPrecos.js";

test("aceita somente endereço direto e seguro de uma publicação", () => {
  assert.equal(
    validarUrlIntegracao("https://exemplo.gov.br/base/SINAPI-2026-07.zip"),
    "https://exemplo.gov.br/base/SINAPI-2026-07.zip",
  );
  assert.throws(
    () => validarUrlIntegracao("http://exemplo.gov.br/base.zip"),
    /HTTPS/,
  );
  assert.throws(
    () => validarUrlIntegracao("https://exemplo.gov.br/download"),
    /ZIP, XLSX, XLS ou CSV/,
  );
});

test("obtém o nome do arquivo remoto pelo cabeçalho ou pela URL", () => {
  assert.equal(
    nomeArquivoRemoto(
      "https://exemplo.gov.br/base.zip",
      "attachment; filename*=UTF-8''SINAPI%202026-07.zip",
    ),
    "SINAPI 2026-07.zip",
  );
  assert.equal(
    nomeArquivoRemoto("https://exemplo.gov.br/ORSE-07-2026.xlsx"),
    "ORSE-07-2026.xlsx",
  );
});
