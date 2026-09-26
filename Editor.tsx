import { t } from "./i18n/ja";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { cardRepository } from "./local/repository/cardRepository";
import { seriesRepository } from "./local/repository/seriesRepository";
import { record } from "./history";
import { uploadImage } from "./images";
import { changed, useData } from "./useData";
import type { Card, TreeData } from "./types";
import { treeRepository } from "./local/repository/treeRepository";
import { settingsRepository } from "./local/repository/settingsRepository";
export default function Editor() {
  const [params] = useSearchParams();
  const edit = params.get("edit"),
    series = params.get("series"),
    parent = params.get("parent");
  const { data: initial } = useData<Card>(
    edit || parent ? `/cards/${edit ?? parent}` : null,
    () => cardRepository.get((edit ?? parent)!),
  );
  const { data: graph } = useData<TreeData>(
    series ? `/series/${series}/tree` : null,
    () => treeRepository.get(series!),
  );
  const { data: tagSuggestions } = useData<string[]>("tags", () =>
    settingsRepository.tags(),
  );
  const { data: settings } = useData<{ default_ai_provider: string }>(
    "/settings",
    () => settingsRepository.get(),
  );
  const nav = useNavigate(),
    location = useLocation();
  const [files, setFiles] = useState<File[]>([]),
    [primaryParent, setPrimaryParent] = useState(parent ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [dirty, setDirty] = useState(false);
  const card = useRef<string | undefined>(edit ?? undefined);
  const [failed, setFailed] = useState<File[]>([]);
  const successes = useRef(0),
    saved = useRef(false),
    uploaded = useRef(new Map<File, string>());
  const form = useRef<HTMLFormElement>(null),
    version = useRef<number | undefined>(undefined),
    hydrated = useRef(false);
  const draftKey = "draft:" + (edit ?? series ?? "series");
  if (edit && initial && version.current === undefined)
    version.current = initial.version;
  useEffect(() => {
    if (hydrated.current || !form.current || (edit && !initial)) return;
    let alive = true;
    void settingsRepository
      .draft(draftKey)
      .then((stored) => {
        if (!alive || !form.current) return;
        hydrated.current = true;
        const cached = sessionStorage.getItem(draftKey);
        const values = cached
          ? (JSON.parse(cached) as Record<string, string>)
          : stored;
        if (!values) return;
        for (const [key, value] of Object.entries(values)) {
          if (key === "parent_id") setPrimaryParent(value);
          const input = form.current.elements.namedItem(key);
          if (input instanceof HTMLInputElement && input.type === "checkbox")
            input.checked = value === "on";
          else if (
            (input instanceof HTMLInputElement && input.type !== "file") ||
            input instanceof HTMLTextAreaElement ||
            input instanceof HTMLSelectElement
          )
            input.value = value;
        }
        setDirty(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [draftKey, edit, initial]);
  function saveDraft() {
    setDirty(true);
    saved.current = false;
    if (form.current)
      void settingsRepository
        .draft(
          draftKey,
          Object.fromEntries(
            [...new FormData(form.current)].filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          ),
        )
        .catch((e) => setError(e.message));
    if (form.current)
      sessionStorage.setItem(
        draftKey,
        JSON.stringify(
          Object.fromEntries(
            [...new FormData(form.current)].filter(
              ([, value]) => typeof value === "string",
            ),
          ),
        ),
      );
  }
  function close() {
    sessionStorage.removeItem(draftKey);
    void settingsRepository.removeDraft(draftKey);
    if (series && !edit && card.current && successes.current) {
      const id = card.current;
      record(series, {
        undo: () => cardRepository.remove(id),
        redo: () => cardRepository.restore(id),
      });
    }
    changed();
    if (location.state?.background) nav(-1);
    else nav("/home");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const input = {
      ...raw,
      rating: raw.rating ? Number(raw.rating) : null,
      tags: String(raw.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      parent_id: String(raw.parent_id || "") || null,
      additional_parent_ids: new FormData(e.currentTarget)
        .getAll("additional_parents")
        .map(String),
      x: params.has("x") ? Number(params.get("x")) : undefined,
      y: params.has("y") ? Number(params.get("y")) : undefined,
      expectedVersion: version.current,
      renameChildren: raw.renameChildren === "on",
    };
    try {
      if (!card.current) {
        if (!files.length) throw new Error(t("editor_057"));
        const result = await (series
          ? cardRepository.create(series, input)
          : seriesRepository.create(input));
        card.current = result.id;
        saved.current = true;
      } else if (edit && !saved.current) {
        await cardRepository.update(edit, input);
        saved.current = true;
      }
      const queue = failed.length ? failed : files;
      const errors: File[] = [];
      const reasons: string[] = [];
      let complete = 0;
      let index = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (index < queue.length) {
            const file = queue[index++];
            try {
              uploaded.current.set(
                file,
                await uploadImage(card.current!, file),
              );
              successes.current++;
            } catch (error) {
              errors.push(file);
              reasons.push((error as Error).message);
            }
            complete++;
            setProgress(`${complete} / ${queue.length}`);
          }
        }),
      );
      const fresh = await cardRepository.get(card.current);
      const ordered = files
        .map((f) => uploaded.current.get(f))
        .filter((id): id is string => !!id);
      if (ordered.length) {
        await cardRepository.reorderImages(card.current, {
          ids: [
            ...fresh.images
              .filter((i) => !ordered.includes(i.id))
              .map((i) => i.id),
            ...ordered,
          ],
          expectedVersion: fresh.version,
        });
        if (!edit)
          await cardRepository.cover(card.current, {
            image_id: ordered[0],
            expectedVersion: fresh.version + 1,
          });
      }
      setFailed(errors);
      if (errors.length)
        setError(
          `${errors.length}枚の保存に失敗しました。${reasons[0] ?? ""} 成功した画像は保存されています。`,
        );
      else close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (edit && !initial)
    return (
      <section className="overlay">
        <button onClick={close}>{t("editor_058")}</button>
        <p>{t("app_003")}</p>
      </section>
    );
  const c = edit ? initial : undefined;
  return (
    <section
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={
        edit ? t("editor_059") : series ? t("editor_060") : t("editor_061")
      }
    >
      <header>
        <button
          disabled={busy}
          onClick={() => {
            if (!dirty || confirm(t("editor_062"))) close();
          }}
        >
          {t("editor_063")}
        </button>
        <h2>
          {edit ? t("editor_059") : series ? t("editor_064") : t("editor_065")}
        </h2>
      </header>
      <form
        ref={form}
        data-dirty={dirty}
        onSubmit={submit}
        onChange={saveDraft}
        className="editor"
      >
        <label className="file-drop">
          ＋ {edit ? t("editor_066") : t("editor_067")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <small>
            {files.length ? `${files.length}枚を選択中` : t("editor_068")}
          </small>
        </label>
        <label>
          ID
          <input
            name="display_id"
            defaultValue={c?.display_id}
            placeholder={t("editor_069")}
          />
        </label>
        <label>
          {t("editor_070")}
          <input
            name="title"
            defaultValue={c?.title}
            placeholder={t("editor_071")}
          />
        </label>
        <label>
          Full Prompt
          <textarea name="prompt_full" defaultValue={c?.prompt_full} rows={6} />
        </label>
        <label>
          Delta Prompt
          <textarea
            name="prompt_delta"
            defaultValue={c?.prompt_delta}
            rows={3}
          />
        </label>
        {series && (
          <label>
            Primary Parent
            <select
              name="parent_id"
              value={primaryParent}
              onChange={(e) => setPrimaryParent(e.target.value)}
            >
              <option value="">{t("editor_072")}</option>
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.display_id}
                </option>
              ))}
            </select>
          </label>
        )}
        <details>
          <summary>{t("editor_073")}</summary>
          <div className="form-fields">
            {series && (
              <label>
                Additional Parents
                <select name="additional_parents" multiple>
                  {graph?.nodes
                    .filter((n) => n.id !== parent)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.display_id}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              {t("detail_040")}
              <textarea name="memo" defaultValue={c?.memo} rows={3} />
            </label>
            <label>
              AI Provider
              <input
                name="ai_provider"
                defaultValue={
                  c?.ai_provider ??
                  settings?.default_ai_provider ??
                  localStorage.getItem("provider") ??
                  "ChatGPT"
                }
                list="providers"
              />
            </label>
            <datalist id="providers">
              {[
                "ChatGPT",
                "Gemini",
                "Midjourney",
                "Stable Diffusion",
                "Adobe Firefly",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </datalist>
            <label>
              Model
              <input name="model" defaultValue={c?.model} />
            </label>
            <label>
              {t("editor_074")}
              <select name="rating" defaultValue={c?.rating ?? ""}>
                <option value="">{t("editor_075")}</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("editor_076")}
              <input
                list="tag-suggestions"
                name="tags"
                defaultValue={c?.tags.join(", ")}
              />
            </label>
            <datalist id="tag-suggestions">
              {tagSuggestions?.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </datalist>
            <label>
              Metadata（JSON）
              <textarea
                name="metadata_json"
                defaultValue={c?.metadata_json ?? "{}"}
              />
            </label>
            {c?.is_root && (
              <label>
                <input type="checkbox" name="renameChildren" />
                {t("editor_077")}
              </label>
            )}
          </div>
        </details>
        {error && (
          <div>
            <p role="alert" className="error">
              {error}
            </p>
            {edit && (
              <button
                type="button"
                onClick={() =>
                  void cardRepository
                    .get(edit)
                    .then((latest) => {
                      if (
                        confirm(
                          t("editor_078") +
                            latest.prompt_full +
                            t("editor_079"),
                        )
                      ) {
                        version.current = latest.version;
                        setError(t("editor_080"));
                      }
                    })
                    .catch((e) => setError(e.message))
                }
              >
                {t("editor_081")}
              </button>
            )}
          </div>
        )}
        <div className="save-bar">
          <button className="primary" disabled={busy}>
            {busy
              ? `保存中 ${progress}`
              : failed.length
                ? t("editor_082")
                : t("editor_083")}
          </button>
          {failed.length > 0 && successes.current > 0 && (
            <button type="button" onClick={close}>
              {t("editor_084")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
