import type {
  LocalCard,
  LocalEdge,
  LocalImage,
  LocalSeries,
  ValueRecord,
} from "../schema";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_PART_TARGET_BYTES = 16 * 1024 * 1024;
export const BACKUP_CHUNK_BYTES = 4 * 1024 * 1024;
export interface BackupData {
  series: LocalSeries[];
  cards: LocalCard[];
  images: LocalImage[];
  edges: LocalEdge[];
  tags: ValueRecord[];
  cardTags: ValueRecord[];
  settings: ValueRecord[];
}
export interface OriginalEntry {
  id: string;
  size: number;
  sha256: string;
  chunks: { part: number; path: string; size: number }[];
}
export interface Manifest {
  backup_format_version: number;
  app_version: string;
  backup_id: string;
  created_at: number;
  workspace_id_original: string;
  total_parts: number;
  counts: Record<keyof BackupData, number>;
  total_original_bytes: number;
  originals: OriginalEntry[];
  data_sha256: string;
  metadata_chunks?: { part: number; path: string; size: number }[];
}
export interface BackupPart {
  file: File;
  number: number;
  total: number;
  revision: number;
  backupId: string;
}
