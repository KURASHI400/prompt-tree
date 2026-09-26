import { useEffect, useState } from "react";
import { deletionService, type DeleteTicket } from "./local/deletionService";
import { cleanup } from "./local/maintenance";
import { changed } from "./useData";
const KEY = "deletion-tickets";
function read(): DeleteTicket[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function announceDeletion(ticket: DeleteTicket) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify([
      ...read().filter((t) => t.at > Date.now() && t.id !== ticket.id),
      ticket,
    ]),
  );
  window.dispatchEvent(new Event("deletion-notice"));
}
export function UndoNotice() {
  const [tickets, setTickets] = useState(read),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    function update() {
      setTickets(read());
      setError("");
    }
    window.addEventListener("deletion-notice", update);
    return () => window.removeEventListener("deletion-notice", update);
  }, []);
  useEffect(() => {
    const tick = () => {
      const live = read().filter((t) => t.at > Date.now());
      sessionStorage.setItem(KEY, JSON.stringify(live));
      setTickets(live);
      void cleanup().catch(() =>
        setError(
          "画像の後片付けを再試行します。データはこの端末内にあります。",
        ),
      );
    };
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  async function undo(ticket: DeleteTicket) {
    setBusy(true);
    try {
      await deletionService.restore(ticket);
      const remaining = read().filter((t) => t.id !== ticket.id);
      sessionStorage.setItem(KEY, JSON.stringify(remaining));
      setTickets(remaining);
      setError("");
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const latest = tickets.at(-1);
  return latest || error ? (
    <div className="undo-notice" role="status">
      {latest && (
        <>
          <span>削除しました</span>
          <button disabled={busy} onClick={() => void undo(latest)}>
            元に戻す
          </button>
        </>
      )}
      {error && <span>{error}</span>}
    </div>
  ) : null;
}
