import { database } from "../db";
const ITERATIONS = 210000;
interface Verifier {
  salt: number[];
  hash: number[];
  iterations: number;
  failures: number;
  retryAt: number;
}
async function derive(pin: string, salt: number[], iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new Uint8Array(salt),
        iterations,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
export function backoff(failures: number) {
  return failures < 5
    ? 0
    : Math.min(3600000, 30000 * 2 ** Math.min(7, failures - 5));
}
export async function hasPin() {
  return !!(await (await database()).get("security", "pin"));
}
export async function setupPin(pin: string, confirm: string, replace = false) {
  if (!/^[0-9]{4}$/.test(pin) || pin !== confirm)
    throw new Error("4桁のPINと確認入力を一致させてください");
  const salt = [...crypto.getRandomValues(new Uint8Array(32))],
    hash = [...(await derive(pin, salt, ITERATIONS))],
    db = await database(),
    tx = db.transaction("security", "readwrite");
  if (!replace && (await tx.store.get("pin"))) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error("PINは設定済みです");
  }
  await tx.store.put({
    key: "pin",
    value: {
      salt,
      hash,
      iterations: ITERATIONS,
      failures: 0,
      retryAt: 0,
    } satisfies Verifier,
  });
  await tx.done;
}
export async function verifyPin(pin: string, now = Date.now()) {
  const db = await database(),
    saved = await db.get("security", "pin"),
    v = saved?.value as Verifier | undefined;
  if (!v) throw new Error("PINを設定してください");
  if (now < v.retryAt)
    throw new Error(
      Math.ceil((v.retryAt - now) / 1000) + "秒後に再試行してください",
    );
  const hash = await derive(pin, v.salt, v.iterations);
  let diff = 0;
  for (let n = 0; n < hash.length; n++) diff |= hash[n] ^ v.hash[n];
  const tx = db.transaction("security", "readwrite"),
    current = (await tx.store.get("pin"))?.value as Verifier;
  if (JSON.stringify(current) !== JSON.stringify(v)) {
    await tx.done;
    throw new Error("PINの状態が更新されました。再試行してください");
  }
  const failures = diff ? v.failures + 1 : 0;
  await tx.store.put({
    key: "pin",
    value: { ...v, failures, retryAt: diff ? now + backoff(failures) : 0 },
  });
  await tx.done;
  if (diff) throw new Error("PINが違います");
}
export async function changePin(current: string, pin: string, confirm: string) {
  await verifyPin(current);
  await setupPin(pin, confirm, true);
}
