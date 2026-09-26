import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { APP_NAME } from "./config";
import { hasPin, setupPin, verifyPin } from "./local/security/pin";
import { expired } from "./local/security/lock";
import { persistence } from "./local/storage/persistence";
export function AuthGate({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<boolean>(),
    [unlocked, setUnlocked] = useState(false),
    [privateScreen, setPrivate] = useState(document.hidden),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const last = useRef(Date.now());
  useEffect(() => {
    document.documentElement.classList.toggle("app-private", privateScreen);
    return () => document.documentElement.classList.remove("app-private");
  }, [privateScreen]);
  const cleaned = useRef(false);
  useEffect(() => {
    if (!unlocked || cleaned.current) return;
    cleaned.current = true;
    void import("./local/maintenance")
      .then((m) => m.cleanup())
      .catch((e) => setNotice("保存領域の清掃を保留しました: " + e.message));
  }, [unlocked]);
  useEffect(() => {
    void hasPin()
      .then((value) => setSetup(!value))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const lock = () => setUnlocked(false);
    const activity = () => {
      if (!unlocked) return;
      if (expired(last.current)) {
        lock();
        return;
      }
      last.current = Date.now();
    };
    const visibility = () => {
      setPrivate(document.hidden);
      if (expired(last.current)) lock();
    };
    const hide = () => setPrivate(true),
      show = () => visibility();
    window.addEventListener("app-lock", lock);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    for (const name of ["pointerdown", "pointermove", "keydown", "touchstart"])
      window.addEventListener(name, activity, { passive: true });
    const timer = setInterval(() => {
      if (unlocked && expired(last.current)) lock();
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("app-lock", lock);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      for (const name of [
        "pointerdown",
        "pointermove",
        "keydown",
        "touchstart",
      ])
        window.removeEventListener(name, activity);
    };
  }, [unlocked]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      if (setup) {
        const result = persistence(true);
        await setupPin(String(data.get("pin")), String(data.get("pinConfirm")));
        setSetup(false);
        setNotice(
          (await result) === "granted"
            ? "この端末に保存します。定期的に完全バックアップを作成してください。"
            : "永続ストレージは未承認または非対応です。データ消去に備えて完全バックアップを作成してください。",
        );
      } else await verifyPin(String(data.get("pin")));
      last.current = Date.now();
      form.reset();
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const privacy = privateScreen ? (
    <main className="lock privacy-screen" aria-label="プライバシー保護">
      <img src="./icon.svg" alt="" />
      <h1>{APP_NAME}</h1>
      <p>プライバシーを保護しています</p>
    </main>
  ) : null;
  if (unlocked)
    return (
      <>
        {privacy}
        <div
          style={{
            display: "contents",
            visibility: privateScreen ? "hidden" : undefined,
          }}
          inert={privateScreen}
          aria-hidden={privateScreen || undefined}
        >
          {notice && (
            <div className="update-banner">
              <p>{notice}</p>
              <button onClick={() => setNotice("")}>閉じる</button>
            </div>
          )}
          {children}
        </div>
      </>
    );
  if (privacy) return privacy;
  return (
    <main className="lock">
      <img src="./icon.svg" alt="" />
      <p className="eyebrow">YOUR VISUAL RESEARCH</p>
      <h1>{APP_NAME}</h1>
      <p>
        {setup === undefined
          ? "保存領域を確認中"
          : setup
            ? "4桁のPINを設定"
            : "PINを入力"}
      </p>
      {setup && (
        <p>
          画像とPromptはこの端末内に保存されます。自動送信しません。端末の故障やデータ削除に備え、定期的にバックアップしてください。
        </p>
      )}
      {setup !== undefined && (
        <form onSubmit={submit}>
          <label>
            4桁のPIN
            <input
              className="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              autoComplete="off"
            />
          </label>
          {setup && (
            <label>
              PIN（確認）
              <input
                name="pinConfirm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                autoComplete="off"
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "確認中" : setup ? "PINを設定して始める" : "ロック解除"}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <small>
        PINは画面のプライバシーロックです。保存データの暗号化ではありません。
      </small>
    </main>
  );
}
