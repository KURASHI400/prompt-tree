import type { LocalFileStore } from "./LocalFileStore";
export class OpfsFileStore implements LocalFileStore {
  readonly backend = "opfs" as const;
  constructor(private root: FileSystemDirectoryHandle) {}
  private async directory(path: string, create: boolean) {
    const parts = path.split("/");
    if (parts.some((p) => !p || p === "." || p === ".."))
      throw new Error("Invalid file path");
    const name = parts.pop()!;
    let dir = this.root;
    for (const part of parts)
      dir = await dir.getDirectoryHandle(part, { create });
    return { dir, name };
  }
  async write(path: string, blob: Blob) {
    const { dir, name } = await this.directory(path, true);
    const handle = await dir.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    try {
      await writer.write(blob);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
    if ((await handle.getFile()).size !== blob.size)
      throw new Error("保存サイズの検証に失敗しました");
  }
  async read(path: string) {
    const { dir, name } = await this.directory(path, false);
    return (await dir.getFileHandle(name)).getFile();
  }
  async remove(path: string) {
    try {
      const { dir, name } = await this.directory(path, false);
      await dir.removeEntry(name);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "NotFoundError")) throw e;
    }
  }
}
