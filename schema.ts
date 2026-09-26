import type { DBSchema } from "idb";
import type { Card, CardImage, Edge, Series } from "../types";
export type Scoped<T> = T & {
  workspace_id: string;
  deleted_at?: number | null;
};
export type LocalSeries = Scoped<Series>;
export type LocalCard = Scoped<Card>;
export type LocalImage = Scoped<CardImage> & {
  backend: "opfs" | "idb";
  is_root: boolean;
};
export type LocalEdge = Scoped<Edge>;
export interface ValueRecord {
  id: string;
  workspace_id: string;
  value: unknown;
}
type EntityStore<T> = { key: string; value: T; indexes: { workspace: string } };
export interface LocalSchema extends DBSchema {
  control: { key: string; value: { key: string; value: unknown } };
  security: { key: string; value: { key: string; value: unknown } };
  series: EntityStore<LocalSeries>;
  cards: EntityStore<LocalCard>;
  images: {
    key: string;
    value: LocalImage;
    indexes: {
      workspace: string;
      timeline: [string, number, string];
      card: [string, string];
      series: [string, string, number, string];
    };
  };
  edges: EntityStore<LocalEdge>;
  settings: EntityStore<ValueRecord>;
  tags: EntityStore<ValueRecord>;
  cardTags: EntityStore<ValueRecord>;
  drafts: EntityStore<ValueRecord>;
  searchMeta: EntityStore<ValueRecord>;
  cleanupQueue: EntityStore<ValueRecord>;
  files: { key: string; value: Blob | { bytes: ArrayBuffer; type: string } };
}
export const RESEARCH_STORES = [
  "series",
  "cards",
  "images",
  "edges",
  "settings",
  "tags",
  "cardTags",
  "drafts",
  "searchMeta",
  "cleanupQueue",
] as const;
export const DATABASE_NAME = "prompt-tree-local";
export const DATABASE_VERSION = 2;
