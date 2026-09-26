import { imageRepository } from "../repository/imageRepository";
type Entry = { url: string; refs: number; used: number };
const urls = new Map<string, Entry>(),
  pending = new Map<string, Promise<Entry>>();
export async function acquireImageUrl(id: string, original = false) {
  const key = id + (original ? ":original" : ":thumbnail");
  let entry = urls.get(key);
  if (!entry) {
    let promise = pending.get(key);
    if (!promise) {
      promise = (
        original ? imageRepository.original(id) : imageRepository.thumbnail(id)
      )
        .then((blob) => {
          const value = {
            url: URL.createObjectURL(blob),
            refs: 0,
            used: Date.now(),
          };
          urls.set(key, value);
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, promise);
    }
    entry = await promise;
  }
  entry.refs++;
  entry.used = Date.now();
  let released = false;
  return {
    url: entry.url,
    release() {
      if (released) return;
      released = true;
      entry!.refs--;
      entry!.used = Date.now();
      if (original && entry!.refs === 0) {
        URL.revokeObjectURL(entry!.url);
        urls.delete(key);
      }
      trim();
    },
  };
}
function trim() {
  const inactive = [...urls.entries()]
    .filter(([, e]) => e.refs === 0)
    .sort((a, b) => a[1].used - b[1].used);
  while (urls.size > 80 && inactive.length) {
    const [key, e] = inactive.shift()!;
    URL.revokeObjectURL(e.url);
    urls.delete(key);
  }
}
export function clearImageUrls() {
  for (const e of urls.values()) URL.revokeObjectURL(e.url);
  urls.clear();
}
