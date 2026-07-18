// Crash-proof recording: every audio slice is appended to IndexedDB while
// recording, so a tab crash / dead battery / accidental reload costs at most
// a fraction of a second — not the whole lecture. The copy is deleted only
// after the recording is successfully uploaded.

const DB_NAME = "flux-recording";
const STORE = "chunks";
const META_KEY = "flux_rec_meta";

export type RecMeta = {
  title: string;
  courseId: string;
  courseName: string;
  startedAt: number;
  mime: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out ? (out as IDBRequest<T>).result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Begins a protected session: clears any previous one, stores metadata. */
export async function recSafeStart(meta: RecMeta): Promise<void> {
  try {
    await withStore("readwrite", s => { s.clear(); });
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* private mode / quota — recording continues unprotected */ }
}

/** Appends one recorder slice. Fire-and-forget; never blocks the recorder. */
export function recSafeAppend(chunk: Blob): void {
  if (!chunk || chunk.size === 0) return;
  withStore("readwrite", s => { s.add(chunk); }).catch(() => { /* best effort */ });
}

/** Drops the protected copy (after successful upload, or user discard). */
export async function recSafeClear(): Promise<void> {
  try {
    await withStore("readwrite", s => { s.clear(); });
    localStorage.removeItem(META_KEY);
  } catch { /* ignore */ }
}

/** Returns an interrupted recording, if one survived, as a playable blob. */
export async function recSafeLoad(): Promise<{ meta: RecMeta; blob: Blob } | null> {
  try {
    const rawMeta = localStorage.getItem(META_KEY);
    if (!rawMeta) return null;
    const meta = JSON.parse(rawMeta) as RecMeta;
    const parts = (await withStore<Blob[]>("readonly", s => s.getAll())) as Blob[] | undefined;
    if (!parts?.length) return null;
    const blob = new Blob(parts, { type: meta.mime || "audio/webm" });
    if (blob.size < 50_000) return null; // under ~a few seconds — not worth recovering
    return { meta, blob };
  } catch {
    return null;
  }
}
