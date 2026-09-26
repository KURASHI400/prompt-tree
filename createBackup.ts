import { strToU8, zipSync } from "fflate";
import { activeWorkspace, database } from "../db";
import { fileStore } from "../files/fileStore";
import { APP_VERSION } from "../../config";
import { sha256 } from "./hash";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_PART_TARGET_BYTES,
  BACKUP_CHUNK_BYTES,
  type BackupData,
  type Manifest,
  type BackupPart,
} from "./backupFormat";
export async function snapshot() {
  const w = await activeWorkspace(),
    db = await database(),
    tx = db.transaction([
      "series",
      "cards",
      "images",
      "edges",
      "tags",
      "cardTags",
      "settings",
      "control",
    ]);
  const cards = (
    await tx.objectStore("cards").index("workspace").getAll(w)
  ).filter((c) => !c.deleted_at && c.status === "ready");
  const ids = new Set(cards.map((c) => c.id));
  const data: BackupData = {
    cards,
    series: (
      await tx.objectStore("series").index("workspace").getAll(w)
    ).filter((s) => !s.deleted_at && ids.has(s.root_card_id)),
    images: (
      await tx.objectStore("images").index("workspace").getAll(w)
    ).filter(
      (i) => !i.deleted_at && i.upload_status === "ready" && ids.has(i.card_id),
    ),
    edges: (await tx.objectStore("edges").index("workspace").getAll(w)).filter(
      (e) =>
        !e.deleted_at && ids.has(e.source_card_id) && ids.has(e.target_card_id),
    ),
    tags: await tx.objectStore("tags").index("workspace").getAll(w),
    cardTags: (
      await tx.objectStore("cardTags").index("workspace").getAll(w)
    ).filter((row) => ids.has((row.value as { card: string }).card)),
    settings: await tx.objectStore("settings").index("workspace").getAll(w),
  };
  const revision = Number(
    (await tx.objectStore("control").get("revision"))?.value ?? 0,
  );
  await tx.done;
  return { w, data, revision };
}
export async function* createBackup(
  progress: (text: string) => void = () => {},
  target = BACKUP_PART_TARGET_BYTES,
): AsyncGenerator<BackupPart> {
  const { w, data, revision } = await snapshot(),
    backupId = crypto.randomUUID(),
    created = Date.now();
  const metadata = strToU8(JSON.stringify(data));
  const manifest: Manifest = {
    backup_format_version: BACKUP_FORMAT_VERSION,
    app_version: APP_VERSION,
    backup_id: backupId,
    created_at: created,
    workspace_id_original: w,
    total_parts: 1,
    counts: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.length]),
    ) as Manifest["counts"],
    total_original_bytes: data.images.reduce((n, i) => n + i.file_size, 0),
    originals: [],
    data_sha256: await sha256(new Blob([metadata as Uint8Array<ArrayBuffer>])),
  };
  let part = 1,
    size = Math.min(target / 2, Math.max(1024, data.images.length * 512));
  const chunkSize = Math.min(BACKUP_CHUNK_BYTES, Math.floor(target / 4));
  if (metadata.length > target / 2) {
    manifest.metadata_chunks = [];
    for (
      let offset = 0, index = 0;
      offset < metadata.length;
      offset += chunkSize, index++
    ) {
      const bytes = Math.min(chunkSize, metadata.length - offset);
      if (size + bytes > target) {
        part++;
        size = 0;
      }
      manifest.metadata_chunks.push({
        part,
        path: `metadata/${index}`,
        size: bytes,
      });
      size += bytes + 200;
    }
  } else size += metadata.length;
  for (const [n, i] of data.images.entries()) {
    progress(`Original検証 ${n + 1} / ${data.images.length}`);
    const original = await (await fileStore(i.backend)).read(i.original_key);
    if (original.size !== i.file_size)
      throw new Error("Originalが不足しています: " + i.original_filename);
    const entry = {
      id: i.id,
      size: i.file_size,
      sha256: await sha256(original),
      chunks: [] as { part: number; path: string; size: number }[],
    };
    for (
      let offset = 0, index = 0;
      offset < i.file_size;
      offset += chunkSize, index++
    ) {
      const bytes = Math.min(chunkSize, i.file_size - offset);
      if (size + bytes > target) {
        part++;
        size = 0;
      }
      entry.chunks.push({ part, path: `images/${i.id}/${index}`, size: bytes });
      size += bytes + 200;
    }
    manifest.originals.push(entry);
  }
  manifest.total_parts = part;
  for (let n = 1; n <= part; n++) {
    const files: Record<string, Uint8Array> = {
      "part.json": strToU8(
        JSON.stringify({
          backup_id: backupId,
          part_number: n,
          total_parts: part,
        }),
      ),
    };
    if (n === 1) {
      files["manifest.json"] = strToU8(JSON.stringify(manifest));
      files["data.json"] = manifest.metadata_chunks
        ? strToU8(JSON.stringify({ chunked: true }))
        : metadata;
    }
    let metadataOffset = 0;
    for (const chunk of manifest.metadata_chunks ?? []) {
      if (chunk.part === n)
        files[chunk.path] = metadata.slice(
          metadataOffset,
          metadataOffset + chunk.size,
        );
      metadataOffset += chunk.size;
    }
    for (const entry of manifest.originals) {
      let offset = 0;
      for (const chunk of entry.chunks) {
        if (chunk.part === n) {
          const i = data.images.find((i) => i.id === entry.id)!;
          const blob = await (await fileStore(i.backend)).read(i.original_key);
          files[chunk.path] = new Uint8Array(
            await blob.slice(offset, offset + chunk.size).arrayBuffer(),
          );
        }
        offset += chunk.size;
      }
    }
    progress(`Part ${n} / ${part} を作成`);
    const bytes = zipSync(files, { level: 0 });
    yield {
      file: new File(
        [bytes as Uint8Array<ArrayBuffer>],
        `PromptTree_${new Date(created).toISOString().slice(0, 10)}_part${String(n).padStart(3, "0")}.ptbackup`,
        { type: "application/zip" },
      ),
      number: n,
      total: part,
      revision,
      backupId,
    };
  }
}
export async function markBackupSaved(revision: number) {
  await (
    await database()
  ).put("control", { key: "last_backup", value: { at: Date.now(), revision } });
}
