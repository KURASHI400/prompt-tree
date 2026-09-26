import { activeWorkspace, database } from "../db";
import type { LocalImage } from "../schema";
import { fileStore } from "../files/fileStore";
import { imagePath, type LocalFileStore } from "../files/LocalFileStore";
import { preflight, storageError } from "../storage/quota";
import { requireRecord, version, write } from "./common";
import { MAX_IMAGE_BYTES } from "../../config";
export interface ImageQuery {
  series?: string;
  type?: string;
  sort?: string;
  cursor?: string | null;
  limit?: number;
}
export const imageRepository = {
  async pending() {
    const w = await activeWorkspace();
    return (
      await (await database()).getAllFromIndex("images", "workspace", w)
    ).filter((i) => !i.deleted_at && i.upload_status !== "ready");
  },
  async recover(id: string, file?: File) {
    const i = await this.get(id);
    const original =
      file ??
      new File(
        [await (await fileStore(i.backend)).read(i.original_key)],
        i.original_filename,
        { type: i.mime_type },
      );
    if (original.size !== i.file_size)
      throw new Error("元の画像とサイズが一致しません");
    await this.import(i.card_id, original);
    await this.discard(id);
  },
  async discard(id: string) {
    await write(async (tx, w) => {
      const i = requireRecord(await tx.objectStore("images").get(id), w);
      if (i.upload_status === "ready") throw new Error("保存済み画像です");
      await tx.objectStore("images").put({ ...i, deleted_at: Date.now() });
      await tx.objectStore("cleanupQueue").put({
        id,
        workspace_id: w,
        value: { kind: "image", at: Date.now() + 3600000 },
      });
    });
  },
  async get(id: string) {
    const w = await activeWorkspace(),
      db = await database();
    return requireRecord(await db.get("images", id), w);
  },
  async original(id: string) {
    const i = await this.get(id);
    return (await fileStore(i.backend)).read(i.original_key);
  },
  async thumbnail(id: string) {
    const i = await this.get(id);
    if (!i.thumbnail_key) throw new Error("サムネイル未作成");
    return (await fileStore(i.backend)).read(i.thumbnail_key);
  },
  async import(
    card: string,
    file: File,
    dependencies?: {
      store?: LocalFileStore;
      thumbnail?: (
        file: Blob,
      ) => Promise<{ blob: Blob; width: number; height: number }>;
      preflight?: typeof preflight;
    },
  ) {
    const mime =
      file.type || (/\.hei[cf]$/i.test(file.name) ? "image/heic" : "");
    if (file.size > MAX_IMAGE_BYTES || !file.size)
      throw new Error("画像のサイズを確認してください");
    if (
      ![
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/heic",
        "image/heif",
      ].includes(mime)
    )
      throw new Error("対応する画像を選択してください");
    const w = await activeWorkspace(),
      db = await database(),
      c = requireRecord(await db.get("cards", card), w);
    let i: LocalImage | undefined;
    let pendingStored = false;
    try {
      await (dependencies?.preflight ?? preflight)(file.size + 1024 * 1024);
      const store = dependencies?.store ?? (await fileStore()),
        id = crypto.randomUUID();
      i = {
        id,
        workspace_id: w,
        card_id: card,
        series_id: c.series_id,
        is_root: c.is_root,
        backend: store.backend,
        original_filename: file.name,
        mime_type: mime,
        file_size: file.size,
        width: 0,
        height: 0,
        sort_order: 0,
        is_favorite: 0,
        upload_status: "pending",
        version: 1,
        created_at: Date.now(),
        original_key: imagePath(w, card, id),
        thumbnail_key: null,
      };
      const pending = i;
      await write(async (tx, workspace) => {
        if (workspace !== w) throw new Error("保存領域が変更されました");
        requireRecord(await tx.objectStore("cards").get(card), w);
        await tx.objectStore("images").put(pending);
      });
      pendingStored = true;
      await store.write(i.original_key, file);
      if ((await store.read(i.original_key)).size !== file.size)
        throw new Error("Originalの保存サイズが一致しません");
      const makeThumbnail =
        dependencies?.thumbnail ?? (await import("../../images")).thumbnail;
      let thumb: Awaited<ReturnType<typeof makeThumbnail>> | undefined;
      try {
        thumb = await makeThumbnail(file);
      } catch {
        /* Original remains intact when decoder is unavailable. */
      }
      if (thumb) {
        const path = imagePath(w, card, id, true);
        await store.write(path, thumb.blob);
        i = {
          ...i,
          thumbnail_key: path,
          width: thumb.width,
          height: thumb.height,
        };
      }
      const ready = { ...i, upload_status: "ready" };
      await write(async (tx, workspace) => {
        if (workspace !== w) throw new Error("保存領域が変更されました");
        const current = requireRecord(
          await tx.objectStore("cards").get(card),
          w,
        );
        const images = await tx
          .objectStore("images")
          .index("card")
          .getAll([w, card]);
        await tx.objectStore("images").put({
          ...ready,
          series_id: current.series_id,
          sort_order:
            Math.max(
              -1,
              ...images.filter((x) => x.id !== id).map((x) => x.sort_order),
            ) + 1,
        });
        await tx.objectStore("cards").put({
          ...current,
          status: "ready",
          cover_image_id: current.cover_image_id ?? id,
          version: current.version + 1,
        });
      });
      return id;
    } catch (error) {
      if (i && pendingStored) {
        await db.put("images", { ...i, upload_status: "failed" });
        await db.put("cleanupQueue", {
          id: i.id,
          workspace_id: w,
          value: { kind: "image", at: Date.now() + 3600000 },
        });
      }
      throw storageError(error);
    }
  },
  async retryThumbnail(id: string, blob: Blob) {
    const i = await this.get(id),
      path = imagePath(i.workspace_id, i.card_id, id, true);
    await preflight(blob.size);
    await (await fileStore(i.backend)).write(path, blob);
    await write(async (tx, w) => {
      const current = requireRecord(await tx.objectStore("images").get(id), w);
      await tx.objectStore("images").put({ ...current, thumbnail_key: path });
    });
  },
  favorite(
    id: string,
    input: { is_favorite: boolean; expectedVersion?: number },
  ) {
    return write(async (tx, w) => {
      const i = requireRecord(await tx.objectStore("images").get(id), w);
      version(i, input.expectedVersion);
      await tx.objectStore("images").put({
        ...i,
        is_favorite: Number(input.is_favorite),
        version: i.version + 1,
      });
    });
  },
  remove(id: string) {
    return this.bulkDelete({ ids: [id] });
  },
  restore(ids: string[]) {
    return write(async (tx, w) => {
      for (const id of ids) {
        const i = requireRecord(
          await tx.objectStore("images").get(id),
          w,
          true,
        );
        requireRecord(await tx.objectStore("cards").get(i.card_id), w);
        if (!i.deleted_at || !(await tx.objectStore("cleanupQueue").get(id)))
          throw new Error("画像を復元できる期間が終了しました");
        await tx
          .objectStore("images")
          .put({ ...i, deleted_at: null, version: i.version + 1 });
        await tx.objectStore("cleanupQueue").delete(id);
      }
    });
  },
  bulkDelete(input: { ids: string[] }) {
    return write(async (tx, w) => {
      const ids = new Set(input.ids),
        images = [];
      for (const id of ids)
        images.push(requireRecord(await tx.objectStore("images").get(id), w));
      for (const card of new Set(images.map((i) => i.card_id))) {
        const c = requireRecord(await tx.objectStore("cards").get(card), w);
        const remaining = (
          await tx.objectStore("images").index("card").getAll([w, card])
        ).filter(
          (i) => !i.deleted_at && i.upload_status === "ready" && !ids.has(i.id),
        );
        if (!remaining.length) throw new Error("最後の画像は削除できません");
        await tx.objectStore("cards").put({
          ...c,
          cover_image_id: ids.has(c.cover_image_id ?? "")
            ? remaining[0].id
            : c.cover_image_id,
          version: c.version + 1,
        });
      }
      for (const i of images) {
        await tx.objectStore("images").put({ ...i, deleted_at: Date.now() });
        await tx.objectStore("cleanupQueue").put({
          id: i.id,
          workspace_id: w,
          value: { kind: "image", at: Date.now() + 3600000 },
        });
      }
    });
  },
  async list(query: ImageQuery = {}) {
    const w = await activeWorkspace(),
      db = await database(),
      tx = db.transaction(["images", "cards", "series"]),
      limit = Math.min(120, query.limit ?? 120);
    const direction =
      query.sort === "oldest" || query.sort === "series" ? "next" : "prev";
    const index = tx
      .objectStore("images")
      .index(query.sort === "series" || query.series ? "series" : "timeline");
    const after = query.cursor
      ? (JSON.parse(query.cursor) as IDBValidKey[])
      : undefined;
    if (after && (!Array.isArray(after) || after[0] !== w))
      throw new Error("画像ページを再読み込みしてください");
    const groups: (string | undefined)[] =
      query.sort === "series"
        ? (await tx.objectStore("series").index("workspace").getAll(w))
            .filter(
              (s) => !s.deleted_at && (!query.series || query.series === s.id),
            )
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => s.id)
        : [query.series || undefined];
    let groupIndex =
      after && query.sort === "series" ? groups.indexOf(String(after[1])) : 0;
    if (groupIndex < 0) return { items: [], cursor: null };
    const range = (group: string | undefined, resume?: IDBValidKey[]) => {
      const low = group ? [w, group] : [w],
        high = group ? [w, group, []] : [w, []];
      return direction === "next"
        ? IDBKeyRange.bound(resume ?? low, high, !!resume)
        : IDBKeyRange.bound(low, resume ?? high, false, !!resume);
    };
    const items: LocalImage[] = [];
    let lastKey: string | null = null;
    let resume = after;
    // Read bounded metadata batches rather than one IPC round trip per image.
    // advance() finds a batch boundary in either direction on older WebKit too.
    for (; groupIndex < groups.length; groupIndex++, resume = undefined) {
      const group = groups[groupIndex];
      while (true) {
        const cursor = await index.openCursor(range(group, resume), direction);
        if (!cursor) break;
        const firstKey = cursor.key;
        const boundary = await cursor.advance(255);
        const endKey = boundary?.key;
        const low = group ? [w, group] : [w],
          high = group ? [w, group, []] : [w, []];
        const batchRange =
          direction === "prev"
            ? IDBKeyRange.bound(endKey ?? low, firstKey)
            : IDBKeyRange.bound(firstKey, endKey ?? high);
        const batch = await index.getAll(batchRange);
        if (direction === "prev") batch.reverse();
        const candidates = batch.filter(
          (i) =>
            !i.deleted_at &&
            i.upload_status === "ready" &&
            (!query.series || i.series_id === query.series) &&
            (!(query.type === "favorite") || !!i.is_favorite) &&
            (!(query.type === "root") || i.is_root) &&
            (!(query.type === "child") || !i.is_root),
        );
        const cards = new Map(
          await Promise.all(
            [...new Set(candidates.map((i) => i.card_id))].map(
              async (id) =>
                [id, await tx.objectStore("cards").get(id)] as const,
            ),
          ),
        );
        for (const i of candidates) {
          const c = cards.get(i.card_id);
          if (c && !c.deleted_at && c.status === "ready") {
            if (items.length === limit) {
              return { items, cursor: lastKey };
            }
            items.push(i);
            lastKey = JSON.stringify(
              group ? [w, group, i.created_at, i.id] : [w, i.created_at, i.id],
            );
          }
        }
        if (!endKey) break;
        resume = endKey as IDBValidKey[];
      }
    }
    return { items, cursor: null };
  },
};
