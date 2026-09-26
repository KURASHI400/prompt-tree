import { t } from "./i18n/ja";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Card, CardImage, Series } from "./types";
import { imageRepository } from "./local/repository/imageRepository";
import { cardRepository } from "./local/repository/cardRepository";
import type { ExportPart } from "./export";
import { useData, changed } from "./useData";
import { Thumb } from "./Thumb";
import { ImageUndo } from "./ImageUndo";
import { seriesRepository } from "./local/repository/seriesRepository";
const Viewer = lazy(() => import("./Viewer"));
export default function Gallery() {
  const initial = JSON.parse(sessionStorage.getItem("gallery-filters") ?? "{}");
  const [series, setSeries] = useState(initial.series ?? ""),
    [type, setType] = useState(initial.type ?? "all"),
    [sort, setSort] = useState(initial.sort ?? "newest"),
    [items, setItems] = useState<CardImage[]>([]),
    [cursor, setCursor] = useState<string | null>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState(new Set<string>()),
    [viewer, setViewer] = useState<{ images: CardImage[]; start: number }>(),
    [width, setWidth] = useState(innerWidth),
    [exports, setExports] = useState<ExportPart[]>([]),
    [destination, setDestination] = useState("");
  const [deleted, setDeleted] = useState<string[]>([]);
  const { data: collections } = useData<Series[]>("series", () =>
    seriesRepository.list(),
  );
  const scroll = useRef<HTMLDivElement>(null),
    loadedCount = useRef(0),
    loading = useRef(false),
    generation = useRef(0);
  const location = useLocation();
  const query = `series=${series}&type=${type}&sort=${sort}`;
  const load = useCallback(
    async (next?: string | null) => {
      if (loading.current) return;
      loading.current = true;
      setBusy(true);
      const current = generation.current;
      try {
        const result = await imageRepository.list({
          series,
          type,
          sort,
          cursor: next,
        });
        if (!next) {
          while (result.cursor && result.items.length < loadedCount.current) {
            const more = await imageRepository.list({
              series,
              type,
              sort,
              cursor: result.cursor,
            });
            result.items.push(...more.items);
            result.cursor = more.cursor;
          }
        }
        if (current !== generation.current) return;
        setItems((previous) =>
          next
            ? [
                ...previous,
                ...result.items.filter(
                  (i) => !previous.some((p) => p.id === i.id),
                ),
              ]
            : result.items,
        );
        setCursor(result.cursor);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        loading.current = false;
        setBusy(false);
      }
    },
    [query],
  );
  useEffect(() => {
    generation.current++;
    loadedCount.current = 0;
    loading.current = false;
    setItems([]);
    setCursor(undefined);
    setSelected(new Set());
    void load();
    sessionStorage.setItem(
      "gallery-filters",
      JSON.stringify({ series, type, sort }),
    );
  }, [load, series, type, sort]);
  useEffect(() => {
    loadedCount.current = items.length;
  }, [items.length]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("data-changed", refresh);
    return () => window.removeEventListener("data-changed", refresh);
  }, [load]);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const columns = width >= 700 ? 6 : width >= 500 ? 4 : 3,
    cell = width / columns;
  const virtual = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => scroll.current,
    estimateSize: () => cell,
    overscan: 3,
  });
  const rows = virtual.getVirtualItems(),
    last = rows.at(-1)?.index ?? 0;
  useEffect(() => {
    if (cursor && !busy && last >= Math.ceil(items.length / columns) - 6)
      void load(cursor);
  }, [last, cursor, busy, items.length, columns, load]);
  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      changed();
      setSelected(new Set());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="gallery-page">
      <div className="gallery-header">
        <div className="section-title">
          <h2>{t("app_006")}</h2>
          <button
            onClick={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
          >
            {selecting ? t("gallery_087") : t("gallery_088")}
          </button>
        </div>
        <div className="chips">
          <button
            className={!series ? "selected" : ""}
            onClick={() => setSeries("")}
          >
            {t("gallery_089")}
          </button>
          {collections?.map((s) => (
            <button
              className={series === s.id ? "selected" : ""}
              key={s.id}
              onClick={() => setSeries(s.id)}
            >
              {s.display_id.replace(/-000$/, "")}
            </button>
          ))}
        </div>
        <div className="filters">
          <select
            aria-label={t("gallery_090")}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">{t("gallery_089")}</option>
            <option value="root">{t("gallery_091")}</option>
            <option value="child">{t("detail_045")}</option>
            <option value="favorite">{t("gallery_092")}</option>
          </select>
          <select
            aria-label={t("gallery_093")}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">{t("gallery_094")}</option>
            <option value="oldest">{t("gallery_095")}</option>
            <option value="series">{t("gallery_096")}</option>
          </select>
        </div>
        {error && <p role="alert">{error}</p>}
        {selecting && (
          <div className="selection-tools">
            <span>
              {selected.size}
              {t("gallery_097")}
            </span>
            <button
              disabled={!selected.size}
              onClick={() => {
                if (confirm(t("gallery_098")))
                  void act(async () => {
                    await imageRepository.bulkDelete({
                      ids: [...selected],
                    });
                    setDeleted([...selected]);
                  });
              }}
            >
              {t("gallery_099")}
            </button>
            <button
              disabled={!selected.size}
              onClick={() =>
                void act(async () => {
                  const { exportSelection } = await import("./export");
                  setExports(await exportSelection([...selected], setError));
                })
              }
            >
              {t("gallery_100")}
            </button>
            <select
              aria-label={t("gallery_101")}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">{t("gallery_102")}</option>
              {collections?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_id}
                </option>
              ))}
            </select>
            <button
              disabled={!destination || !selected.size}
              onClick={() =>
                void act(async () => {
                  const cards: Card[] = [];
                  for (const id of new Set(
                    items
                      .filter((i) => selected.has(i.id))
                      .map((i) => i.card_id),
                  )) {
                    const c = await cardRepository.get(id);
                    if (c.images.some((i) => !selected.has(i.id)))
                      throw new Error(t("gallery_103"));
                    if (c.is_root) throw new Error(t("gallery_104"));
                    cards.push(c);
                  }
                  if (!confirm(t("gallery_105"))) return;
                  for (const c of cards)
                    await cardRepository.move(c.id, {
                      series_id: destination,
                      expectedVersion: c.version,
                    });
                })
              }
            >
              {t("gallery_106")}
            </button>
          </div>
        )}
      </div>
      {exports.length > 0 && (
        <div className="export-links">
          {exports.map((part, n) => (
            <a
              key={part.url}
              className="download-button"
              href={part.url}
              download
            >
              Part {n + 1} — {part.count}
              {t("gallery_107")}
            </a>
          ))}
        </div>
      )}
      <div ref={scroll} className="gallery-scroll" data-testid="gallery-scroll">
        <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
          {rows.map((row) => (
            <div
              key={row.key}
              className="photo-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: cell - 2,
                transform: `translateY(${row.start}px)`,
                gridTemplateColumns: `repeat(${columns},1fr)`,
              }}
            >
              {items
                .slice(row.index * columns, (row.index + 1) * columns)
                .map((i, n) => (
                  <button
                    className={`photo-cell ${selected.has(i.id) ? "chosen" : ""}`}
                    data-testid="image-cell"
                    key={i.id}
                    aria-label={`画像 ${row.index * columns + n + 1}${i.is_favorite ? t("gallery_108") : ""}`}
                    onClick={() => {
                      if (selecting)
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(i.id)) next.delete(i.id);
                          else next.add(i.id);
                          return next;
                        });
                      else
                        setViewer({
                          images: items,
                          start: row.index * columns + n,
                        });
                    }}
                  >
                    <Thumb id={i.id} alt={i.original_filename} />
                    {i.is_favorite === 1 && <span>♥</span>}
                    {selected.has(i.id) && <span>✓</span>}
                  </button>
                ))}
            </div>
          ))}
        </div>
        {!items.length && !busy && (
          <div className="empty">{t("gallery_109")}</div>
        )}
        {busy && <p className="muted">{t("app_003")}</p>}
        {cursor && (
          <button onClick={() => void load(cursor)}>{t("gallery_110")}</button>
        )}
      </div>
      {viewer && (
        <Suspense fallback={<p>{t("detail_056")}</p>}>
          <Viewer
            images={viewer.images}
            start={viewer.start}
            origin={location}
            onClose={() => setViewer(undefined)}
          />
        </Suspense>
      )}
      <ImageUndo ids={deleted} clear={() => setDeleted([])} />
    </main>
  );
}
