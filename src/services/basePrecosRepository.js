import { aplicarPrecoPorUf } from "../domain/basesPrecos.js";

const DB_NAME = "prumo-bases-precos";
const DB_VERSION = 4;
const BASE_STORE = "bases";
const PACKAGE_STORE = "pacotes";
const COMPOSITION_STORE = "composicoes_analiticas";
const SOURCE_FILE_STORE = "arquivos_fontes";

let bancoPromise;

function abrirBanco() {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("O navegador não oferece armazenamento estruturado."));
  }
  if (bancoPromise) return bancoPromise;

  bancoPromise = new Promise((resolve, reject) => {
    const requisicao = indexedDB.open(DB_NAME, DB_VERSION);
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onupgradeneeded = (evento) => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(BASE_STORE)) {
        banco.createObjectStore(BASE_STORE, { keyPath: "id" });
      }
      if (banco.objectStoreNames.contains("referencias")) {
        banco.deleteObjectStore("referencias");
      }
      if (!banco.objectStoreNames.contains(PACKAGE_STORE)) {
        const pacotes = banco.createObjectStore(PACKAGE_STORE, { keyPath: "uid" });
        pacotes.createIndex("baseId", "baseId", { unique: false });
      }
      if (evento.oldVersion > 0 && evento.oldVersion < 3 && banco.objectStoreNames.contains(COMPOSITION_STORE)) {
        banco.deleteObjectStore(COMPOSITION_STORE);
      }
      if (!banco.objectStoreNames.contains(COMPOSITION_STORE)) {
        const composicoes = banco.createObjectStore(COMPOSITION_STORE, { keyPath: "uid" });
        composicoes.createIndex("baseId", "baseId", { unique: false });
      }
      if (!banco.objectStoreNames.contains(SOURCE_FILE_STORE)) {
        banco.createObjectStore(SOURCE_FILE_STORE, { keyPath: "baseId" });
      }
    };
  });

  return bancoPromise;
}

function concluirTransacao(transacao) {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
    transacao.onabort = () => reject(transacao.error || new Error("Transação cancelada."));
  });
}

function removerPorBase(store, baseId) {
  return new Promise((resolve, reject) => {
    const cursor = store.index("baseId").openCursor(IDBKeyRange.only(baseId));
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      const resultado = cursor.result;
      if (!resultado) {
        resolve();
        return;
      }
      resultado.delete();
      resultado.continue();
    };
  });
}

function agruparPorTipo(referencias) {
  return referencias.reduce((grupos, referencia) => {
    if (referencia.tipo === "composicao_item") return grupos;
    const grupo = grupos.get(referencia.tipo) || [];
    grupo.push(referencia);
    grupos.set(referencia.tipo, grupo);
    return grupos;
  }, new Map());
}

function bucketComposicao(codigo) {
  const hash = String(codigo).split("").reduce(
    (total, caractere) => ((total * 31) + caractere.charCodeAt(0)) >>> 0,
    0,
  );
  return hash % 256;
}

function agruparAnalitico(referencias) {
  return referencias
    .filter((referencia) => referencia.tipo === "composicao_item")
    .reduce((grupos, referencia) => {
      const bucket = bucketComposicao(referencia.composicaoCodigo);
      const grupo = grupos.get(bucket) || [];
      grupo.push(referencia);
      grupos.set(bucket, grupo);
      return grupos;
    }, new Map());
}

export async function listarBasesPrecos({ incluirExcluidas = false } = {}) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const requisicao = banco.transaction(BASE_STORE, "readonly").objectStore(BASE_STORE).getAll();
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(
      requisicao.result
        .filter((base) => incluirExcluidas || base.status !== "excluida")
        .sort((a, b) => b.referencia.localeCompare(a.referencia)),
    );
  });
}

export async function salvarBasePrecos(base, referencias, arquivoFonte = null) {
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, PACKAGE_STORE, COMPOSITION_STORE, SOURCE_FILE_STORE],
    "readwrite",
  );
  const baseStore = transacao.objectStore(BASE_STORE);
  const packageStore = transacao.objectStore(PACKAGE_STORE);
  const compositionStore = transacao.objectStore(COMPOSITION_STORE);
  const sourceFileStore = transacao.objectStore(SOURCE_FILE_STORE);

  await Promise.all([
    removerPorBase(packageStore, base.id),
    removerPorBase(compositionStore, base.id),
  ]);
  baseStore.put({ ...base, status: "ativa", excluidaEm: null, restauradaEm: null });
  if (arquivoFonte) {
    sourceFileStore.put({
      baseId: base.id,
      nomeOriginal: arquivoFonte.name,
      nomeInterno: `${base.id}__${arquivoFonte.name}`,
      tipo: arquivoFonte.type || "application/octet-stream",
      tamanho: arquivoFonte.size,
      arquivo: arquivoFonte,
      status: "ativo",
      armazenadoEm: new Date().toISOString(),
    });
  }

  agruparPorTipo(referencias).forEach((registros, tipo) => {
    packageStore.put({
      uid: `${base.id}:${tipo}`,
      baseId: base.id,
      tipo,
      registros,
    });
  });
  agruparAnalitico(referencias).forEach((itens, bucket) => {
    compositionStore.put({
      uid: `${base.id}:bucket:${bucket}`,
      baseId: base.id,
      bucket,
      itens,
    });
  });

  await concluirTransacao(transacao);
  return base;
}

