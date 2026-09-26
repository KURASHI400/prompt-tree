export const CAPACITY_MESSAGE =
  "保存容量が不足しています。バックアップ後、不要な画像を削除してください。";
export function pressure(usage = 0, quota = 0) {
  const ratio = quota ? usage / quota : 0;
  return ratio >= 0.95
    ? "critical"
    : ratio >= 0.85
      ? "warning"
      : ratio >= 0.7
        ? "notice"
        : "normal";
}
export async function preflight(
  bytes: number,
  storage: Pick<StorageManager, "estimate"> | undefined = navigator.storage,
) {
  const estimate = (await storage?.estimate?.()) ?? {};
  if (
    estimate.quota &&
    (estimate.usage ?? 0) + bytes * 1.15 > estimate.quota * 0.95
  )
    throw new Error(CAPACITY_MESSAGE);
  return estimate;
}
export function storageError(error: unknown) {
  return error instanceof DOMException && error.name === "QuotaExceededError"
    ? new Error(CAPACITY_MESSAGE)
    : error;
}
