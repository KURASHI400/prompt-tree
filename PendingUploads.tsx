import { useState } from "react";
import { imageRepository } from "./local/repository/imageRepository";
import { useData, changed } from "./useData";
export function PendingUploads() {
  const { data, refresh } = useData("pending-images", () =>
      imageRepository.pending(),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>未完了の画像保存</h3>
      <p>
        失敗した画像は通常の一覧に混ぜません。容量を確保してから再試行してください。
      </p>
      {!data?.length && <p>未完了の画像はありません</p>}
      {data?.map((i) => (
        <div key={i.id}>
          <p>{i.original_filename}</p>
          <button
            disabled={busy}
            onClick={() => void run(() => imageRepository.recover(i.id))}
          >
            保存済みOriginalから復旧
          </button>
          <label>
            元画像を選んで再保存
            <input
              type="file"
              accept="image/*,.heic,.heif"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => imageRepository.recover(i.id, f));
              }}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("この未完了の保存を破棄しますか？"))
                void run(() => imageRepository.discard(i.id));
            }}
          >
            未完了分を破棄
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
