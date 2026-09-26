export type FileBackend = "opfs" | "idb";
export interface LocalFileStore {
  readonly backend: FileBackend;
  write(path: string, blob: Blob): Promise<void>;
  read(path: string): Promise<Blob>;
  remove(path: string): Promise<void>;
}
export function imagePath(
  workspace: string,
  card: string,
  image: string,
  thumbnail = false,
) {
  if (![workspace, card, image].every((s) => /^[a-zA-Z0-9-]+$/.test(s)))
    throw new Error("Invalid file identity");
  return `prompt-tree/workspaces/${workspace}/cards/${card}/images/${image}/${thumbnail ? "thumbnail.webp" : "original"}`;
}
