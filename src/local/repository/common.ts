import type { IDBPTransaction } from "idb";
import { activeWorkspace, database } from "../db";
import { RESEARCH_STORES, type LocalSchema, type LocalCard } from "../schema";
import { normalize } from "../../domain";
export const WRITE_STORES = [...RESEARCH_STORES, "control"] as const;
export type WriteTx = IDBPTransaction<
  LocalSchema,
  typeof WRITE_STORES,
  "readwrite"
>;
export async function write<T>(
  operation: (tx: WriteTx, workspace: string) => Promise<T>,
): Promise<T> {
  const workspace = await activeWorkspace();
  const db = await database();
  const tx = db.transaction(WRITE_STORES, "readwrite");
  try {
    if (
      (await tx.objectStore("control").get("active_workspace_id"))?.value !==
      workspace
    )
      throw new Error("保存領域が変更されました。再読み込みしてください");
    const result = await operation(tx, workspace);
    const record = await tx.objectStore("control").get("revision");
    await tx
      .objectStore("control")
      .put({ key: "revision", value: Number(record?.value ?? 0) + 1 });
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
export function requireRecord<
  T extends { workspace_id: string; deleted_at?: number | null },
>(record: T | undefined, workspace: string, deleted = false): T {
  if (
    !record ||
    record.workspace_id !== workspace ||
    (!deleted && record.deleted_at)
  )
    throw new Error("データが見つかりません");
  return record;
}
export function version(record: { version: number }, expected?: number) {
  if (expected !== undefined && expected !== record.version)
    throw new Error("データが変更されています。再読み込みしてください");
}
export async function uniqueId(
  tx: WriteTx,
  workspace: string,
  label: string,
  except?: string,
) {
  if (!label.trim() || label.length > 100)
    throw new Error("IDは1〜100文字で入力してください");
  const cards = await tx
    .objectStore("cards")
    .index("workspace")
    .getAll(workspace);
  if (
    cards.some(
      (c) => c.id !== except && normalize(c.display_id) === normalize(label),
    )
  )
    throw new Error("このIDは既に使われています");
}
export async function detail(
  tx: WriteTx,
  workspace: string,
  id: string,
): Promise<LocalCard> {
  const c = requireRecord(await tx.objectStore("cards").get(id), workspace);
  const images = (
    await tx.objectStore("images").index("card").getAll([workspace, id])
  )
    .filter((i) => !i.deleted_at && i.upload_status === "ready")
    .sort((a, b) => a.sort_order - b.sort_order);
  return { ...c, images };
}
