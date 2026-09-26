import { useEffect, useState } from "react";
import { imageRepository } from "./local/repository/imageRepository";
import { changed } from "./useData";
export function ImageUndo({
  ids,
  clear,
}: {
  ids: string[];
  clear: () => void;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (!ids.length) return;
    const timer = setTimeout(clear, 10000);
    return () => clearTimeout(timer);
  }, [ids, clear]);
  return ids.length ? (
    <div className="undo-notice" role="status">
      画像を削除しました
      <button
        onClick={() =>
          void imageRepository
            .restore(ids)
            .then(() => {
              clear();
              changed();
            })
            .catch((e) => setError(e.message))
        }
      >
        取り消す
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  ) : null;
}
