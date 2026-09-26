export const normalize = (s: string) =>
  s
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ς/g, "σ");
export function seriesLabel(index: number) {
  let n = index + 1,
    out = "";
  while (n > 0) {
    n--;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}
export function childId(root: string, number: number) {
  return `${root.replace(/-000$/, "")}-${String(number).padStart(3, "0")}`;
}
export function wouldCycle(
  edges: { source_card_id: string; target_card_id: string; kind: string }[],
  source: string,
  target: string,
) {
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges)
      if (e.kind === "parent" && e.source_card_id === id)
        stack.push(e.target_card_id);
  }
  return false;
}
export function placement(
  nodes: { canvas_x: number; canvas_y: number }[],
  x: number,
  y: number,
) {
  while (
    nodes.some(
      (n) => Math.abs(n.canvas_x - x) < 170 && Math.abs(n.canvas_y - y) < 230,
    )
  ) {
    x += 190;
  }
  return { x, y };
}
