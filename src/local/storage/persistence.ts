export type Persistence = "granted" | "denied" | "unsupported";
export async function persistence(
  request = false,
  storage:
    | Pick<StorageManager, "persist" | "persisted">
    | undefined = navigator.storage,
): Promise<Persistence> {
  if (!storage?.persisted || (request && !storage.persist))
    return "unsupported";
  try {
    return (request ? await storage.persist() : await storage.persisted())
      ? "granted"
      : "denied";
  } catch {
    return "unsupported";
  }
}
