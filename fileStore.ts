import { OpfsFileStore } from "./OpfsFileStore";
import { IndexedDbBlobFileStore } from "./IndexedDbBlobFileStore";
import type { FileBackend, LocalFileStore } from "./LocalFileStore";
const fallback = new IndexedDbBlobFileStore();
let selected: Promise<LocalFileStore> | undefined;
export async function detectFileStore(
  storage: Pick<StorageManager, "getDirectory"> | undefined = navigator.storage,
): Promise<LocalFileStore> {
  if (!storage?.getDirectory) return fallback;
  try {
    const store = new OpfsFileStore(await storage.getDirectory());
    const path = `prompt-tree/probe-${crypto.randomUUID()}`;
    await store.write(path, new Blob(["probe"]));
    await store.remove(path);
    return store;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") throw e;
    return fallback;
  }
}
export function fileStore(backend?: FileBackend): Promise<LocalFileStore> {
  if (backend === "idb") return Promise.resolve(fallback);
  if (backend === "opfs")
    return navigator.storage
      .getDirectory()
      .then((root) => new OpfsFileStore(root));
  return (selected ??= detectFileStore());
}
