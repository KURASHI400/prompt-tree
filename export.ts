import { strToU8, zipSync } from "fflate";
import { imageRepository } from "./local/repository/imageRepository";
import { cardRepository } from "./local/repository/cardRepository";
export interface ExportPart {
  url: string;
  count: number;
  bytes: number;
}
export async function exportSelection(
  ids: string[],
  progress: (text: string) => void,
): Promise<ExportPart[]> {
  const parts: ExportPart[] = [];
  let files: Record<string, Uint8Array> = {},
    size = 0,
    count = 0;
  function flush() {
    if (!count) return;
    const bytes = zipSync(files, { level: 0 });
    parts.push({
      url: URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/zip",
        }),
      ),
      count,
      bytes: size,
    });
    files = {};
    size = 0;
    count = 0;
  }
  try {
    for (const [n, id] of ids.entries()) {
      progress(`${n + 1} / ${ids.length} 枚を書き出し中`);
      const i = await imageRepository.get(id),
        blob = await imageRepository.original(id),
        c = await cardRepository.get(i.card_id);
      if (size + blob.size > 16 * 1024 * 1024) flush();
      files[id + "/original"] = new Uint8Array(await blob.arrayBuffer());
      files[id + "/card.json"] = strToU8(JSON.stringify(c));
      size += blob.size;
      count++;
    }
    flush();
    return parts;
  } catch (e) {
    for (const p of parts) URL.revokeObjectURL(p.url);
    throw e;
  }
}