export async function carregarReferenciasBase(baseId, tipos = ["insumo", "composicao"]) {
  if (!baseId) return [];
  const banco = await abrirBanco();
  const buscarTipo = (tipo) => new Promise((resolve, reject) => {
    const requisicao = banco
      .transaction(PACKAGE_STORE, "readonly")
      .objectStore(PACKAGE_STORE)
      .get(`${baseId}:${tipo}`);
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(requisicao.result?.registros || []);
  });
  return (await Promise.all(tipos.map(buscarTipo))).flat();
}

export async function carregarItensComposicaoBase(baseId, composicaoCodigo, uf = "RS") {
  if (!baseId || !composicaoCodigo) return [];
  const banco = await abrirBanco();
  const itens = await new Promise((resolve, reject) => {
    const requisicao = banco
      .transaction(COMPOSITION_STORE, "readonly")
      .objectStore(COMPOSITION_STORE)
      .get(`${baseId}:bucket:${bucketComposicao(composicaoCodigo)}`);
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(
      (requisicao.result?.itens || []).filter(
        (item) => item.composicaoCodigo === String(composicaoCodigo),
      ),
    );
  });
  const referencias = await carregarReferenciasBase(baseId);
  const catalogo = new Map(
    referencias.map((item) => [`${item.tipo}:${item.codigo}`, item]),
  );
  return itens.map((item) => {
    const referencia = aplicarPrecoPorUf(
      catalogo.get(`${item.itemTipo}:${item.itemCodigo}`),
      uf,
    );
    return {
      ...item,
      descricao: referencia?.descricao || item.descricao,
      unidade: referencia?.unidade || item.unidade,
      preco: referencia?.preco || 0,
      semPreco: referencia?.semPreco ?? true,
      percentualMaoObra: referencia?.percentualMaoObra || 0,
      percentuaisMaoObraPorUf: referencia?.percentuaisMaoObraPorUf || {},
      custoMaoObra: referencia?.custoMaoObra || 0,
      custoMaterial: referencia?.custoMaterial ?? referencia?.preco ?? 0,
      precosPorUf: referencia?.precosPorUf || {},
      referenciaTipo: item.itemTipo,
      referenciaCodigo: item.itemCodigo,
      basePrecoId: baseId,
    };
  });
}

function obterRegistro(store, chave) {
  return new Promise((resolve, reject) => {
    const requisicao = store.get(chave);
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(requisicao.result);
  });
}

export async function arquivarBasePrecos(baseId, usuario = "Administrador atual") {
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, SOURCE_FILE_STORE],
    "readwrite",
  );
  const baseStore = transacao.objectStore(BASE_STORE);
  const fileStore = transacao.objectStore(SOURCE_FILE_STORE);
  const [base, arquivo] = await Promise.all([
    obterRegistro(baseStore, baseId),
    obterRegistro(fileStore, baseId),
  ]);
  if (!base) throw new Error("Base de preços não localizada.");
  const instante = new Date().toISOString();
  baseStore.put({
    ...base,
    status: "excluida",
    excluidaEm: instante,
    excluidaPor: usuario,
  });
  if (arquivo) {
    fileStore.put({
      ...arquivo,
      status: "arquivado",
      nomeInterno: `EXCLUIDO_${instante.replace(/[:.]/g, "-")}__${arquivo.nomeOriginal}`,
      arquivadoEm: instante,
      arquivadoPor: usuario,
    });
  }
  await concluirTransacao(transacao);
}

export async function restaurarBasePrecos(baseId, usuario = "Administrador atual") {
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, SOURCE_FILE_STORE],
    "readwrite",
  );
  const baseStore = transacao.objectStore(BASE_STORE);
  const fileStore = transacao.objectStore(SOURCE_FILE_STORE);
  const [base, arquivo] = await Promise.all([
    obterRegistro(baseStore, baseId),
    obterRegistro(fileStore, baseId),
  ]);
  if (!base) throw new Error("Base arquivada não localizada.");
  const instante = new Date().toISOString();
  baseStore.put({
    ...base,
    status: "ativa",
    restauradaEm: instante,
    restauradaPor: usuario,
  });
  if (arquivo) {
    fileStore.put({
      ...arquivo,
      status: "ativo",
      nomeInterno: `${base.id}__${arquivo.nomeOriginal}`,
      restauradoEm: instante,
      restauradoPor: usuario,
    });
  }
  await concluirTransacao(transacao);
}

export async function excluirBasePrecosDefinitivamente(baseId) {
  if (!baseId) throw new Error("Base de preços não informada.");
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, PACKAGE_STORE, COMPOSITION_STORE, SOURCE_FILE_STORE],
    "readwrite",
  );
  await Promise.all([
    removerPorBase(transacao.objectStore(PACKAGE_STORE), baseId),
    removerPorBase(transacao.objectStore(COMPOSITION_STORE), baseId),
  ]);
  transacao.objectStore(BASE_STORE).delete(baseId);
  transacao.objectStore(SOURCE_FILE_STORE).delete(baseId);
  await concluirTransacao(transacao);
}

export const removerBasePrecos = arquivarBasePrecos;
