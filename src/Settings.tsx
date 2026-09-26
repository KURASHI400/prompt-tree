import { useEffect, useRef, useState, type FormEvent } from "react";
import { useData, changed } from "./useData";
import { settingsRepository } from "./local/repository/settingsRepository";
import { changePin } from "./local/security/pin";
import { lockApp } from "./local/security/lock";
import { persistence, type Persistence } from "./local/storage/persistence";
import { pressure } from "./local/storage/quota";
import { APP_VERSION } from "./config";
import type { BackupPart } from "./local/backup/backupFormat";
import { PendingUploads } from "./PendingUploads";
const sizes = (n = 0) => (n / 1024 / 1024).toFixed(1) + " MB";
export default function Settings() {
  const { data: stats, refresh } = useData("statistics", () =>
      settingsRepository.stats(),
    ),
    { data: research } = useData("research", () => settingsRepository.get());
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [persist, setPersist] = useState<Persistence>("unsupported"),
    [estimate, setEstimate] = useState<StorageEstimate>({}),
    [part, setPart] = useState<BackupPart>(),
    [saved, setSaved] = useState(false),
    [reset, setReset] = useState(false);
  const generator = useRef<AsyncGenerator<BackupPart> | undefined>(undefined),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void persistence().then(setPersist);
    void navigator.storage?.estimate?.().then(setEstimate);
    return () => {
      alive.current = false;
      void generator.current?.return(undefined);
    };
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget,
      d = new FormData(f);
    await run(async () => {
      await changePin(
        String(d.get("current")),
        String(d.get("pin")),
        String(d.get("confirm")),
      );
      f.reset();
      lockApp();
    });
  }
  async function nextPart() {
    const next = await generator.current?.next();
    if (!alive.current) return;
    if (next?.done) {
      setPart(undefined);
      setMessage("完全バックアップを保存しました");
    } else {
      setPart(next?.value);
      setSaved(false);
    }
  }
  async function savePart() {
    if (!part) return;
    const file = part.file;
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({ files: [file] });
    else {
      const url = URL.createObjectURL(file),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    setSaved(true);
    setMessage("Files等でPartの保存完了を確認してから次へ進んでください。");
  }
  return (
    <main className="page settings">
      <h2>設定</h2>
      <section>
        <h3>セキュリティ</h3>
        <button onClick={lockApp}>今すぐロック</button>
        <details>
          <summary>PINを変更</summary>
          <form onSubmit={pin}>
            {[
              ["current", "現在のPIN"],
              ["pin", "新しいPIN"],
              ["confirm", "新しいPIN（確認）"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                  required
                />
              </label>
            ))}
            <button disabled={busy}>変更</button>
          </form>
        </details>
        <small>
          PINは画面のプライバシーロックです。画像の暗号化ではありません。5分無操作で自動ロックします。
        </small>
      </section>
      <section>
        <h3>ストレージ</h3>
        <p>保存使用量: {sizes(estimate.usage)}</p>
        <p>
          利用可能目安:{" "}
          {estimate.quota
            ? sizes(Math.max(0, estimate.quota - (estimate.usage ?? 0)))
            : "取得できません"}
        </p>
        <p>容量はブラウザの推定値です。</p>
        <p data-testid="persistence-status">
          永続ストレージ:{" "}
          {persist === "granted"
            ? "有効"
            : persist === "denied"
              ? "未承認"
              : "非対応"}
        </p>
        {persist !== "granted" && (
          <p role="status">
            保存領域が自動消去される可能性があります。完全バックアップを保存してください。
          </p>
        )}
        <button
          onClick={() =>
            void run(async () => setPersist(await persistence(true)))
          }
        >
          永続ストレージをリクエスト
        </button>
        {pressure(estimate.usage, estimate.quota) !== "normal" && (
          <p role="alert">
            保存容量の使用率が高くなっています（
            {Math.round(((estimate.usage ?? 0) / (estimate.quota ?? 1)) * 100)}
            %）。バックアップ後に不要な画像を削除してください。
          </p>
        )}
        {stats && (
          <p>
            {stats.cards} Cards · {stats.images} Originals ·{" "}
            {sizes(stats.bytes)}
          </p>
        )}
      </section>
      <section>
        <h3>バックアップ</h3>
        <p>
          最終:{" "}
          {stats?.last_backup
            ? new Date(stats.last_backup.at).toLocaleString()
            : "まだバックアップされていません"}
        </p>
        <p>
          画像とPromptはこの端末だけに保存されます。端末故障・サイトデータ削除に備え、Files
          / iCloud Drive等へ全Partを保存してください。
        </p>
        <button
          disabled={busy || !!part}
          onClick={() =>
            void run(async () => {
              const { createBackup } =
                await import("./local/backup/createBackup");
              generator.current = createBackup(setMessage);
              await nextPart();
            })
          }
        >
          完全バックアップを作成
        </button>
        {part && (
          <div>
            <p>
              Part {part.number} / {part.total} · {sizes(part.file.size)}
            </p>
            <button disabled={busy} onClick={() => void run(savePart)}>
              このPartを保存
            </button>
            <button
              disabled={busy || !saved}
              onClick={() =>
                void run(async () => {
                  if (part.number === part.total) {
                    const { markBackupSaved } =
                      await import("./local/backup/createBackup");
                    await markBackupSaved(part.revision);
                  }
                  await nextPart();
                })
              }
            >
              {part.number === part.total
                ? "全Partの保存を確認・完了"
                : "保存を確認・次のPart"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await generator.current?.return(undefined);
                  setPart(undefined);
                  setMessage(
                    "作成を中止しました。未完了のPartは復元に使えません。",
                  );
                })
              }
            >
              中止
            </button>
          </div>
        )}
        <label className="file-button">
          バックアップから復元
          <input
            type="file"
            accept=".ptbackup,application/zip"
            multiple
            disabled={busy || !!part}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              void run(async () => {
                const { validateBackup } =
                  await import("./local/backup/validateBackup");
                const preview = await validateBackup(files);
                if (
                  !confirm(
                    preview.data.cards.length +
                      " Cards / " +
                      preview.data.images.length +
                      "画像を復元します。現在のデータは別の保存領域に保持し、復元成功後に表示を切り替えます。",
                  )
                )
                  return;
                const { restoreBackup } =
                  await import("./local/backup/restoreBackup");
                await restoreBackup(files, setMessage);
                sessionStorage.clear();
                window.dispatchEvent(new Event("clear-history"));
                changed();
                setMessage("復元しました");
              });
            }}
          />
        </label>
      </section>
      <section>
        <h3>研究設定</h3>
        {research && (
          <label>
            既定のAI Provider
            <input
              defaultValue={research.default_ai_provider}
              onBlur={(e) =>
                void run(async () => {
                  await settingsRepository.set({
                    default_ai_provider: e.target.value.trim(),
                  });
                  setMessage("設定を保存しました");
                })
              }
            />
          </label>
        )}
      </section>
      <PendingUploads />
      <section>
        <h3>アプリ</h3>
        <p>Prompt Tree {APP_VERSION} · Local Offline-first</p>
        <p>
          更新が利用可能になると画面に案内します。編集中の更新前には保存してください。
        </p>
        <button onClick={() => setReset(true)}>
          この端末のデータをリセット
        </button>
        {reset && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const token = String(new FormData(e.currentTarget).get("token"));
              if (token !== "DELETE") return;
              if (
                !confirm(
                  "このアプリの全画像・Prompt・PINをこの端末から完全に削除します。バックアップを保存済みですか？",
                )
              )
                return;
              void run(async () => {
                const { resetLocalData } = await import("./local/maintenance");
                await resetLocalData();
                location.reload();
              });
            }}
          >
            <p>
              削除後は取り消せません。バックアップを保存してから DELETE
              と入力してください。
            </p>
            <input
              name="token"
              aria-label="リセット確認"
              pattern="DELETE"
              required
            />
            <button disabled={busy}>完全に削除</button>
            <button type="button" onClick={() => setReset(false)}>
              キャンセル
            </button>
          </form>
        )}
      </section>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
