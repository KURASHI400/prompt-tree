interface Operation {
  undo: () => Promise<unknown>;
  redo: () => Promise<unknown>;
}
const histories = new Map<string, { past: Operation[]; future: Operation[] }>();
function state(series: string) {
  if (!histories.has(series)) histories.set(series, { past: [], future: [] });
  return histories.get(series)!;
}
export function record(series: string, op: Operation) {
  const s = state(series);
  s.past.push(op);
  s.past = s.past.slice(-40);
  s.future = [];
  window.dispatchEvent(new Event("history-change"));
}
export async function travel(series: string, undo: boolean) {
  const s = state(series),
    from = undo ? s.past : s.future,
    to = undo ? s.future : s.past,
    op = from.at(-1);
  if (!op) return;
  await (undo ? op.undo() : op.redo());
  from.pop();
  to.push(op);
  window.dispatchEvent(new Event("data-changed"));
  window.dispatchEvent(new Event("history-change"));
}
export function historyState(series: string) {
  const s = state(series);
  return { undo: s.past.length > 0, redo: s.future.length > 0 };
}

window.addEventListener("clear-history", () => histories.clear());
