import { t } from "./i18n/ja";
import { lazy, Suspense, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { changed, useData } from "./useData";
import type { Card, CardImage, Series, TreeData } from "./types";
import { Thumb } from "./Thumb";
import { ImageControls } from "./ImageControls";
import { seriesRepository } from "./local/repository/seriesRepository";
import { cardRepository } from "./local/repository/cardRepository";
import { treeRepository } from "./local/repository/treeRepository";
import { record } from "./history";
import { childId } from "./domain";
const Viewer = lazy(() => import("./Viewer"));
export default function Detail() {
  const { id } = useParams();
  const {
    data: c,
    error,
    refresh,
  } = useData<Card>(id ?? null, () => cardRepository.get(id!));
  const { data: graph } = useData<TreeData>(
    c ? "/series/" + c.series_id + "/tree" : null,
    () => treeRepository.get(c!.series_id),
  );
  const { data: series } = useData<Series[]>("series", () =>
    seriesRepository.list(),
  );
  const nav = useNavigate(),
    location = useLocation();
  const [expanded, setExpanded] = useState(false),
    [message, setMessage] = useState(""),
    [viewer, setViewer] = useState<{ images: CardImage[]; start: number }>(),
    [destination, setDestination] = useState(""),
    [moveDisplay, setMoveDisplay] = useState("");
  const background = location.state?.background ?? location;
  function openEditor(url: string) {
    nav(url, { state: { background } });
  }
  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      changed();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("detail_029")}
    >
      <header>
        <button
          onClick={() => (location.state?.background ? nav(-1) : nav("/home"))}
        >
          {t("detail_030")}
        </button>
        <button
          onClick={() => c && nav(`/series/${c.series_id}/tree?focus=${c.id}`)}
        >
          {t("detail_031")}
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {c && (
        <div className="detail">
          <p className="eyebrow">
            {c.is_root ? "ROOT EXPERIMENT" : "GENERATION EXPERIMENT"}
          </p>
          <h1>{c.display_id}</h1>
          {c.title && <h2>{c.title}</h2>}
          <div className="carousel">
            {c.images.map((i, n) => (
              <button
                key={i.id}
                aria-label={`画像 ${n + 1} を表示`}
                onClick={() => setViewer({ images: c.images, start: n })}
              >
                <Thumb id={i.id} alt={c.title || c.display_id} />
              </button>
            ))}
          </div>
          <p className="muted">
            {c.images.length}
            {t("detail_032")}
            {c.rating && "★".repeat(c.rating)}
          </p>
          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                openEditor(`/new?series=${c.series_id}&parent=${c.id}`)
              }
            >
              {t("detail_033")}
            </button>
            <button onClick={() => openEditor(`/new?edit=${c.id}`)}>
              {t("detail_034")}
            </button>
          </div>
          <div className="section-title">
            <h3>Full Prompt</h3>
            <button
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(c.prompt_full);
                  setMessage(t("detail_035"));
                })
              }
            >
              {t("detail_036")}
            </button>
          </div>
          <p className={`prompt ${expanded ? "" : "collapsed"}`}>
            {c.prompt_full || t("detail_037")}
          </p>
          {c.prompt_full && (
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? t("detail_038") : t("detail_039")}
            </button>
          )}
          {c.prompt_delta && (
            <>
              <h3>Delta Prompt</h3>
              <p className="prompt">{c.prompt_delta}</p>
            </>
          )}
          {c.memo && (
            <>
              <h3>{t("detail_040")}</h3>
              <p className="prompt">{c.memo}</p>
            </>
          )}
          <p className="muted">
            {c.ai_provider} {c.model}
          </p>
          <div className="chips">
            {c.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <details>
            <summary>Metadata</summary>
            <pre>{JSON.stringify(JSON.parse(c.metadata_json), null, 2)}</pre>
          </details>
          <details>
            <summary>{t("detail_041")}</summary>
            {graph?.edges
              .filter(
                (e) => e.target_card_id === c.id || e.source_card_id === c.id,
              )
              .map((e) => {
                const other =
                  e.target_card_id === c.id
                    ? e.source_card_id
                    : e.target_card_id;
                return (
                  <button
                    key={e.id}
                    onClick={() =>
                      nav("/cards/" + other, { state: { background } })
                    }
                  >
                    {e.kind === "reference"
                      ? t("detail_042")
                      : e.target_card_id === c.id
                        ? e.is_primary
                          ? t("detail_043")
                          : t("detail_044")
                        : t("detail_045")}{" "}
                    · {graph.nodes.find((n) => n.id === other)?.display_id}
                  </button>
                );
              })}
          </details>
          <ImageControls card={c} refresh={refresh} />
          <details>
            <summary>{t("detail_046")}</summary>
            {c.is_root && (
              <button
                onClick={() => {
                  if (confirm(c.display_id + t("detail_047")))
                    void run(async () => {
                      await seriesRepository.remove(c.series_id);
                      sessionStorage.setItem(
                        "deleted-card",
                        JSON.stringify({
                          id: c.series_id,
                          kind: "series",
                          at: Date.now(),
                        }),
                      );
                      nav("/home");
                    });
                }}
              >
                {t("detail_048")}
              </button>
            )}
            <div className="actions">
              <button
                onClick={() =>
                  void run(async () => {
                    const copy = await cardRepository.duplicate(c.id);
                    nav(`/cards/${copy.id}`, {
                      replace: true,
                      state: { background },
                    });
                  })
                }
              >
                {t("detail_049")}
              </button>
              {!c.is_root && (
                <button
                  onClick={() => {
                    if (confirm(`${c.display_id}を削除しますか？`))
                      void run(async () => {
                        await cardRepository.remove(c.id);
                        record(c.series_id, {
                          undo: () => cardRepository.restore(c.id),
                          redo: () => cardRepository.remove(c.id),
                        });
                        sessionStorage.setItem(
                          "deleted-card",
                          JSON.stringify({ id: c.id, at: Date.now() }),
                        );
                        nav(`/series/${c.series_id}/tree`);
                      });
                  }}
                >
                  {t("detail_050")}
                </button>
              )}
            </div>
            {!c.is_root && (
              <>
                <label>
                  {t("detail_051")}
                  <select
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      const selected = series?.find(
                        (s) => s.id === e.target.value,
                      );
                      setMoveDisplay(
                        selected
                          ? childId(
                              selected.display_id,
                              selected.next_card_number,
                            )
                          : "",
                      );
                    }}
                  >
                    <option value="">{t("detail_052")}</option>
                    {series
                      ?.filter((s) => s.id !== c.series_id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.display_id}
                        </option>
                      ))}
                  </select>
                </label>
                {destination && (
                  <label>
                    移動後のID
                    <input
                      value={moveDisplay}
                      maxLength={100}
                      onChange={(e) => setMoveDisplay(e.target.value)}
                    />
                  </label>
                )}
                <button
                  disabled={!destination || !moveDisplay.trim()}
                  onClick={() => {
                    if (confirm(t("detail_053")))
                      void run(async () => {
                        await cardRepository.move(c.id, {
                          series_id: destination,
                          display_id: moveDisplay.trim(),
                          expectedVersion: c.version,
                        });
                        await refresh();
                        setMessage(t("detail_054"));
                      });
                  }}
                >
                  {t("detail_055")}
                </button>
              </>
            )}
          </details>
          {message && <p role="status">{message}</p>}
        </div>
      )}
      {viewer && (
        <Suspense fallback={<p>{t("detail_056")}</p>}>
          <Viewer
            images={viewer.images}
            start={viewer.start}
            onClose={() => setViewer(undefined)}
          />
        </Suspense>
      )}
    </section>
  );
}
