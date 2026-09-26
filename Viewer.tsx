import { t } from "./i18n/ja";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, type Location } from "react-router-dom";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import type { CardImage } from "./types";
import { acquireImageUrl } from "./local/files/objectUrlCache";
import { imageRepository } from "./local/repository/imageRepository";
import { cardRepository } from "./local/repository/cardRepository";
import { changed } from "./useData";
export default function Viewer({
  images,
  start,
  onClose,
  origin,
}: {
  images: CardImage[];
  start: number;
  onClose: () => void;
  origin?: Location;
}) {
  const nav = useNavigate();
  const [index, setIndex] = useState(start),
    [message, setMessage] = useState("");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    let alive = true;
    const handles = new Map<number, { url: string; release: () => void }>();
    const loading = new Set<number>();
    const destroyed = new WeakSet<object>();
    const viewer = new PhotoSwipe({
      dataSource: images.map((i) => ({
        type: "image",
        width: i.width || 1024,
        height: i.height || 1024,
        alt: i.original_filename,
      })),
      index: start,
      preload: [1, 1],
      bgOpacity: 1,
      showHideAnimationType: "none",
      closeTitle: t("detail_038"),
      zoomTitle: t("viewer_175"),
      arrowPrevTitle: t("viewer_176"),
      arrowNextTitle: t("viewer_177"),
      padding: { top: 65, bottom: 110, left: 0, right: 0 },
    });
    viewer.on("contentLoad", (event) => {
      const content = event.content;
      if (content.data.src) return;
      event.preventDefault();
      if (loading.has(content.index)) return;
      loading.add(content.index);
      void acquireImageUrl(images[content.index].id, true)
        .then((handle) => {
          if (!alive || destroyed.has(content)) {
            handle.release();
            return;
          }
          handles.set(content.index, handle);
          content.data.src = handle.url;
          content.load(false);
          content.slide?.updateContentSize(true);
          content.append();
        })
        .catch((error) => {
          content.onError();
          setMessage(error.message);
        });
    });
    viewer.on("contentDestroy", ({ content }) => {
      destroyed.add(content);
      handles.get(content.index)?.release();
      handles.delete(content.index);
      loading.delete(content.index);
    });
    viewer.on("change", () => setIndex(viewer.currIndex));
    viewer.on("destroy", () => close.current());
    viewer.init();
    return () => {
      alive = false;
      viewer.destroy();
      for (const handle of handles.values()) handle.release();
    };
  }, [images, start]);
  const i = images[index];
  async function action(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function save() {
    const file = new File(
      [await imageRepository.original(i.id)],
      i.original_filename,
      {
        type: i.mime_type,
      },
    );
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({ files: [file] });
    else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = i.original_filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  return createPortal(
    <div className="viewer-actions">
      <p role="status">{message}</p>
      <button
        onClick={() =>
          void action(async () => {
            await imageRepository.favorite(i.id, {
              is_favorite: !i.is_favorite,
              expectedVersion: i.version,
            });
            i.is_favorite = i.is_favorite ? 0 : 1;
            i.version++;
            setMessage(i.is_favorite ? t("viewer_178") : t("viewer_179"));
            changed();
          })
        }
      >
        {i.is_favorite ? "♥" : "♡"}
      </button>
      <button onClick={() => void action(save)}>{t("viewer_180")}</button>
      <button
        onClick={() =>
          void action(async () => {
            const card = await cardRepository.get(i.card_id);
            await navigator.clipboard.writeText(card.prompt_full);
            setMessage(t("detail_035"));
          })
        }
      >
        {t("viewer_181")}
      </button>
      <button
        onClick={() => {
          close.current();
          nav(`/cards/${i.card_id}`, {
            state: origin ? { background: origin } : undefined,
          });
        }}
      >
        {t("viewer_182")}
      </button>
      <button
        onClick={() =>
          void action(async () => {
            const card = await cardRepository.get(i.card_id);
            close.current();
            nav(`/series/${card.series_id}/tree?focus=${card.id}`);
          })
        }
      >
        {t("viewer_183")}
      </button>
    </div>,
    document.body,
  );
}
