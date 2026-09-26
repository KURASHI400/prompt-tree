import { purgeDeletion } from "./deletionService";
import { deleteDB } from "idb";
import { activeWorkspace, closeDatabase, database } from "./db";
import { DATABASE_NAME, RESEARCH_STORES } from "./schema";
import { fileStore } from "./files/fileStore";
import { clearImageUrls } from "./files/objectUrlCache";
let running: Promise<void> | undefined;
export function cleanup(now = Date.now()): Promise<void> {
  if (!running)
    running = runCleanup(now).finally(() => {
      running = undefined;
    });
  return running;
}
async function runCleanup(now: number) {
  const db = await database(),
    active = await activeWorkspace(),
    queue = await db.getAll("cleanupQueue");
  for (const item of queue) {
    const job = item.value as { kind: string; at: number };
    if (now < job.at) continue;
    if (job.kind === "card" || job.kind === "series") {
      await purgeDeletion(item, now);
      continue;
    }
    if (job.kind === "workspace") {
      if (item.workspace_id === active) continue;
      const images = await db.getAllFromIndex(
        "images",
        "workspace",
        item.workspace_id,
      );
      for (const i of images) {
        const files = await fileStore(i.backend);
        await files.remove(i.original_key);
        if (i.thumbnail_key) await files.remove(i.thumbnail_key);
      }
      // Remove the isolated staged OPFS directory, including files left before metadata commit.
      try {
        const root = await navigator.storage.getDirectory();
        const dir = await (
          await root.getDirectoryHandle("prompt-tree")
        ).getDirectoryHandle("workspaces");
        await dir.removeEntry(item.workspace_id, { recursive: true });
      } catch (e) {
        if (
          e instanceof DOMException &&
          !["NotFoundError", "NotSupportedError"].includes(e.name)
        )
          throw e;
      }
      const tx = db.transaction([...RESEARCH_STORES, "files"], "readwrite");
      for (const store of RESEARCH_STORES)
        for (const row of await tx
          .objectStore(store)
          .index("workspace")
          .getAll(item.workspace_id))
          await tx.objectStore(store).delete(row.id);
      let cursor = await tx.objectStore("files").openCursor();
      while (cursor) {
        if (
          cursor.key.startsWith(
            "prompt-tree/workspaces/" + item.workspace_id + "/",
          )
        )
          await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } else {
      const c =
        job.kind === "card" ? await db.get("cards", item.id) : undefined;
      if (c && !c.deleted_at) {
        await db.delete("cleanupQueue", item.id);
        continue;
      }
      const images =
        job.kind === "card"
          ? await db.getAllFromIndex("images", "card", [
              item.workspace_id,
              item.id,
            ])
          : [await db.get("images", item.id)].filter((i) => !!i);
      for (const i of images) {
        if (!i) continue;
        if (
          job.kind === "image" &&
          !i.deleted_at &&
          i.upload_status === "ready"
        )
          continue;
        const store = await fileStore(i.backend);
        await store.remove(i.original_key);
        if (i.thumbnail_key) await store.remove(i.thumbnail_key);
        await db.delete("images", i.id);
      }
      await db.delete("cleanupQueue", item.id);
    }
  }
}
export async function resetLocalData() {
  clearImageUrls();
  if (navigator.storage?.getDirectory) {
    const hasOpfs = (await (await database()).getAll("images")).some(
      (i) => i.backend === "opfs",
    );
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry("prompt-tree", { recursive: true });
    } catch (e) {
      if (!(
        e instanceof DOMException &&
        (e.name === "NotFoundError" ||
          (!hasOpfs && ["UnknownError", "NotSupportedError"].includes(e.name)))
      ))
        throw e;
    }
  }
  await closeDatabase();
  await deleteDB(DATABASE_NAME);
  await deleteDB("prompt-tree-cache");
  sessionStorage.clear();
  for (const key of ["provider", "pt-account"]) localStorage.removeItem(key);
  for (const key of await caches.keys())
    if (key.startsWith("prompt-tree")) await caches.delete(key);
}
