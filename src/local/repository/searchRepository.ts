import { activeWorkspace, database } from "../db";
import { normalize } from "../../domain";
export interface SearchResult {
  id: string;
  display_id: string;
  title: string;
  cover_image_id: string;
  snippet: string;
}
export const searchRepository = {
  async search(query: string, after?: string | null) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return { items: [], cursor: null };
    const w = await activeWorkspace(),
      db = await database(),
      items: SearchResult[] = [];
    let key = after ?? "",
      last: string | null = null;
    // Batches yield to the event loop between IDB transactions even for thousands of Cards.
    while (true) {
      const tx = db.transaction("cards"),
        batch = [];
      let cur = await tx.store.openCursor(IDBKeyRange.lowerBound(key, true));
      while (cur && batch.length < 200) {
        batch.push(cur.value);
        key = cur.key;
        cur = await cur.continue();
      }
      await tx.done;
      for (const c of batch) {
        if (c.workspace_id !== w || c.deleted_at || c.status !== "ready")
          continue;
        const text = [
          c.display_id,
          c.title,
          c.prompt_full,
          c.prompt_delta,
          c.memo,
          c.ai_provider,
          c.model,
          ...c.tags,
        ].join(" ");
        if (terms.every((t) => normalize(text).includes(t))) {
          if (items.length === 120) return { items, cursor: last };
          items.push({
            id: c.id,
            display_id: c.display_id,
            title: c.title,
            cover_image_id: c.cover_image_id!,
            snippet: text.slice(0, 180),
          });
          last = c.id;
        }
      }
      if (batch.length < 200) return { items, cursor: null };
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  },
};
