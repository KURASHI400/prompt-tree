import { activeWorkspace, database } from "../db";
import { wouldCycle } from "../../domain";
import type { Viewport } from "../../types";
import { requireRecord, version, write, type WriteTx } from "./common";
import type { LocalEdge } from "../schema";
async function validateEdge(tx: WriteTx, w: string, e: LocalEdge) {
  const a = requireRecord(
      await tx.objectStore("cards").get(e.source_card_id),
      w,
    ),
    b = requireRecord(await tx.objectStore("cards").get(e.target_card_id), w);
  if (a.id === b.id || a.series_id !== b.series_id)
    throw new Error("同じSeriesの別Cardを接続してください");
  const edges = (
    await tx.objectStore("edges").index("workspace").getAll(w)
  ).filter((x) => !x.deleted_at && x.id !== e.id);
  if (
    edges.some(
      (x) =>
        x.kind === e.kind &&
        x.source_card_id === a.id &&
        x.target_card_id === b.id,
    )
  )
    throw new Error("接続は既に存在します");
  if (e.kind === "parent" && (b.is_root || wouldCycle(edges, a.id, b.id)))
    throw new Error("親接続が循環します");
  if (!/^#[0-9a-f]{6}$/i.test(e.color)) throw new Error("色が不正です");
  return edges;
}
export const treeRepository = {
  async get(id: string) {
    const w = await activeWorkspace(),
      db = await database(),
      tx = db.transaction(["series", "cards", "edges", "images"]);
    const series = requireRecord(await tx.objectStore("series").get(id), w);
    const cards = (
      await tx.objectStore("cards").index("workspace").getAll(w)
    ).filter(
      (c) => c.series_id === id && !c.deleted_at && c.status === "ready",
    );
    const nodes = [];
    for (const c of cards) {
      const images = (
        await tx.objectStore("images").index("card").getAll([w, c.id])
      ).filter((i) => !i.deleted_at && i.upload_status === "ready");
      nodes.push({
        id: c.id,
        display_id: c.display_id,
        cover_image_id: c.cover_image_id!,
        canvas_x: c.canvas_x,
        canvas_y: c.canvas_y,
        image_count: images.length,
      });
    }
    const ids = new Set(cards.map((c) => c.id));
    const edges = (
      await tx.objectStore("edges").index("workspace").getAll(w)
    ).filter(
      (e) =>
        !e.deleted_at &&
        e.series_id === id &&
        ids.has(e.source_card_id) &&
        ids.has(e.target_card_id),
    );
    return { series, nodes, edges };
  },
  saveViewport(id: string, v: Viewport) {
    return write(async (tx, w) => {
      if (![v.x, v.y, v.zoom].every(Number.isFinite) || v.zoom <= 0)
        throw new Error("表示位置が不正です");
      const s = requireRecord(await tx.objectStore("series").get(id), w);
      await tx
        .objectStore("series")
        .put({ ...s, viewport_x: v.x, viewport_y: v.y, viewport_zoom: v.zoom });
    });
  },
  positions(
    id: string,
    input: { positions: { id: string; x: number; y: number }[] },
  ) {
    return write(async (tx, w) => {
      for (const p of input.positions) {
        const c = requireRecord(await tx.objectStore("cards").get(p.id), w);
        if (c.series_id !== id || ![p.x, p.y].every(Number.isFinite))
          throw new Error("位置が不正です");
        await tx
          .objectStore("cards")
          .put({ ...c, canvas_x: p.x, canvas_y: p.y });
      }
    });
  },
  createEdge(input: {
    source_card_id?: string;
    target_card_id?: string;
    kind: string;
    color: string;
  }) {
    return write(async (tx, w) => {
      if (
        !input.source_card_id ||
        !input.target_card_id ||
        !["parent", "reference"].includes(input.kind)
      )
        throw new Error("接続を選択してください");
      const a = requireRecord(
        await tx.objectStore("cards").get(input.source_card_id),
        w,
      );
      const e: LocalEdge = {
        ...input,
        source_card_id: input.source_card_id,
        target_card_id: input.target_card_id,
        kind: input.kind as "parent" | "reference",
        id: crypto.randomUUID(),
        workspace_id: w,
        series_id: a.series_id,
        is_primary: 0,
        version: 1,
      };
      const edges = await validateEdge(tx, w, e);
      if (
        e.kind === "parent" &&
        !edges.some(
          (x) =>
            x.kind === "parent" &&
            x.target_card_id === e.target_card_id &&
            x.is_primary,
        )
      )
        e.is_primary = 1;
      await tx.objectStore("edges").put(e);
      return { id: e.id };
    });
  },
  updateEdge(
    id: string,
    input: { color?: string; is_primary?: boolean; expectedVersion?: number },
  ) {
    return write(async (tx, w) => {
      const e = requireRecord(await tx.objectStore("edges").get(id), w);
      version(e, input.expectedVersion);
      const next = {
        ...e,
        color: input.color ?? e.color,
        is_primary:
          input.is_primary === undefined
            ? e.is_primary
            : Number(input.is_primary),
        version: e.version + 1,
      };
      if (next.kind === "reference") next.is_primary = 0;
      const edges = await validateEdge(tx, w, next);
      if (next.is_primary)
        for (const other of edges)
          if (
            other.target_card_id === e.target_card_id &&
            other.kind === "parent" &&
            other.is_primary
          )
            await tx
              .objectStore("edges")
              .put({ ...other, is_primary: 0, version: other.version + 1 });
      await tx.objectStore("edges").put(next);
    });
  },
  removeEdge(id: string) {
    return write(async (tx, w) => {
      const e = requireRecord(await tx.objectStore("edges").get(id), w);
      await tx
        .objectStore("edges")
        .put({ ...e, deleted_at: Date.now(), version: e.version + 1 });
    });
  },
  restoreEdge(id: string) {
    return write(async (tx, w) => {
      const e = requireRecord(await tx.objectStore("edges").get(id), w, true);
      const edges = await validateEdge(tx, w, e);
      const primary =
        e.is_primary &&
        !edges.some(
          (x) => x.target_card_id === e.target_card_id && x.is_primary,
        );
      await tx.objectStore("edges").put({
        ...e,
        deleted_at: null,
        is_primary: Number(primary),
        version: e.version + 1,
      });
    });
  },
};
