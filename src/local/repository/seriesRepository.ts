import { deletionService } from "../deletionService";
import { activeWorkspace, database } from "../db";
import { createCard } from "./cardRepository";
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
    return deletionService.remove({ kind: "series", id });
  },
  restore(id: string) {
    return deletionService.restore({ kind: "series", id });
  },
};
