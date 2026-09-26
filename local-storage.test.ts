import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { activeWorkspace, closeDatabase, database } from "../src/local/db";
import { DATABASE_NAME, RESEARCH_STORES } from "../src/local/schema";
import { IndexedDbBlobFileStore } from "../src/local/files/IndexedDbBlobFileStore";
import { detectFileStore } from "../src/local/files/fileStore";
import { preflight, pressure } from "../src/local/storage/quota";
import { persistence } from "../src/local/storage/persistence";
import { OpfsFileStore } from "../src/local/files/OpfsFileStore";
afterEach(async () => {
  await closeDatabase();
  await deleteDB(DATABASE_NAME);
});
describe("local persistence", () => {
  it("verifies OPFS file bytes and rejects a partial write", async () => {
    let blob = new Blob(),
      truncate = false,
      closed = false;
    const handle = {
      createWritable: async () => ({
        write: async (value: Blob) => {
          blob = truncate ? value.slice(0, 1) : value;
        },
        close: async () => {
          closed = true;
        },
        abort: async () => {},
      }),
      getFile: async () => blob,
    };
    const dir = {
      getDirectoryHandle: async () => dir,
      getFileHandle: async () => handle,
      removeEntry: async () => {
        blob = new Blob();
      },
    };
    const opfs = new OpfsFileStore(dir as unknown as FileSystemDirectoryHandle),
      bytes = new Blob([new Uint8Array([0, 255, 100, 45])]);
    await opfs.write("workspace/image/original", bytes);
    expect(closed).toBe(true);
    expect(
      await (await opfs.read("workspace/image/original")).arrayBuffer(),
    ).toEqual(await bytes.arrayBuffer());
    truncate = true;
    await expect(opfs.write("workspace/image/original", bytes)).rejects.toThrow(
      "サイズ",
    );
    const unusable = {
      getDirectory: async () => {
        throw new DOMException("blocked", "NotSupportedError");
      },
    };
    expect((await detectFileStore(unusable)).backend).toBe("idb");
  });
  it("upgrades v1 without losing research or control data", async () => {
    const old = await openDB(DATABASE_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("control", { keyPath: "key" });
        db.createObjectStore("security", { keyPath: "key" });
        db.createObjectStore("files");
        for (const name of RESEARCH_STORES)
          db.createObjectStore(name, { keyPath: "id" }).createIndex(
            "workspace",
            "workspace_id",
          );
      },
    });
    await old.put("control", {
      key: "active_workspace_id",
      value: "preserved",
    });
    await old.put("cards", {
      id: "card",
      workspace_id: "preserved",
      prompt_full: "研究",
    });
    old.close();
    const db = await database();
    expect(await activeWorkspace()).toBe("preserved");
    expect((await db.get("cards", "card"))?.prompt_full).toBe("研究");
    expect(db.transaction("images").store.indexNames.contains("timeline")).toBe(
      true,
    );
  });
  it("initializes a stable UUID workspace concurrently and persists across reopen", async () => {
    const ids = await Promise.all([activeWorkspace(), activeWorkspace()]);
    expect(ids[0]).toBe(ids[1]);
    await closeDatabase();
    expect(await activeWorkspace()).toBe(ids[0]);
  });
  it("stores original bytes in fallback without encoding", async () => {
    const store = new IndexedDbBlobFileStore();
    const bytes = new Uint8Array([0, 255, 32, 123]);
    await store.write("original", new Blob([bytes]));
    expect(
      new Uint8Array(await (await store.read("original")).arrayBuffer()),
    ).toEqual(bytes);
    expect((await detectFileStore({} as StorageManager)).backend).toBe("idb");
  });
  it("reports persistence grant, denial, and unsupported", async () => {
    expect(
      await persistence(false, {
        persisted: async () => true,
      } as StorageManager),
    ).toBe("granted");
    expect(
      await persistence(true, {
        persist: async () => false,
        persisted: async () => false,
      }),
    ).toBe("denied");
    expect(await persistence(false, {} as StorageManager)).toBe("unsupported");
  });
  it("rejects insufficient quota before writes", async () => {
    await expect(
      preflight(100, { estimate: async () => ({ quota: 1000, usage: 900 }) }),
    ).rejects.toThrow("保存容量");
    expect([69, 70, 85, 95].map((n) => pressure(n, 100))).toEqual([
      "normal",
      "notice",
      "warning",
      "critical",
    ]);
  });
});
