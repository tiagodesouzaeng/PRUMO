const DB_NAME = "prumo-bases-precos";
const DB_VERSION = 3;
const BASE_STORE = "bases";
const PACKAGE_STORE = "pacotes";
const COMPOSITION_STORE = "composicoes_analiticas";

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

export async function listarBasesPrecos() {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const requisicao = banco.transaction(BASE_STORE, "readonly").objectStore(BASE_STORE).getAll();
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(
      requisicao.result.sort((a, b) => b.referencia.localeCompare(a.referencia)),
    );
  });
}

export async function salvarBasePrecos(base, referencias) {
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, PACKAGE_STORE, COMPOSITION_STORE],
    "readwrite",
  );
  const baseStore = transacao.objectStore(BASE_STORE);
  const packageStore = transacao.objectStore(PACKAGE_STORE);
  const compositionStore = transacao.objectStore(COMPOSITION_STORE);

  await Promise.all([
    removerPorBase(packageStore, base.id),
    removerPorBase(compositionStore, base.id),
  ]);
  baseStore.put(base);

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

export async function carregarItensComposicaoBase(baseId, composicaoCodigo) {
  if (!baseId || !composicaoCodigo) return [];
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
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
}

export async function removerBasePrecos(baseId) {
  const banco = await abrirBanco();
  const transacao = banco.transaction(
    [BASE_STORE, PACKAGE_STORE, COMPOSITION_STORE],
    "readwrite",
  );
  transacao.objectStore(BASE_STORE).delete(baseId);
  await Promise.all([
    removerPorBase(transacao.objectStore(PACKAGE_STORE), baseId),
    removerPorBase(transacao.objectStore(COMPOSITION_STORE), baseId),
  ]);
  await concluirTransacao(transacao);
}
