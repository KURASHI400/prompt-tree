import { unzipSync, strFromU8 } from "fflate";
import { z } from "zod";
import { wouldCycle, normalize } from "../../domain";
import { sha256 } from "./hash";
import { MAX_IMAGE_BYTES } from "../../config";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_PART_TARGET_BYTES,
  type Manifest,
  type BackupData,
} from "./backupFormat";
const header = z.object({
  backup_id: z.string().uuid(),
  part_number: z.number().int().positive(),
  total_parts: z.number().int().positive().max(100000),
});
export async function readPart(file: File) {
  if (file.size > BACKUP_PART_TARGET_BYTES * 2)
    throw new Error("バックアップPartが大きすぎます");
  let total = 0;
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      total += entry.originalSize;
      if (total > BACKUP_PART_TARGET_BYTES * 2)
        throw new Error("展開サイズが上限を超えています");
      return true;
    },
  });
  const part = header.parse(JSON.parse(strFromU8(zip["part.json"])));
  return { zip, part };
}
export async function validateBackup(files: File[]) {
  if (!files.length) throw new Error("バックアップPartを選択してください");
  const parts = new Map<number, File>();
  let identity = "",
    count = 0,
    manifest: Manifest | undefined,
    metadata: Uint8Array | undefined;
  for (const file of files) {
    const { zip, part } = await readPart(file);
    if (identity && (identity !== part.backup_id || count !== part.total_parts))
      throw new Error("異なるバックアップのPartが混在しています");
    identity = part.backup_id;
    count = part.total_parts;
    if (parts.has(part.part_number)) throw new Error("Partが重複しています");
    parts.set(part.part_number, file);
    if (part.part_number === 1) {
      manifest = JSON.parse(strFromU8(zip["manifest.json"]));
      metadata = zip["data.json"];
    }
  }
  if (
    !manifest ||
    !metadata ||
    count !== parts.size ||
    Array.from({ length: count }, (_, i) => i + 1).some((n) => !parts.has(n))
  )
    throw new Error("必要なPartが不足しています");
  if (
    manifest.backup_format_version !== BACKUP_FORMAT_VERSION ||
    manifest.backup_id !== identity ||
    manifest.total_parts !== count
  )
    throw new Error("バックアップ形式が不正です");
  if (manifest.metadata_chunks) {
    const chunks: BlobPart[] = [];
    for (const chunk of manifest.metadata_chunks) {
      if (
        !parts.has(chunk.part) ||
        !chunk.path.startsWith("metadata/") ||
        !Number.isSafeInteger(chunk.size) ||
        chunk.size <= 0
      )
        throw new Error("メタデータPartが不正です");
      const { zip } = await readPart(parts.get(chunk.part)!);
      const bytes = zip[chunk.path];
      if (!bytes || bytes.length !== chunk.size)
        throw new Error("メタデータPartが不足しています");
      chunks.push(bytes as Uint8Array<ArrayBuffer>);
    }
    metadata = new Uint8Array(await new Blob(chunks).arrayBuffer());
  }
  if (
    (await sha256(new Blob([metadata as Uint8Array<ArrayBuffer>]))) !==
    manifest.data_sha256
  )
    throw new Error("メタデータの検証に失敗しました");
  const data = JSON.parse(strFromU8(metadata)) as BackupData;
  validateData(data, manifest);
  return { manifest, data, parts };
}
export function validateData(data: BackupData, m: Manifest) {
  const keys = [
    "series",
    "cards",
    "images",
    "edges",
    "tags",
    "cardTags",
    "settings",
  ] as const;
  for (const key of keys) {
    if (!Array.isArray(data[key]) || data[key].length !== m.counts[key])
      throw new Error("データ件数が一致しません");
    const ids = new Set<string>();
    for (const r of data[key]) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !r.id ||
        ids.has(r.id) ||
        r.workspace_id !== m.workspace_id_original
      )
        throw new Error("データ識別子が不正です");
      ids.add(r.id);
    }
  }
  const cards = new Map(data.cards.map((c) => [c.id, c])),
    series = new Map(data.series.map((s) => [s.id, s])),
    images = new Map(data.images.map((i) => [i.id, i])),
    labels = new Set<string>();
  for (const c of data.cards) {
    if (
      !series.has(c.series_id) ||
      typeof c.display_id !== "string" ||
      labels.has(normalize(c.display_id)) ||
      !Array.isArray(c.tags) ||
      !c.tags.every((t) => typeof t === "string") ||
      ![c.canvas_x, c.canvas_y].every(Number.isFinite) ||
      c.status !== "ready" ||
      [
        c.title,
        c.prompt_full,
        c.prompt_delta,
        c.memo,
        c.ai_provider,
        c.model,
        c.metadata_json,
      ].some((v) => typeof v !== "string")
    )
      throw new Error("Cardが不正です");
    JSON.parse(c.metadata_json);
    labels.add(normalize(c.display_id));
    if (!c.cover_image_id || images.get(c.cover_image_id)?.card_id !== c.id)
      throw new Error("Cardの画像が不足しています");
  }
  for (const s of data.series) {
    const root = cards.get(s.root_card_id);
    if (
      !root?.is_root ||
      root.series_id !== s.id ||
      ![s.viewport_x, s.viewport_y, s.viewport_zoom, s.next_card_number].every(
        Number.isFinite,
      ) ||
      s.viewport_zoom <= 0
    )
      throw new Error("Seriesが不正です");
  }
  for (const i of data.images)
    if (
      !cards.has(i.card_id) ||
      i.series_id !== cards.get(i.card_id)?.series_id ||
      !Number.isSafeInteger(i.file_size) ||
      i.file_size <= 0 ||
      i.file_size > MAX_IMAGE_BYTES ||
      typeof i.original_filename !== "string"
    )
      throw new Error("画像が不正です");
  const edges: typeof data.edges = [];
  const primaries = new Set<string>();
  for (const e of data.edges) {
    const a = cards.get(e.source_card_id),
      b = cards.get(e.target_card_id);
    if (
      !a ||
      !b ||
      a.id === b.id ||
      a.series_id !== b.series_id ||
      e.series_id !== a.series_id ||
      !["parent", "reference"].includes(e.kind)
    )
      throw new Error("接続が不正です");
    if (e.kind === "parent") {
      if (b.is_root || wouldCycle(edges, a.id, b.id))
        throw new Error("親接続が循環します");
      if (e.is_primary && primaries.has(b.id))
        throw new Error("Primary Parentが重複しています");
      if (e.is_primary) primaries.add(b.id);
    }
    edges.push(e);
  }
  if (
    !Array.isArray(m.originals) ||
    m.originals.length !== data.images.length ||
    new Set(m.originals.map((i) => i.id)).size !== m.originals.length
  )
    throw new Error("Original一覧が不正です");
  for (const entry of m.originals) {
    if (
      images.get(entry.id)?.file_size !== entry.size ||
      !/^([0-9a-f]{64})$/.test(entry.sha256) ||
      !Array.isArray(entry.chunks) ||
      entry.chunks.reduce((n, c) => n + c.size, 0) !== entry.size ||
      entry.chunks.some(
        (c) =>
          !Number.isInteger(c.part) ||
          c.part < 1 ||
          c.part > m.total_parts ||
          !c.path.startsWith("images/" + entry.id + "/") ||
          !Number.isSafeInteger(c.size) ||
          c.size <= 0,
      )
    )
      throw new Error("Original情報が不正です");
  }
  if (m.total_original_bytes !== m.originals.reduce((n, i) => n + i.size, 0))
    throw new Error("Original容量が一致しません");
}
