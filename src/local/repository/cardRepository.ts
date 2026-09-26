import { deletionService } from "../deletionService";
import { z } from "zod";
import { activeWorkspace, database } from "../db";
import { childId, placement, seriesLabel, normalize } from "../../domain";
import type { LocalCard, LocalSeries } from "../schema";
import {
  detail,
  requireRecord,
  uniqueId,
  version,
  write,
  type WriteTx,
} from "./common";
const inputSchema = z.object({
  display_id: z.string().trim().max(100).optional(),
  title: z.string().max(500).default(""),
  prompt_full: z.string().max(200000).default(""),
  prompt_delta: z.string().max(200000).default(""),
  memo: z.string().max(200000).default(""),
  ai_provider: z.string().max(200).default(""),
  model: z.string().max(200).default(""),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  metadata_json: z
    .string()
    .default("{}")
    .refine((s) => {
      try {
        JSON.parse(s);
        return true;
      } catch {
        return false;
      }
    }, "MetadataはJSONで入力してください"),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  parent_id: z.string().nullable().optional(),
  additional_parent_ids: z.array(z.string()).default([]),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  expectedVersion: z.number().optional(),
  renameChildren: z.boolean().optional(),
});
export type CardInput = z.input<typeof inputSchema>;
async function syncTags(tx: WriteTx, c: LocalCard) {
  for (const link of await tx
    .objectStore("cardTags")
    .index("workspace")
    .getAll(c.workspace_id))
    if ((link.value as { card: string }).card === c.id)
      await tx.objectStore("cardTags").delete(link.id);
  for (const tag of c.tags) {
    const id = c.workspace_id + ":" + tag;
    await tx
      .objectStore("tags")
      .put({ id, workspace_id: c.workspace_id, value: tag });
    await tx.objectStore("cardTags").put({
      id: c.id + ":" + tag,
      workspace_id: c.workspace_id,
      value: { card: c.id, tag },
    });
  }
}
export async function createCard(
  raw: CardInput,
  seriesId?: string,
): Promise<{ id: string }> {
  const input = inputSchema.parse(raw);
  return write(async (tx, workspace) => {
    const id = crypto.randomUUID(),
      now = Date.now();
    const seriesStore = tx.objectStore("series");
    let series: LocalSeries;
    if (seriesId)
      series = requireRecord(await seriesStore.get(seriesId), workspace);
    else {
      const list = await seriesStore.index("workspace").getAll(workspace);
      let n = list.length,
        display = input.display_id || `${seriesLabel(n)}-000`;
      const existing = await tx
        .objectStore("cards")
        .index("workspace")
        .getAll(workspace);
      while (
        !input.display_id &&
        existing.some((c) => normalize(c.display_id) === normalize(display))
      )
        display = `${seriesLabel(++n)}-000`;
      series = {
        id: crypto.randomUUID(),
        workspace_id: workspace,
        root_card_id: id,
        sort_order: list.length,
        next_card_number: 1,
        viewport_x: 100,
        viewport_y: 100,
        viewport_zoom: 1,
        version: 1,
        display_id: display,
        title: input.title,
        cover_image_id: "",
        image_count: 0,
      };
    }
    const number = seriesId ? series.next_card_number++ : null;
    const display =
      input.display_id ||
      (number ? childId(series.display_id, number) : series.display_id);
    await uniqueId(tx, workspace, display);
    const parents = [
      ...new Set(
        [input.parent_id, ...input.additional_parent_ids].filter(
          (s): s is string => !!s,
        ),
      ),
    ];
    for (const p of parents)
      if (
        requireRecord(await tx.objectStore("cards").get(p), workspace)
          .series_id !== series.id
      )
        throw new Error("親は同じSeriesから選択してください");
    const nodes = (
      await tx.objectStore("cards").index("workspace").getAll(workspace)
    ).filter((c) => c.series_id === series.id && !c.deleted_at);
    const parent = nodes.find((c) => c.id === input.parent_id);
    const pos = placement(
      nodes,
      input.x ?? parent?.canvas_x ?? 0,
      input.y ?? (parent ? parent.canvas_y + 280 : 0),
    );
    const c: LocalCard = {
      ...input,
      id,
      workspace_id: workspace,
      series_id: series.id,
      display_id: display,
      canvas_x: pos.x,
      canvas_y: pos.y,
      auto_number: input.display_id ? null : number,
      cover_image_id: null,
      version: 1,
      created_at: now,
      deleted_at: null,
      status: "draft",
      images: [],
      tags: [...new Set(input.tags)],
      is_root: !seriesId,
    };
    await tx.objectStore("cards").put(c);
    await syncTags(tx, c);
    await seriesStore.put(series);
    for (const [n, p] of parents.entries())
      await tx.objectStore("edges").put({
        id: crypto.randomUUID(),
        workspace_id: workspace,
        series_id: series.id,
        source_card_id: p,
        target_card_id: id,
        kind: "parent",
        is_primary: n === 0 ? 1 : 0,
        color: "#668bd5",
        version: 1,
      });
    return { id };
  });
}
export const cardRepository = {
  async get(id: string) {
    const workspace = await activeWorkspace(),
      db = await database();
    const tx = db.transaction(["cards", "images"]);
    const c = requireRecord(await tx.objectStore("cards").get(id), workspace);
    const images = (
      await tx.objectStore("images").index("card").getAll([workspace, id])
    )
      .filter((i) => !i.deleted_at && i.upload_status === "ready")
      .sort((a, b) => a.sort_order - b.sort_order);
    return { ...c, images };
  },
  create(series: string, raw: CardInput) {
    return createCard(raw, series);
  },
  async update(id: string, raw: CardInput) {
    return write(async (tx, w) => {
      const c = requireRecord(await tx.objectStore("cards").get(id), w);
      const input = inputSchema.parse({ ...c, ...raw });
      version(c, input.expectedVersion);
      const display = input.display_id || c.display_id;
      await uniqueId(tx, w, display, id);
      const next = {
        ...c,
        ...input,
        display_id: display,
        auto_number:
          display !== c.display_id && !c.is_root ? null : c.auto_number,
        version: c.version + 1,
        images: [],
      };
      if (c.is_root) {
        const s = requireRecord(
          await tx.objectStore("series").get(c.series_id),
          w,
        );
        await tx
          .objectStore("series")
          .put({ ...s, display_id: display, title: next.title });
        if (input.renameChildren && display !== c.display_id) {
          const children = (
            await tx.objectStore("cards").index("workspace").getAll(w)
          ).filter((x) => x.series_id === s.id && x.auto_number !== null);
          for (const child of children) {
            const label = childId(display, child.auto_number!);
            await uniqueId(tx, w, label, child.id);
            await tx
              .objectStore("cards")
              .put({ ...child, display_id: label, version: child.version + 1 });
          }
        }
      }
      await tx.objectStore("cards").put(next);
      await syncTags(tx, next);
    });
  },
  remove(id: string) {
    return deletionService.remove({ kind: "card", id });
  },
  restore(id: string) {
    return deletionService.restore({ kind: "card", id });
  },
  cover(id: string, input: { image_id: string; expectedVersion?: number }) {
    return write(async (tx, w) => {
      const c = await detail(tx, w, id);
      version(c, input.expectedVersion);
      if (!c.images.some((i) => i.id === input.image_id))
        throw new Error("このCardの保存済み画像を選択してください");
      await tx.objectStore("cards").put({
        ...c,
        images: [],
        cover_image_id: input.image_id,
        version: c.version + 1,
      });
    });
  },
  reorderImages(
    id: string,
    input: { ids: string[]; expectedVersion?: number },
  ) {
    return write(async (tx, w) => {
      const c = await detail(tx, w, id);
      version(c, input.expectedVersion);
      if (
        new Set(input.ids).size !== c.images.length ||
        c.images.some((i) => !input.ids.includes(i.id))
      )
        throw new Error("画像の並びを再読み込みしてください");
      for (const [n, i] of input.ids.entries()) {
        const row = requireRecord(await tx.objectStore("images").get(i), w);
        await tx.objectStore("images").put({ ...row, sort_order: n });
      }
      await tx
        .objectStore("cards")
        .put({ ...c, images: [], version: c.version + 1 });
    });
  },
  move(
    id: string,
    input: { series_id: string; display_id?: string; expectedVersion?: number },
  ) {
    return write(async (tx, w) => {
      const c = requireRecord(await tx.objectStore("cards").get(id), w);
      version(c, input.expectedVersion);
      if (c.is_root) throw new Error("Rootは移動できません");
      const s = requireRecord(
        await tx.objectStore("series").get(input.series_id),
        w,
      );
      const display =
        input.display_id || childId(s.display_id, s.next_card_number);
      await uniqueId(tx, w, display, id);
      const nodes = (
        await tx.objectStore("cards").index("workspace").getAll(w)
      ).filter((c) => c.series_id === s.id);
      const pos = placement(nodes, 0, 280);
      await tx.objectStore("cards").put({
        ...c,
        series_id: s.id,
        display_id: display,
        auto_number: s.next_card_number,
        canvas_x: pos.x,
        canvas_y: pos.y,
        version: c.version + 1,
      });
      await tx
        .objectStore("series")
        .put({ ...s, next_card_number: s.next_card_number + 1 });
      for (const i of await tx
        .objectStore("images")
        .index("card")
        .getAll([w, id]))
        await tx.objectStore("images").put({ ...i, series_id: s.id });
      for (const e of await tx
        .objectStore("edges")
        .index("workspace")
        .getAll(w))
        if (e.source_card_id === id || e.target_card_id === id)
          await tx.objectStore("edges").put({ ...e, deleted_at: Date.now() });
    });
  },
  async duplicate(id: string) {
    const c = await this.get(id);
    const { imageRepository } = await import("./imageRepository");
    const result = await createCard(
      { ...c, display_id: undefined, parent_id: c.is_root ? null : c.id },
      c.is_root ? undefined : c.series_id,
    );
    for (const i of c.images)
      await imageRepository.import(
        result.id,
        new File([await imageRepository.original(i.id)], i.original_filename, {
          type: i.mime_type,
        }),
      );
    return result;
  },
};
