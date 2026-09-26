import { t } from "./i18n/ja";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Series } from "./types";
import { useData, changed } from "./useData";
import { seriesRepository } from "./local/repository/seriesRepository";
import { Thumb } from "./Thumb";
import { BackupReminder } from "./BackupReminder";
import { useState } from "react";
import { ActionDialog } from "./ActionDialog";
import { useDeletion } from "./Deletion";
function SeriesTile({
  series,
  onOpen,
  onEdit,
}: {
  series: Series;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const requestDelete = useDeletion();
  const [menu, setMenu] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: series.id });
  return (
    <div
      className="series-tile-wrap"
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <button
        aria-label={
          series.title
            ? `${series.display_id} ${series.title}`
            : series.display_id
        }
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className="series-tile"
      >
        <Thumb
          id={series.cover_image_id}
          alt={series.title || series.display_id}
        />
        <span className="tile-caption">
          <b>{series.display_id}</b>
          {series.title && <span>{series.title}</span>}
        </span>
      </button>
      <button
        className="more-button tile-more"
        aria-label={series.display_id + "の操作メニュー"}
        aria-haspopup="dialog"
        onClick={() => setMenu(true)}
      >
        …
      </button>
      {menu && (
        <ActionDialog
          title={series.display_id + "の操作メニュー"}
          onClose={() => setMenu(false)}
        >
          <div className="action-menu">
            <button
              onClick={() => {
                setMenu(false);
                onOpen();
              }}
            >
              詳細を見る
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onEdit();
              }}
            >
              編集
            </button>
            <hr />
            <button
              className="danger"
              onClick={() => {
                setMenu(false);
                requestDelete({
                  id: series.root_card_id,
                  series_id: series.id,
                  is_root: true,
                });
              }}
            >
              シリーズを削除
            </button>
            <button onClick={() => setMenu(false)}>キャンセル</button>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
export default function Home() {
  const { data, error, setData } = useData<Series[]>("series", () =>
    seriesRepository.list(),
  );
  const navigate = useNavigate(),
    location = useLocation();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  async function reorder(e: DragEndEvent) {
    if (!data || !e.over || e.active.id === e.over.id) return;
    const before = data;
    const next = arrayMove(
      data,
      data.findIndex((s) => s.id === e.active.id),
      data.findIndex((s) => s.id === e.over!.id),
    );
    setData(next);
    try {
      await seriesRepository.reorder({ ids: next.map((s) => s.id) });
      changed();
    } catch {
      setData(before);
    }
  }
  return (
    <main className="page home">
      <BackupReminder />
      <div className="section-title">
        <div>
          <p className="eyebrow">COLLECTIONS</p>
          <h2>{t("home_111")}</h2>
        </div>
        <span>
          {data?.length ?? 0}
          {t("home_112")}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>{t("app_003")}</p>}
      {data?.length === 0 && (
        <div className="empty">
          <h2>{t("home_113")}</h2>
          <p>
            {t("home_114")}
            <br />
            {t("home_115")}
          </p>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void reorder(e)}
      >
        <SortableContext
          items={data?.map((s) => s.id) ?? []}
          strategy={rectSortingStrategy}
        >
          <div className="home-grid">
            {data?.map((series) => (
              <SeriesTile
                key={series.id}
                series={series}
                onEdit={() =>
                  navigate("/new?edit=" + series.root_card_id, {
                    state: { background: location },
                  })
                }
                onOpen={() =>
                  navigate(`/cards/${series.root_card_id}`, {
                    state: { background: location },
                  })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        className="fab primary"
        aria-label={t("editor_061")}
        onClick={() => navigate("/new", { state: { background: location } })}
      >
        ＋
      </button>
    </main>
  );
}
