import { database } from "../db";
import type { LocalFileStore } from "./LocalFileStore";
export class IndexedDbBlobFileStore implements LocalFileStore {
  readonly backend = "idb" as const;
  private binaryCompatibility = false;
  async write(path: string, blob: Blob) {
    const db = await database();
    if (!this.binaryCompatibility) {
      try {
        await db.put("files", blob, path);
        return;
      } catch (error) {
        // Some WebKit ports expose IDB but cannot serialize Blob backing files.
        // Preserve the same raw bytes once in that store; never encode as text.
        if (
          !(error instanceof DOMException) ||
          !["UnknownError", "DataCloneError"].includes(error.name)
        )
          throw error;
        this.binaryCompatibility = true;
      }
    }
    await db.put(
      "files",
      { bytes: await blob.arrayBuffer(), type: blob.type },
      path,
    );
  }
  async read(path: string) {
    const blob = await (await database()).get("files", path);
    if (!blob) throw new Error("保存画像が見つかりません");
    return blob instanceof Blob
      ? blob
      : new Blob([blob.bytes], { type: blob.type });
  }
  async remove(path: string) {
    await (await database()).delete("files", path);
  }
}
