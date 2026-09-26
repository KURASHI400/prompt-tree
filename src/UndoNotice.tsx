import { t } from "./i18n/ja";
import { useEffect, useState } from "react";
import { cardRepository } from "./local/repository/cardRepository";
import { seriesRepository } from "./local/repository/seriesRepository";
import { changed } from "./useData";
export function UndoNotice() {
  const [deleted, setDeleted] = useState<{
    id: string;
    at: number;
    kind?: string;
  } | null>(() => JSON.parse(sessionStorage.getItem("deleted-card") ?? "null"));
  useEffect(() => {
    if (!deleted) return;
    const timeout = setTimeout(
      () => {
        setDeleted(null);
        sessionStorage.removeItem("deleted-card");
      },
      Math.max(0, 10000 - (Date.now() - deleted.at)),
    );
    return () => clearTimeout(timeout);
  }, [deleted]);
  return deleted && Date.now() - deleted.at < 10000 ? (
    <div className="undo-notice">
      {t("undonotice_173")}
      <button
        onClick={() =>
          void (
            deleted.kind === "series"
              ? seriesRepository.restore(deleted.id)
              : cardRepository.restore(deleted.id)
          ).then(() => {
            setDeleted(null);
            sessionStorage.removeItem("deleted-card");
            changed();
          })
        }
      >
        {t("undonotice_174")}
      </button>
    </div>
  ) : null;
}
