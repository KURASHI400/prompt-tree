import { activeWorkspace, database } from "../db";
import { createCard, softDelete } from "./cardRepository";
import { requireRecord, write } from "./common";
export const seriesRepository = {
  async list() {
    const w = await activeWorkspace(),
      db = await database(),
      tx = db.transaction(["series", "cards", "images"]);
    const result = [];
    for (const s of await tx
      .objectStore("series")
      .index("workspace")
      .getAll(w)) {
      const c = await tx.objectStore("cards").get(s.root_card_id);
      if (s.deleted_at || !c || c.deleted_at || c.status !== "ready") continue;
      const images = (
        await tx.objectStore("images").index("card").getAll([w, c.id])
      ).filter((i) => !i.deleted_at && i.upload_status === "ready");
      result.push({
        ...s,
        display_id: c.display_id,
        title: c.title,
        cover_image_id: c.cover_image_id!,
        image_count: images.length,
      });
    }
    return result.sort((a, b) => a.sort_order - b.sort_order);
  },
  create: createCard,
  reorder(input: { ids: string[] }) {
    return write(async (tx, w) => {
      if (new Set(input.ids).size !== input.ids.length)
        throw new Error("並び順が不正です");
      for (const [n, id] of input.ids.entries()) {
        const s = requireRecord(await tx.objectStore("series").get(id), w);
        await tx.objectStore("series").put({ ...s, sort_order: n });
      }
    });
  },
  remove(id: string) {
    return write(async (tx, w) => {
      const s = requireRecord(await tx.objectStore("series").get(id), w);
      const cards = (
        await tx.objectStore("cards").index("workspace").getAll(w)
      ).filter((c) => c.series_id === id && !c.deleted_at);
      await softDelete(
        tx,
        w,
        cards.map((c) => c.id),
      );
      await tx.objectStore("series").put({ ...s, deleted_at: Date.now() });
      await tx.objectStore("cleanupQueue").put({
        id,
        workspace_id: w,
        value: {
          kind: "series",
          at: Date.now() + 3600000,
          cards: cards.map((c) => c.id),
        },
      });
    });
  },
  restore(id: string) {
    return write(async (tx, w) => {
      const s = requireRecord(await tx.objectStore("series").get(id), w, true);
      const job = (await tx.objectStore("cleanupQueue").get(id))?.value as
        { cards: string[]; at: number } | undefined;
      if (!job || job.at <= Date.now())
        throw new Error("復元の猶予期間が終了しました");
      for (const card of job.cards) {
        const c = requireRecord(
          await tx.objectStore("cards").get(card),
          w,
          true,
        );
        await tx
          .objectStore("cards")
          .put({ ...c, deleted_at: null, version: c.version + 1 });
        await tx.objectStore("cleanupQueue").delete(card);
      }
      await tx.objectStore("series").put({ ...s, deleted_at: null });
      await tx.objectStore("cleanupQueue").delete(id);
    });
  },
};
