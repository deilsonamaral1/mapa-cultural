// Respostas de campo que não puderam ser enviadas (sem internet) ficam guardadas no aparelho (IndexedDB),
// com os arquivos, e são enviadas quando a pessoa abre o formulário de novo com sinal.
export type ItemPendente = { qid: string; name: string; type: string; file?: Blob; path?: string };
export type Pendente = {
  id: string; // = id da resposta
  formId: string;
  envioId?: string; // link pessoal do agente
  titulo: string;
  nome: string;
  contato: string;
  vals: Record<string, string>;
  itens: ItemPendente[];
  salvoEm: number;
};

const DB = "mc-campo";
const STORE = "pendentes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, modo);
    const r = f(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(r.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
}

export const salvarPendente = (p: Pendente) => tx("readwrite", (s) => s.put(p));
export const removerPendente = (id: string) => tx("readwrite", (s) => s.delete(id));
export const listarPendentes = () => tx<Pendente[]>("readonly", (s) => s.getAll());
