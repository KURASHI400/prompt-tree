import { t } from "./i18n/ja";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensors,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card, CardImage } from "./types";
import { Thumb } from "./Thumb";
import { cardRepository } from "./local/repository/cardRepository";
import { imageRepository } from "./local/repository/imageRepository";
import { uploadImage, thumbnail } from "./images";
import { changed } from "./useData";
import { ImageUndo } from "./ImageUndo";
function Small({ i }: { i: CardImage }) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: i.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Thumb id={i.id} />
    </div>
  );
}
export function ImageControls({
  card: c,
  refresh,
}: {
  card: Card;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(c.images[0]?.id),
    [deleted, setDeleted] = useState<string[]>([]),
    [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
  );
  const i = c.images.find((i) => i.id === selected) ?? c.images[0];
  async function run(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      await refresh();
      changed();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function reorder(e: DragEndEvent) {
    if (!e.over || e.over.id === e.active.id) return;
    const list = arrayMove(
      c.images,
      c.images.findIndex((i) => i.id === e.active.id),
      c.images.findIndex((i) => i.id === e.over!.id),
    );
    void run(() =>
      cardRepository.reorderImages(c.id, {
        ids: list.map((i) => i.id),
        expectedVersion: c.version,
      }),
    );
  }
  return (
    <details>
      <summary>{t("imagecontrols_116")}</summary>
      <DndContext sensors={sensors} onDragEnd={reorder}>
        <SortableContext
          items={c.images.map((i) => i.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="image-strip">
            {c.images.map((i) => (
              <Small key={i.id} i={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <small>{t("imagecontrols_117")}</small>
      <label>
        {t("imagecontrols_118")}
        <select value={i?.id} onChange={(e) => setSelected(e.target.value)}>
          {c.images.map((i, n) => (
            <option value={i.id} key={i.id}>
              {n + 1}. {i.original_filename}
            </option>
          ))}
        </select>
      </label>
      {i && (
        <div className="actions">
          {!i.thumbnail_key && (
            <button
              onClick={() =>
                void run(async () => {
                  const thumb = await thumbnail(
                    await imageRepository.original(i.id),
                  );
                  await imageRepository.retryThumbnail(i.id, thumb.blob);
                })
              }
            >
              {t("imagecontrols_120")}
            </button>
          )}
          <button
            onClick={() =>
              void run(() =>
                cardRepository.cover(c.id, {
                  image_id: i.id,
                  expectedVersion: c.version,
                }),
              )
            }
          >
            {c.cover_image_id === i.id
              ? t("imagecontrols_121")
              : t("imagecontrols_122")}
          </button>
          <button
            onClick={() =>
              void run(() =>
                imageRepository.favorite(i.id, {
                  is_favorite: !i.is_favorite,
                  expectedVersion: i.version,
                }),
              )
            }
          >
            {i.is_favorite ? t("imagecontrols_123") : t("imagecontrols_124")}
          </button>
          <button
            disabled={c.images.length === 1}
            onClick={() => {
              if (confirm(t("imagecontrols_125")))
                void run(async () => {
                  await imageRepository.remove(i.id);
                  setDeleted([i.id]);
                });
            }}
          >
            {t("imagecontrols_126")}
          </button>
          <label className="file-button">
            {t("imagecontrols_127")}
            <input
              type="file"
              accept="image/*,.heic,.heif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    const next = await uploadImage(c.id, file);
                    const fresh = await cardRepository.get(c.id);
                    if (c.cover_image_id === i.id)
                      await cardRepository.cover(c.id, {
                        image_id: next,
                        expectedVersion: fresh.version,
                      });
                    await imageRepository.remove(i.id);
                  });
              }}
            />
          </label>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <ImageUndo ids={deleted} clear={() => setDeleted([])} />
    </details>
  );
}
