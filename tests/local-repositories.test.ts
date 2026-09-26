import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { deleteDB } from "idb";
import { unzipSync, zipSync } from "fflate";
import { closeDatabase, database, activeWorkspace } from "../src/local/db";
import { DATABASE_NAME } from "../src/local/schema";
import { seriesRepository as series } from "../src/local/repository/seriesRepository";
import { cardRepository as cards } from "../src/local/repository/cardRepository";
import { imageRepository as images } from "../src/local/repository/imageRepository";
import { treeRepository as tree } from "../src/local/repository/treeRepository";
import { searchRepository as search } from "../src/local/repository/searchRepository";
import { settingsRepository as settings } from "../src/local/repository/settingsRepository";
import { IndexedDbBlobFileStore } from "../src/local/files/IndexedDbBlobFileStore";
import { createBackup } from "../src/local/backup/createBackup";
import { restoreBackup } from "../src/local/backup/restoreBackup";
import { validateBackup } from "../src/local/backup/validateBackup";
import { snapshot } from "../src/local/backup/createBackup";
import { setupPin, verifyPin, hasPin } from "../src/local/security/pin";
import { expired } from "../src/local/security/lock";
const store = new IndexedDbBlobFileStore();
const file = new File(
  [new Uint8Array([137, 80, 78, 71, 0, 255, 42])],
  "original.png",
  { type: "image/png" },
);
const dependencies = {
  store,
  preflight: async () => ({}),
  thumbnail: async () => ({
    blob: new Blob(["thumbnail"]),
    width: 20,
    height: 20,
  }),
};
afterEach(async () => {
  await closeDatabase();
  await deleteDB(DATABASE_NAME);
});
async function root() {
  const { id } = await series.create({
    prompt_full: "日本語の猫",
    tags: ["研究"],
  });
  await images.import(id, file, dependencies);
  return cards.get(id);
}
it("keeps multi-image experiments atomic, unique labels and monotonic child numbers", async () => {
  const c = await root();
  await images.import(c.id, file, dependencies);
  expect((await cards.get(c.id)).images).toHaveLength(2);
  expect((await tree.get(c.series_id)).nodes).toHaveLength(1);
  expect((await images.list()).items).toHaveLength(2);
  await images.remove(c.images[0].id);
  expect((await images.list()).items).toHaveLength(1);
  await images.restore([c.images[0].id]);
  expect((await images.list()).items).toHaveLength(2);
  await expect(series.create({ display_id: "Ａ-０００" })).rejects.toThrow(
    "既に",
  );
  const child = await cards.create(c.series_id, { parent_id: c.id });
  await images.import(child.id, file, dependencies);
  await cards.remove(child.id);
  expect((await tree.get(c.series_id)).nodes).toHaveLength(1);
  await cards.restore(child.id);
  const next = await cards.create(c.series_id, {});
  expect((await cards.get(next.id)).display_id).toBe("A-002");
  await expect(
    images.remove((await cards.get(child.id)).images[0].id),
  ).rejects.toThrow("最後");
  expect(
    await images.original(c.images[0].id).then((b) => b.arrayBuffer()),
  ).toEqual(await file.arrayBuffer());
});
it("rejects quota failures without ready metadata and keeps existing originals", async () => {
  const c = await root(),
    draft = await series.create({});
  await expect(
    images.import(draft.id, file, {
      ...dependencies,
      store: {
        ...store,
        backend: "idb",
        read: store.read.bind(store),
        remove: store.remove.bind(store),
        write: async () => {
          throw new DOMException("full", "QuotaExceededError");
        },
      },
    }),
  ).rejects.toThrow("保存容量");
  expect((await cards.get(draft.id)).status).toBe("draft");
  expect(await series.list()).toHaveLength(1);
  expect((await images.original(c.images[0].id)).size).toBe(file.size);
});
it("validates parent cycles, reference cycles and one primary; preserves viewport and positions", async () => {
  const c = await root(),
    a = await cards.create(c.series_id, { parent_id: c.id }),
    b = await cards.create(c.series_id, { parent_id: a.id });
  await images.import(a.id, file, dependencies);
  await images.import(b.id, file, dependencies);
  await expect(
    tree.createEdge({
      source_card_id: b.id,
      target_card_id: a.id,
      kind: "parent",
      color: "#668bd5",
    }),
  ).rejects.toThrow("循環");
  const edge = await tree.createEdge({
    source_card_id: c.id,
    target_card_id: b.id,
    kind: "parent",
    color: "#668bd5",
  });
  await tree.updateEdge(edge.id, { is_primary: true });
  expect(
    (await tree.get(c.series_id)).edges.filter(
      (e) => e.target_card_id === b.id && e.is_primary,
    ),
  ).toHaveLength(1);
  await tree.createEdge({
    source_card_id: b.id,
    target_card_id: a.id,
    kind: "reference",
    color: "#668bd5",
  });
  await tree.saveViewport(c.series_id, { x: 13.21, y: -999.15, zoom: 0.6123 });
  await tree.positions(c.series_id, {
    positions: [{ id: a.id, x: 811.3, y: -200 }],
  });
  await closeDatabase();
  expect((await tree.get(c.series_id)).series.viewport_zoom).toBe(0.6123);
});
it("backs up 3 series, full research data and restores atomically with PIN retained", async () => {
  await setupPin("1234", "1234");
  const roots = await Promise.all([root(), root(), root()]);
  const c = roots[0],
    a = await cards.create(c.series_id, {
      parent_id: c.id,
      prompt_full: "derived",
      tags: ["tag"],
      rating: 4,
    }),
    b = await cards.create(c.series_id, {
      parent_id: c.id,
      additional_parent_ids: [a.id],
    });
  await images.import(a.id, file, dependencies);
  await images.import(b.id, file, dependencies);
  await images.import(c.id, file, dependencies);
  await tree.createEdge({
    source_card_id: b.id,
    target_card_id: a.id,
    kind: "reference",
    color: "#ff0011",
  });
  await tree.saveViewport(c.series_id, { x: 812, y: -77, zoom: 0.75 });
  await tree.positions(c.series_id, {
    positions: [{ id: b.id, x: 919, y: 556 }],
  });
  await settings.set({ default_ai_provider: "Local research" });
  const before = await snapshot(),
    parts: File[] = [];
  for await (const part of createBackup(() => {}, 8192)) parts.push(part.file);
  expect(parts.length).toBeGreaterThan(1);
  await expect(validateBackup(parts.slice(1))).rejects.toThrow("不足");
  let writes = 0;
  const failedStore = {
    backend: "idb" as const,
    read: store.read.bind(store),
    remove: store.remove.bind(store),
    write: async (path: string, blob: Blob) => {
      if (++writes === 2) throw new Error("simulated write failure");
      await store.write(path, blob);
    },
  };
  await expect(
    restoreBackup(parts, () => {}, {
      store: failedStore,
      preflight: async () => ({}),
    }),
  ).rejects.toThrow("simulated");
  expect(await activeWorkspace()).toBe(before.w);
  expect((await images.original(c.images[0].id)).size).toBe(file.size);
  const corrupt = [...parts];
  for (let n = 0; n < corrupt.length; n++) {
    const zip = unzipSync(new Uint8Array(await corrupt[n].arrayBuffer()));
    const key = Object.keys(zip).find((key) => key.startsWith("images/"));
    if (key) {
      zip[key][0] ^= 255;
      corrupt[n] = new File(
        [zipSync(zip, { level: 0 }) as Uint8Array<ArrayBuffer>],
        "corrupt.ptbackup",
      );
      break;
    }
  }
  await expect(
    restoreBackup(corrupt, () => {}, { store, preflight: async () => ({}) }),
  ).rejects.toThrow("検証");
  expect(await activeWorkspace()).toBe(before.w);
  await restoreBackup(parts, () => {}, { store, preflight: async () => ({}) });
  expect(await activeWorkspace()).not.toBe(before.w);
  expect(await hasPin()).toBe(true);
  await verifyPin("1234");
  const after = await snapshot();
  expect(after.data.cards.map((c) => c.display_id).sort()).toEqual(
    before.data.cards.map((c) => c.display_id).sort(),
  );
  expect(after.data.images.length).toBe(before.data.images.length);
  expect(after.data.edges.length).toBe(before.data.edges.length);
  expect(
    after.data.series.find((s) => s.viewport_x === 812)?.viewport_zoom,
  ).toBe(0.75);
  expect(after.data.cards.find((c) => c.canvas_x === 919)?.canvas_y).toBe(556);
  expect(await settings.get()).toEqual({
    default_ai_provider: "Local research",
  });
  for (const i of after.data.images)
    expect(await (await images.original(i.id)).arrayBuffer()).toEqual(
      await file.arrayBuffer(),
    );
  expect(await (await database()).get("cards", c.id)).toBeDefined();
});
it("PIN has local backoff and exact five minute inactivity boundary", async () => {
  await setupPin("1234", "1234");
  for (let n = 0; n < 5; n++)
    await expect(verifyPin("0000", 1000)).rejects.toThrow("違います");
  await expect(verifyPin("1234", 1001)).rejects.toThrow("秒後");
  await verifyPin("1234", 31000);
  expect(expired(1000, 300999)).toBe(false);
  expect(expired(1000, 301000)).toBe(true);
  expect(
    JSON.stringify((await (await database()).get("security", "pin"))?.value),
  ).not.toContain('"1234"');
});
it("preserves fields on partial edits, reorders collections, moves cards and restores a deleted Series", async () => {
  const a = await root(),
    b = await root();
  await series.reorder({ ids: [b.series_id, a.series_id] });
  expect((await series.list())[0].id).toBe(b.series_id);
  await cards.update(a.id, { title: "optional title" });
  expect((await cards.get(a.id)).prompt_full).toBe("日本語の猫");
  const custom = await cards.create(a.series_id, {
      display_id: "custom-ID",
      tags: ["custom"],
    }),
    child = await cards.create(a.series_id, { parent_id: a.id });
  await images.import(custom.id, file, dependencies);
  await images.import(child.id, file, dependencies);
  await cards.update(a.id, { display_id: "RENAMED", renameChildren: true });
  expect((await cards.get(custom.id)).display_id).toBe("custom-ID");
  expect((await cards.get(child.id)).display_id).toBe("RENAMED-002");
  const image = (await cards.get(child.id)).images[0];
  await images.favorite(image.id, { is_favorite: true });
  expect((await images.list({ type: "favorite" })).items).toHaveLength(1);
  await cards.move(child.id, { series_id: b.series_id });
  expect((await tree.get(a.series_id)).edges).toHaveLength(0);
  expect(
    (await images.list({ series: b.series_id, type: "favorite" })).items[0]
      .card_id,
  ).toBe(child.id);
  await series.remove(b.series_id);
  expect(await series.list()).toHaveLength(1);
  await series.restore(b.series_id);
  expect(await series.list()).toHaveLength(2);
  expect((await cards.get(child.id)).images).toHaveLength(1);
});
it("queries 10k metadata in bounded pages and searches thousands of cards", async () => {
  const c = await root(),
    w = await activeWorkspace(),
    db = await database();
  const original = await images.get(c.images[0].id),
    tx = db.transaction(["cards", "images"], "readwrite");
  for (let n = 0; n < 10000; n++) {
    await tx.objectStore("images").put({
      ...original,
      id: "synthetic-image-" + String(n).padStart(5, "0"),
      created_at: n,
      is_favorite: n % 5 === 0 ? 1 : 0,
    });
    if (n < 3000)
      await tx.objectStore("cards").put({
        ...c,
        id: "synthetic-card-" + String(n).padStart(5, "0"),
        workspace_id: w,
        display_id: "S" + n,
        prompt_full: n === 2999 ? "特別な検索語" : "benchmark",
      });
  }
  await tx.done;
  const page = await images.list();
  expect(page.items).toHaveLength(120);
  expect(page.cursor).toBeTruthy();
  const second = await images.list({ cursor: page.cursor });
  expect(second.items).toHaveLength(120);
  expect(second.items.some((i) => page.items.some((j) => j.id === i.id))).toBe(
    false,
  );
  for (const sort of ["newest", "oldest", "series"]) {
    const first = await images.list({
      sort,
      type: "favorite",
      series: c.series_id,
    });
    const next = await images.list({
      sort,
      type: "favorite",
      series: c.series_id,
      cursor: first.cursor,
    });
    expect(first.items).toHaveLength(120);
    expect(next.items).toHaveLength(120);
    expect(new Set([...first.items, ...next.items].map((i) => i.id)).size).toBe(
      240,
    );
    expect(first.items.every((i) => i.is_favorite)).toBe(true);
    expect(
      sort === "newest"
        ? first.items[0].created_at > next.items[0].created_at
        : first.items[0].created_at < next.items[0].created_at,
    ).toBe(true);
  }
  const start = performance.now();
  expect((await search.search("特別な検索語")).items).toHaveLength(1);
  expect(performance.now() - start).toBeLessThan(10000);
}, 20000);
