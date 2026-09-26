import { activeWorkspace, database } from "./db";
import { requireRecord, write, WRITE_STORES } from "./repository/common";
import type { LocalEdge, ValueRecord } from "./schema";
import { fileStore } from "./files/fileStore";
import { wouldCycle } from "../domain";

export const DELETE_GRACE_MS = 10_000;
export type DeleteTarget = { kind: "card" | "series"; id: string };
export type DeleteTicket = DeleteTarget & { workspace: string; at: number };
type Job = DeleteTarget & {
  at: number;
  cards?: string[];
  images?: string[];
  edges?: LocalEdge[];
  relations?: ValueRecord[];
  purging?: boolean;
};

export const deletionService = {
  async describe(target: DeleteTarget) {
    const db = await database(),
      w = await activeWorkspace();
    const tx = db.transaction(["cards", "series", "images"]);
    const s =
      target.kind === "series"
        ? requireRecord(await tx.objectStore("series").get(target.id), w)
        : null;
    const card = requireRecord(
      await tx.objectStore("cards").get(s?.root_card_id ?? target.id),
      w,
    );
    const cards = (
      await tx.objectStore("cards").index("workspace").getAll(w)
    ).filter(
      (c) => !c.deleted_at && (s ? c.series_id === s.id : c.id === card.id),
    );
    const ids = new Set(cards.map((c) => c.id));
    const images = (
      await tx.objectStore("images").index("workspace").getAll(w)
    ).filter((i) => !i.deleted_at && ids.has(i.card_id));
    return {
      label: card.display_id,
      title: card.title,
      cards: cards.length,
      images: images.length,
    };
  },
  remove(target: DeleteTarget): Promise<DeleteTicket> {
    return write(async (tx, w) => {
      const now = Date.now();
      const all = await tx.objectStore("cards").index("workspace").getAll(w);
      if (target.kind === "series") {
        const s = requireRecord(
          await tx.objectStore("series").get(target.id),
          w,
        );
        await tx.objectStore("series").put({ ...s, deleted_at: now });
      } else {
        const c = requireRecord(
          await tx.objectStore("cards").get(target.id),
          w,
        );
        if (c.is_root) throw new Error("Rootはシリーズとして削除してください");
      }
      const cards = all.filter(
        (c) =>
          !c.deleted_at &&
          (target.kind === "series"
            ? c.series_id === target.id
            : c.id === target.id),
      );
      const ids = new Set(cards.map((c) => c.id));
      for (const c of cards)
        await tx
          .objectStore("cards")
          .put({ ...c, deleted_at: now, version: c.version + 1 });
      const images = (
        await tx.objectStore("images").index("workspace").getAll(w)
      ).filter((i) => ids.has(i.card_id) && !i.deleted_at);
      if (images.some((i) => i.upload_status === "pending"))
        throw new Error("画像の保存が完了してから削除してください");
      for (const i of images)
        await tx.objectStore("images").put({ ...i, deleted_at: now });
      const edges = (
        await tx.objectStore("edges").index("workspace").getAll(w)
      ).filter((e) => ids.has(e.source_card_id) || ids.has(e.target_card_id));
      for (const e of edges) await tx.objectStore("edges").delete(e.id);
      const relations = (
        await tx.objectStore("cardTags").index("workspace").getAll(w)
      ).filter((r) => ids.has((r.value as { card: string }).card));
      for (const r of relations) await tx.objectStore("cardTags").delete(r.id);
      const at = now + DELETE_GRACE_MS;
      const job: Job = {
        ...target,
        at,
        cards: [...ids],
        images: images.map((i) => i.id),
        edges,
        relations,
      };
      await tx
        .objectStore("cleanupQueue")
        .put({ id: target.id, workspace_id: w, value: job });
      return { ...target, workspace: w, at };
    });
  },
  restore(target: DeleteTarget & { workspace?: string }) {
    return write(async (tx, w) => {
      if (target.workspace && target.workspace !== w)
        throw new Error("保存領域が変更されています");
      const row = requireRecord(
        await tx.objectStore("cleanupQueue").get(target.id),
        w,
      );
      const job = row.value as Job;
      if (job.kind !== target.kind || job.at <= Date.now() || job.purging)
        throw new Error("元に戻せる時間が終了しました");
      if (target.kind === "series") {
        const s = requireRecord(
          await tx.objectStore("series").get(target.id),
          w,
          true,
        );
        await tx.objectStore("series").put({ ...s, deleted_at: null });
      }
      for (const id of job.cards ?? [target.id]) {
        const c = requireRecord(await tx.objectStore("cards").get(id), w, true);
        requireRecord(await tx.objectStore("series").get(c.series_id), w);
        await tx
          .objectStore("cards")
          .put({ ...c, deleted_at: null, version: c.version + 1 });
      }
      for (const id of job.images ?? []) {
        const i = requireRecord(
          await tx.objectStore("images").get(id),
          w,
          true,
        );
        await tx.objectStore("images").put({ ...i, deleted_at: null });
      }
      for (const e of job.edges ?? []) {
        const a = await tx.objectStore("cards").get(e.source_card_id),
          b = await tx.objectStore("cards").get(e.target_card_id);
        if (
          a &&
          b &&
          !a.deleted_at &&
          !b.deleted_at &&
          a.series_id === e.series_id &&
          b.series_id === e.series_id
        ) {
          const edges = (
            await tx.objectStore("edges").index("workspace").getAll(w)
          ).filter((x) => !x.deleted_at);
          if (
            e.kind === "parent" &&
            wouldCycle(edges, e.source_card_id, e.target_card_id)
          )
            throw new Error(
              "接続が変更されています。新しい親接続を取り消してから元に戻してください",
            );
          const primary =
            e.is_primary &&
            !edges.some(
              (x) =>
                x.kind === "parent" &&
                x.target_card_id === e.target_card_id &&
                x.is_primary,
            );
          await tx
            .objectStore("edges")
            .put({ ...e, is_primary: primary ? 1 : 0 });
        }
      }
      for (const r of job.relations ?? [])
        await tx.objectStore("cardTags").put(r);
      // Older versions queued a separate job for every series member.
      if (!job.images && target.kind === "series")
        for (const id of job.cards ?? [])
          await tx.objectStore("cleanupQueue").delete(id);
      await tx.objectStore("cleanupQueue").delete(target.id);
    });
  },
};

