const DB_NAME = "prumo-sinapi";
const DB_VERSION = 1;
const BASE_STORE = "bases";
const REFERENCE_STORE = "referencias";

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
    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains(BASE_STORE)) {
        banco.createObjectStore(BASE_STORE, { keyPath: "id" });
      }
      if (!banco.objectStoreNames.contains(REFERENCE_STORE)) {
        const referencias = banco.createObjectStore(REFERENCE_STORE, { keyPath: "uid" });
        referencias.createIndex("baseId", "baseId", { unique: false });
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

function removerReferenciasDaBase(store, baseId) {
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

export async function listarBasesSinapi() {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const requisicao = banco.transaction(BASE_STORE, "readonly").objectStore(BASE_STORE).getAll();
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(
      requisicao.result.sort((a, b) => b.referencia.localeCompare(a.referencia)),
    );
  });
}

export async function salvarBaseSinapi(base, referencias) {
  const banco = await abrirBanco();
  const transacao = banco.transaction([BASE_STORE, REFERENCE_STORE], "readwrite");
  const baseStore = transacao.objectStore(BASE_STORE);
  const referenceStore = transacao.objectStore(REFERENCE_STORE);

  await removerReferenciasDaBase(referenceStore, base.id);
  baseStore.put(base);
  referencias.forEach((referencia) => referenceStore.put({
    ...referencia,
    baseId: base.id,
    uid: `${base.id}:${referencia.tipo}:${referencia.codigo}`,
  }));
  await concluirTransacao(transacao);
  return base;
}

export async function carregarReferenciasSinapi(baseId) {
  if (!baseId) return [];
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const requisicao = banco
      .transaction(REFERENCE_STORE, "readonly")
      .objectStore(REFERENCE_STORE)
      .index("baseId")
      .getAll(baseId);
    requisicao.onerror = () => reject(requisicao.error);
    requisicao.onsuccess = () => resolve(requisicao.result);
  });
}

export async function removerBaseSinapi(baseId) {
  const banco = await abrirBanco();
  const transacao = banco.transaction([BASE_STORE, REFERENCE_STORE], "readwrite");
  transacao.objectStore(BASE_STORE).delete(baseId);
  await removerReferenciasDaBase(transacao.objectStore(REFERENCE_STORE), baseId);
  await concluirTransacao(transacao);
}
