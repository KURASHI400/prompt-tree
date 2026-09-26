import { database, activeWorkspace } from "../db";
import { fileStore } from "../files/fileStore";
import { imagePath, type LocalFileStore } from "../files/LocalFileStore";
import { preflight, storageError } from "../storage/quota";
import { readPart, validateBackup } from "./validateBackup";
import { sha256 } from "./hash";
import { RESEARCH_STORES } from "../schema";
export async function restoreBackup(
  files: File[],
  progress: (text: string) => void = () => {},
  dependencies?: { store?: LocalFileStore; preflight?: typeof preflight },
) {
  const { manifest, data, parts } = await validateBackup(files),
    old = await activeWorkspace(),
    workspace = crypto.randomUUID(),
    db = await database();
  await (dependencies?.preflight ?? preflight)(
    manifest.total_original_bytes * 1.3,
  );
  const store = dependencies?.store ?? (await fileStore()),
    ids = new Map<string, string>();
  for (const list of Object.values(data))
    for (const r of list) ids.set(r.id, crypto.randomUUID());
  const id = (oldId: string) => {
    const mapped = ids.get(oldId);
    if (!mapped) throw new Error("参照先がありません");
    return mapped;
  };
  await db.put("cleanupQueue", {
    id: workspace,
    workspace_id: workspace,
    value: { kind: "workspace", at: Date.now() + 86400000 },
  });
  try {
    for (const [n, i] of data.images.entries()) {
      progress(`画像を復元 ${n + 1} / ${data.images.length}`);
      const entry = manifest.originals.find((e) => e.id === i.id)!,
        chunks: BlobPart[] = [];
      for (const chunk of entry.chunks) {
        const { zip } = await readPart(parts.get(chunk.part)!);
        const bytes = zip[chunk.path];
        if (!bytes || bytes.length !== chunk.size)
          throw new Error("画像のPartが破損しています");
        chunks.push(bytes as Uint8Array<ArrayBuffer>);
      }
      const original = new Blob(chunks, { type: i.mime_type });
      if (
        original.size !== entry.size ||
        (await sha256(original)) !== entry.sha256
      )
        throw new Error("Originalの検証に失敗しました");
      const path = imagePath(workspace, id(i.card_id), id(i.id));
      await store.write(path, original);
      if ((await store.read(path)).size !== entry.size)
        throw new Error("Original保存が未完了です");
      i.original_key = path;
      i.thumbnail_key = null;
      i.backend = store.backend;
      if (typeof document !== "undefined") {
        let thumb;
        try {
          thumb = await (await import("../../images")).thumbnail(original);
        } catch {
          /* Decoder unavailable; original is retained. */
        }
        if (thumb) {
          i.thumbnail_key = imagePath(workspace, id(i.card_id), id(i.id), true);
          await store.write(i.thumbnail_key, thumb.blob);
        }
      }
    }
    const tx = db.transaction([...RESEARCH_STORES, "control"], "readwrite");
    try {
      if (
        (await tx.objectStore("control").get("active_workspace_id"))?.value !==
        old
      )
        throw new Error("復元中に保存領域が変更されました");
      for (const s of data.series)
        await tx.objectStore("series").put({
          ...s,
          id: id(s.id),
          workspace_id: workspace,
          root_card_id: id(s.root_card_id),
          cover_image_id:
            s.cover_image_id && ids.has(s.cover_image_id)
              ? id(s.cover_image_id)
              : "",
        });
      for (const c of data.cards)
        await tx.objectStore("cards").put({
          ...c,
          id: id(c.id),
          workspace_id: workspace,
          series_id: id(c.series_id),
          cover_image_id: id(c.cover_image_id!),
          images: [],
          status: "ready",
        });
      for (const i of data.images)
        await tx.objectStore("images").put({
          ...i,
          id: id(i.id),
          workspace_id: workspace,
          card_id: id(i.card_id),
          series_id: id(i.series_id!),
          upload_status: "ready",
        });
      for (const e of data.edges)
        await tx.objectStore("edges").put({
          ...e,
          id: id(e.id),
          workspace_id: workspace,
          series_id: id(e.series_id),
          source_card_id: id(e.source_card_id),
          target_card_id: id(e.target_card_id),
        });
      for (const key of ["tags", "cardTags", "settings"] as const)
        for (const row of data[key]) {
          const value =
            key === "cardTags"
              ? {
                  ...(row.value as object),
                  card: id((row.value as { card: string }).card),
                }
              : row.value;
          await tx.objectStore(key).put({
            ...row,
            id: key === "settings" ? workspace + ":research" : id(row.id),
            workspace_id: workspace,
            value,
          });
        }
      await tx.objectStore("cleanupQueue").delete(workspace);
      await tx.objectStore("cleanupQueue").put({
        id: old,
        workspace_id: old,
        value: { kind: "workspace", at: Date.now() + 86400000 },
      });
      await tx
        .objectStore("control")
        .put({ key: "active_workspace_id", value: workspace });
      await tx.objectStore("control").put({
        key: "revision",
        value:
          Number(
            (await tx.objectStore("control").get("revision"))?.value ?? 0,
          ) + 1,
      });
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* completed */
      }
      await tx.done.catch(() => {});
      throw error;
    }
    return workspace;
  } catch (error) {
    throw storageError(error);
  }
}
