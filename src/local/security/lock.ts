import { AUTO_LOCK_MS } from "../../config";
export const expired = (last: number, now = Date.now()) =>
  now - last >= AUTO_LOCK_MS;
export function lockApp() {
  window.dispatchEvent(new Event("app-lock"));
}
