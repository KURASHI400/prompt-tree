import { activeWorkspace, database } from "../db";
import { write } from "./common";
export const settingsRepository = {
  async get() {
    const w = await activeWorkspace();
    const row = await (await database()).get("settings", w + ":research");
    return (row?.value ?? { default_ai_provider: "ChatGPT" }) as {
      default_ai_provider: string;
    };
  },
  set(input: { default_ai_provider: string }) {
    return write(async (tx, w) => {
      await tx
        .objectStore("settings")
        .put({ id: w + ":research", workspace_id: w, value: input });
    });
  },
  async tags() {
    const w = await activeWorkspace();
    return (
      await (await database()).getAllFromIndex("tags", "workspace", w)
    ).map((r) => String(r.value));
  },
  async stats() {
    const w = await activeWorkspace(),
      db = await database();
    const cards = (await db.getAllFromIndex("cards", "workspace", w)).filter(
      (c) => !c.deleted_at && c.status === "ready",
    );
    const ids = new Set(cards.map((c) => c.id));
    const images = (await db.getAllFromIndex("images", "workspace", w)).filter(
      (i) => !i.deleted_at && i.upload_status === "ready" && ids.has(i.card_id),
    );
    const last = await db.get("control", "last_backup");
    const revision = Number((await db.get("control", "revision"))?.value ?? 0);
    return {
      cards: cards.length,
      images: images.length,
      bytes: images.reduce((n, i) => n + i.file_size, 0),
      revision,
      last_backup: (last?.value ?? null) as {
        at: number;
        revision: number;
      } | null,
    };
  },
  async draft(key: string, value?: Record<string, string>) {
    const w = await activeWorkspace(),
      db = await database(),
      id = w + ":" + key;
    if (value) await db.put("drafts", { id, workspace_id: w, value });
    return (await db.get("drafts", id))?.value as
      Record<string, string> | undefined;
  },
  async removeDraft(key: string) {
    const w = await activeWorkspace();
    await (await database()).delete("drafts", w + ":" + key);
  },
};
