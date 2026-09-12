function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("clubhall-replay-native-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("videos");
    request.onerror = () =>
      reject(request.error ?? new Error("Cannot open video storage"));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("videos", mode);
    const request = run(tx.objectStore("videos"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Cannot save video"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Video storage was interrupted."));
    };
  });
}
const urls = new Map<string, string>();
export async function saveMedia(id: string, uri: string) {
  const blob = await (await fetch(uri)).blob();
  await transaction("readwrite", (store) => store.put(blob, id));
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}
export async function resolveMedia(id: string, _uri: string) {
  void _uri;
  if (urls.has(id)) return urls.get(id)!;
  const blob = (await transaction("readonly", (store) => store.get(id))) as
    | Blob
    | undefined;
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}
export async function removeMedia(id: string, _uri: string) {
  void _uri;
  await transaction("readwrite", (store) => store.delete(id));
  if (urls.has(id)) URL.revokeObjectURL(urls.get(id)!);
  urls.delete(id);
}