// Claim before touching files: an expired operation cannot race with Undo.
// Keep metadata and the queue until every file removal succeeds, so retries are safe.
export async function purgeDeletion(item: ValueRecord, now: number) {
  const db = await database();
  const claim = db.transaction(
    ["cleanupQueue", "cards", "series"],
    "readwrite",
  );
  const current = await claim.objectStore("cleanupQueue").get(item.id);
  if (!current || current.workspace_id !== item.workspace_id) {
    await claim.done;
    return;
  }
  const job = current.value as Job;
  const entity = await claim
    .objectStore(job.kind === "series" ? "series" : "cards")
    .get(item.id);
  if (job.at > now || !entity?.deleted_at) {
    await claim.done;
    return;
  }
  await claim
    .objectStore("cleanupQueue")
    .put({ ...current, value: { ...job, purging: true } });
  await claim.done;
  const cards = (
    await db.getAllFromIndex("cards", "workspace", item.workspace_id)
  ).filter((c) =>
    job.kind === "series" ? c.series_id === item.id : c.id === item.id,
  );
  const ids = new Set(cards.map((c) => c.id));
  const images = (
    await db.getAllFromIndex("images", "workspace", item.workspace_id)
  ).filter((i) => ids.has(i.card_id));
  for (const i of images) {
    const files = await fileStore(i.backend);
    await files.remove(i.original_key);
    if (i.thumbnail_key) await files.remove(i.thumbnail_key);
  }
  const tx = db.transaction(WRITE_STORES, "readwrite");
  for (const i of images) {
    await tx.objectStore("images").delete(i.id);
    await tx.objectStore("cleanupQueue").delete(i.id);
  }
  for (const id of ids) {
    await tx.objectStore("cards").delete(id);
    await tx.objectStore("cleanupQueue").delete(id);
    await tx.objectStore("drafts").delete(item.workspace_id + ":draft:" + id);
  }
  for (const e of await tx
    .objectStore("edges")
    .index("workspace")
    .getAll(item.workspace_id))
    if (ids.has(e.source_card_id) || ids.has(e.target_card_id))
      await tx.objectStore("edges").delete(e.id);
  for (const r of await tx
    .objectStore("cardTags")
    .index("workspace")
    .getAll(item.workspace_id))
    if (ids.has((r.value as { card: string }).card))
      await tx.objectStore("cardTags").delete(r.id);
  if (job.kind === "series") {
    await tx.objectStore("series").delete(item.id);
    await tx
      .objectStore("drafts")
      .delete(item.workspace_id + ":draft:" + item.id);
  }
  await tx.objectStore("cleanupQueue").delete(item.id);
  await tx.done;
  if (typeof sessionStorage !== "undefined") {
    for (const id of ids) sessionStorage.removeItem("draft:" + id);
    if (job.kind === "series") {
      sessionStorage.removeItem("draft:" + item.id);
      sessionStorage.removeItem("viewport:" + item.id);
      if (sessionStorage.getItem("last-series") === item.id)
        sessionStorage.removeItem("last-series");
    }
  }
}
