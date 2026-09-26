import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { activeWorkspace, closeDatabase, database } from "../src/local/db";
import { DATABASE_NAME } from "../src/local/schema";
import { deletionService } from "../src/local/deletionService";
import { cleanup } from "../src/local/maintenance";
import { seriesRepository as series } from "../src/local/repository/seriesRepository";
import { cardRepository as cards } from "../src/local/repository/cardRepository";
import { imageRepository as images } from "../src/local/repository/imageRepository";
import { treeRepository as tree } from "../src/local/repository/treeRepository";
import { searchRepository as search } from "../src/local/repository/searchRepository";
import { IndexedDbBlobFileStore } from "../src/local/files/IndexedDbBlobFileStore";

const store = new IndexedDbBlobFileStore();
const file = new File(
  [new Uint8Array([137, 80, 78, 71, 22, 255])],
  "original.png",
  { type: "image/png" },
);
const deps = {
  store,
  preflight: async () => ({}),
  thumbnail: async () => ({
    blob: new Blob(["thumbnail"]),
    width: 20,
    height: 20,
  }),
};
afterEach(async () => {
  vi.restoreAllMocks();
  await closeDatabase();
  await deleteDB(DATABASE_NAME);
});
async function fixture() {
  const root = await series.create({ prompt_full: "root", tags: ["shared"] });
  await images.import(root.id, file, deps);
  const r = await cards.get(root.id);
  const parent = await cards.create(r.series_id, {
    parent_id: r.id,
    prompt_full: "unique-deleted-prompt",
    tags: ["shared", "parent"],
  });
  await images.import(parent.id, file, deps);
  await images.import(parent.id, file, deps);
  const child = await cards.create(r.series_id, {
    parent_id: parent.id,
    prompt_full: "surviving-child",
    tags: ["shared"],
  });
  await images.import(child.id, file, deps);
  await tree.createEdge({
    source_card_id: child.id,
    target_card_id: parent.id,
    kind: "reference",
    color: "#668bd5",
  });
  await tree.saveViewport(r.series_id, { x: 812, y: -77, zoom: 0.75 });
  await tree.positions(r.series_id, {
    positions: [{ id: parent.id, x: 900, y: 500 }],
  });
  return {
    root: r,
    parent: await cards.get(parent.id),
    child: await cards.get(child.id),
  };
}
it("deletes a multi-image parent, removes all incident edges/relations, preserves descendants and reload state", async () => {
  const { root, parent, child } = await fixture();
  await cards.remove(parent.id);
  await expect(cards.get(parent.id)).rejects.toThrow();
  expect((await cards.get(child.id)).prompt_full).toBe("surviving-child");
  expect((await images.list()).items).toHaveLength(2);
  expect((await search.search("unique-deleted-prompt")).items).toHaveLength(0);
  const graph = await tree.get(root.series_id);
  expect(graph.nodes.map((c) => c.id)).toEqual(
    expect.arrayContaining([root.id, child.id]),
  );
  expect(graph.edges).toHaveLength(0);
  const db = await database();
  expect(
    (await db.getAll("cardTags")).some(
      (r) => (r.value as { card: string }).card === parent.id,
    ),
  ).toBe(false);
  for (const i of parent.images)
    expect(await (await store.read(i.original_key)).arrayBuffer()).toEqual(
      await file.arrayBuffer(),
    );
  await closeDatabase();
  await expect(cards.get(parent.id)).rejects.toThrow();
  expect((await images.list()).items).toHaveLength(2);
});
it("undo restores byte-identical originals, thumbnails, covers, tags, positions and both edge kinds", async () => {
  const { root, parent } = await fixture();
  const before = await tree.get(root.series_id);
  await cards.remove(parent.id);
  await cards.restore(parent.id);
  const restored = await cards.get(parent.id);
  expect(restored.images).toHaveLength(2);
  expect(restored.cover_image_id).toBe(parent.cover_image_id);
  expect(restored.canvas_x).toBe(900);
  expect(restored.tags).toEqual(parent.tags);
  expect((await tree.get(root.series_id)).edges).toEqual(before.edges);
  expect((await search.search("unique-deleted-prompt")).items).toHaveLength(1);
  for (const i of restored.images) {
    expect(await (await images.original(i.id)).arrayBuffer()).toEqual(
      await file.arrayBuffer(),
    );
    expect(await (await store.read(i.thumbnail_key!)).text()).toBe("thumbnail");
  }
  await cleanup(Date.now() + 20_000);
  expect((await cards.get(parent.id)).images).toHaveLength(2);
});
it("series deletion counts all cards/images and undo restores viewport and every member", async () => {
  const { root } = await fixture();
  const target = { kind: "series" as const, id: root.series_id };
  expect(await deletionService.describe(target)).toMatchObject({
    cards: 3,
    images: 4,
  });
  const before = await tree.get(root.series_id);
  await series.remove(root.series_id);
  expect(await series.list()).toHaveLength(0);
  expect((await images.list()).items).toHaveLength(0);
  await series.restore(root.series_id);
  expect((await tree.get(root.series_id)).nodes).toEqual(before.nodes);
  expect((await tree.get(root.series_id)).edges).toEqual(before.edges);
  expect((await tree.get(root.series_id)).series.viewport_x).toBe(812);
  expect((await images.list()).items).toHaveLength(4);
});
it.each(["card", "series"] as const)(
  "%s cleanup removes originals/thumbnails and metadata only after grace",
  async (kind) => {
    const { root, parent, child } = await fixture();
    const target = { kind, id: kind === "card" ? parent.id : root.series_id };
    const allImages =
      kind === "card"
        ? parent.images
        : [...root.images, ...parent.images, ...child.images];
    const ticket = await deletionService.remove(target);
    await cleanup(ticket.at - 1);
    expect((await store.read(allImages[0].original_key)).size).toBe(file.size);
    await cleanup(ticket.at);
    const db = await database();
    for (const i of allImages) {
      await expect(store.read(i.original_key)).rejects.toThrow();
      await expect(store.read(i.thumbnail_key!)).rejects.toThrow();
      expect(await db.get("images", i.id)).toBeUndefined();
    }
    expect(await db.get("cards", parent.id)).toBeUndefined();
    expect(await db.get("cleanupQueue", target.id)).toBeUndefined();
    if (kind === "series") {
      expect(await db.get("series", root.series_id)).toBeUndefined();
      for (const name of ["cards", "edges", "cardTags", "files"] as const)
        expect(await db.count(name)).toBe(0);
    } else expect((await cards.get(child.id)).images).toHaveLength(1);
    await expect(deletionService.restore(target)).rejects.toThrow();
  },
);
it("expired undo is refused and interrupted file cleanup is retried without losing its queue", async () => {
  const { parent } = await fixture();
  const ticket = await cards.remove(parent.id);
  const clock = vi.spyOn(Date, "now").mockReturnValue(ticket.at);
  await expect(cards.restore(parent.id)).rejects.toThrow("終了");
  const remove = vi
    .spyOn(IndexedDbBlobFileStore.prototype, "remove")
    .mockRejectedValueOnce(new Error("disk unavailable"));
  await expect(cleanup()).rejects.toThrow("disk unavailable");
  const db = await database();
  expect(await db.get("cards", parent.id)).toBeDefined();
  expect(await db.get("cleanupQueue", parent.id)).toBeDefined();
  remove.mockRestore();
  await cleanup();
  clock.mockRestore();
  expect(await db.get("cards", parent.id)).toBeUndefined();
});
it("does not resurrect earlier deletions or allow cross-workspace Undo", async () => {
  const { root, parent } = await fixture();
  await cards.remove(parent.id);
  const ticket = await series.remove(root.series_id);
  await expect(
    deletionService.restore({ ...ticket, workspace: "other" }),
  ).rejects.toThrow("保存領域");
  await series.restore(root.series_id);
  await expect(cards.get(parent.id)).rejects.toThrow();
  expect(await activeWorkspace()).toBe(ticket.workspace);
});
it("refuses deletion during an image write and rolls back the whole series transaction", async () => {
  const { root } = await fixture();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const upload = images.import(root.id, file, {
    ...deps,
    thumbnail: async () => {
      started();
      await gate;
      return deps.thumbnail();
    },
  });
  await ready;
  await expect(series.remove(root.series_id)).rejects.toThrow("保存が完了");
  expect(await series.list()).toHaveLength(1);
  release();
  await upload;
  expect((await cards.get(root.id)).images).toHaveLength(2);
  await series.remove(root.series_id);
});
it("an upload overtaken by deletion cannot create orphan image metadata or files", async () => {
  const { parent } = await fixture();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const upload = images.import(parent.id, file, {
    ...deps,
    preflight: async () => {
      started();
      await gate;
      return {};
    },
  });
  const failure = expect(upload).rejects.toThrow();
  await ready;
  const ticket = await cards.remove(parent.id);
  await cleanup(ticket.at);
  const db = await database(),
    count = await db.count("files");
  release();
  await failure;
  expect(await db.count("files")).toBe(count);
  expect(
    await db.getAllFromIndex("images", "card", [
      await activeWorkspace(),
      parent.id,
    ]),
  ).toHaveLength(0);
});
it("undo keeps a newly selected primary parent unique", async () => {
  const { root, parent, child } = await fixture();
  await cards.remove(parent.id);
  const edge = await tree.createEdge({
    source_card_id: root.id,
    target_card_id: child.id,
    kind: "parent",
    color: "#668bd5",
  });
  await tree.updateEdge(edge.id, { is_primary: true });
  await cards.restore(parent.id);
  const primary = (await tree.get(root.series_id)).edges.filter(
    (e) => e.target_card_id === child.id && e.is_primary,
  );
  expect(primary.map((e) => e.id)).toEqual([edge.id]);
});
it("resumes queued cleanup after closing and reopening the database", async () => {
  const { root, parent } = await fixture();
  const ticket = await series.remove(root.series_id);
  await closeDatabase();
  await cleanup(ticket.at);
  const db = await database();
  expect(await db.get("series", root.series_id)).toBeUndefined();
  expect(await db.get("cards", parent.id)).toBeUndefined();
  expect(await db.count("files")).toBe(0);
  expect(await db.count("cleanupQueue")).toBe(0);
});
it("cleans legacy card queues without leaving edges or tag relations", async () => {
  const { parent, child } = await fixture();
  const db = await database(),
    w = await activeWorkspace();
  await db.put("cards", { ...parent, deleted_at: Date.now() });
  await db.put("cleanupQueue", {
    id: parent.id,
    workspace_id: w,
    value: { kind: "card", at: Date.now() - 1 },
  });
  await cleanup();
  expect(await db.get("cards", parent.id)).toBeUndefined();
  expect(await db.count("edges")).toBe(0);
  expect((await cards.get(child.id)).images).toHaveLength(1);
  for (const i of parent.images)
    await expect(store.read(i.original_key)).rejects.toThrow();
});
