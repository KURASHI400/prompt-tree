import { createContext, useContext, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionDialog } from "./ActionDialog";
import { deletionService, type DeleteTarget } from "./local/deletionService";
import { changed } from "./useData";
import { UndoNotice, announceDeletion } from "./UndoNotice";
import type { Card } from "./types";
type Subject = Pick<Card, "id" | "series_id" | "is_root">;
const DeletionContext = createContext<(card: Subject) => void>(() => {});
export function useDeletion() {
  return useContext(DeletionContext);
}
export function DeletionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    target: DeleteTarget;
    card: Subject;
    returnTo: string;
  }>();
  const [summary, setSummary] =
    useState<Awaited<ReturnType<typeof deletionService.describe>>>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const location = useLocation(),
    nav = useNavigate();
  function request(card: Subject) {
    const target: DeleteTarget = {
      kind: card.is_root ? "series" : "card",
      id: card.is_root ? card.series_id : card.id,
    };
    const bg = location.state?.background;
    const returnTo = card.is_root
      ? "/home"
      : bg && !/^\/(cards|new)(\/|$)/.test(bg.pathname)
        ? bg.pathname + bg.search + bg.hash
        : `/series/${card.series_id}/tree`;
    setPending({ target, card, returnTo });
    setSummary(undefined);
    setError("");
    void deletionService
      .describe(target)
      .then(setSummary)
      .catch((e) => setError(e.message));
  }
  async function remove() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    try {
      const ticket = await deletionService.remove(pending.target);
      announceDeletion(ticket);
      sessionStorage.removeItem("draft:" + pending.card.id);
      nav(pending.returnTo, { replace: true });
      setPending(undefined);
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DeletionContext.Provider value={request}>
      {children}
      <UndoNotice />
      {pending && (
        <ActionDialog
          alert
          title={
            pending.target.kind === "series"
              ? "このシリーズを削除しますか？"
              : `${summary?.label ?? "カード"}を削除しますか？`
          }
          busy={busy}
          onClose={() => setPending(undefined)}
        >
          {summary ? (
            pending.target.kind === "series" ? (
              <>
                <p>
                  <strong>{summary.label}</strong>
                  {summary.title && (
                    <>
                      <br />
                      {summary.title}
                    </>
                  )}
                </p>
                <p>このシリーズ内の以下のデータが削除されます。</p>
                <ul>
                  <li>カード {summary.cards}件</li>
                  <li>画像 {summary.images}枚（Original・サムネイル）</li>
                  <li>接続線・Prompt・メモ・タグとの関連</li>
                  <li>TREEの配置・表示位置</li>
                </ul>
              </>
            ) : (
              <>
                <p>このカードの画像とPromptも削除されます。</p>
                <p>
                  メモ・タグとの関連・接続線も削除されます。派生した子カードは残ります。
                </p>
              </>
            )
          ) : (
            <p>確認中…</p>
          )}
          <p className="muted">削除後10秒間は「元に戻す」で取り消せます。</p>
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <button
              autoFocus
              disabled={busy}
              onClick={() => setPending(undefined)}
            >
              キャンセル
            </button>
            <button
              className="danger"
              disabled={busy || !summary}
              onClick={() => void remove()}
            >
              {busy
                ? "削除中…"
                : pending.target.kind === "series"
                  ? "シリーズを削除"
                  : "カードを削除"}
            </button>
          </div>
        </ActionDialog>
      )}
    </DeletionContext.Provider>
  );
}
