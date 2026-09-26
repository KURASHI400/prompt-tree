export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}
export interface Series {
  id: string;
  root_card_id: string;
  sort_order: number;
  next_card_number: number;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  version: number;
  display_id: string;
  title: string;
  cover_image_id: string;
  image_count: number;
}
export interface Card {
  id: string;
  series_id: string;
  display_id: string;
  title: string;
  prompt_full: string;
  prompt_delta: string;
  memo: string;
  ai_provider: string;
  model: string;
  rating: number | null;
  metadata_json: string;
  cover_image_id: string | null;
  canvas_x: number;
  canvas_y: number;
  auto_number: number | null;
  version: number;
  created_at: number;
  deleted_at: number | null;
  status: string;
  images: CardImage[];
  tags: string[];
  is_root: boolean;
}
export interface CardImage {
  id: string;
  card_id: string;
  series_id?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  sort_order: number;
  is_favorite: number;
  upload_status: string;
  version: number;
  created_at: number;
  original_key: string;
  thumbnail_key: string | null;
}
export interface Edge {
  id: string;
  series_id: string;
  source_card_id: string;
  target_card_id: string;
  kind: "parent" | "reference";
  is_primary: number;
  color: string;
  version: number;
  deleted_primary?: number;
}
export interface TreeNode {
  id: string;
  display_id: string;
  cover_image_id: string;
  canvas_x: number;
  canvas_y: number;
  image_count: number;
}
export interface TreeData {
  series: Series;
  nodes: TreeNode[];
  edges: Edge[];
}
export interface Page<T> {
  items: T[];
  cursor: string | null;
}
