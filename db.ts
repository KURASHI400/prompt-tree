import {
  openDB,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from "idb";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  RESEARCH_STORES,
  type LocalSchema,
} from "./schema";
export function upgrade(
  db: IDBPDatabase<LocalSchema>,
  oldVersion: number,
  _newVersion: number | null,
  tx: IDBPTransaction<LocalSchema, StoreNames<LocalSchema>[], "versionchange">,
) {
  if (oldVersion < 1) {
    db.createObjectStore("control", { keyPath: "key" });
    db.createObjectStore("security", { keyPath: "key" });
    db.createObjectStore("files");
    for (const name of RESEARCH_STORES) {
      const store = db.createObjectStore(name, { keyPath: "id" });
      store.createIndex("workspace", "workspace_id");
    }
  }
  if (oldVersion < 2) {
    const store = tx.objectStore("images");
    store.createIndex("timeline", ["workspace_id", "created_at", "id"]);
    store.createIndex("card", ["workspace_id", "card_id"]);
    store.createIndex("series", [
      "workspace_id",
      "series_id",
      "created_at",
      "id",
    ]);
  }
}
let connection: Promise<IDBPDatabase<LocalSchema>> | undefined;
export function database() {
  return (connection ??= openDB<LocalSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade,
    blocking() {
      void connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }));
}
export async function activeWorkspace() {
  const db = await database();
  const tx = db.transaction("control", "readwrite");
  let record = await tx.store.get("active_workspace_id");
  if (!record) {
    record = { key: "active_workspace_id", value: crypto.randomUUID() };
    await tx.store.put(record);
  }
  await tx.done;
  return record.value as string;
}
export async function closeDatabase() {
  (await connection)?.close();
  connection = undefined;
}
