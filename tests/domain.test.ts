import { it, expect } from "vitest";
import {
  normalize,
  seriesLabel,
  childId,
  wouldCycle,
  placement,
} from "../src/domain";
it("series A-Z and AA", () => {
  expect(seriesLabel(0)).toBe("A");
  expect(seriesLabel(25)).toBe("Z");
  expect(seriesLabel(26)).toBe("AA");
  expect(seriesLabel(701)).toBe("ZZ");
});
it("root based monotonically allocated child IDs", () => {
  expect(childId("A-000", 1)).toBe("A-001");
  expect(childId("PORTRAIT-000", 1)).toBe("PORTRAIT-001");
  expect(childId("CAT", 1)).toBe("CAT-001");
  expect(childId("PROJECT-12", 4)).toBe("PROJECT-12-004");
  expect(childId("A-000", 1000)).toBe("A-1000");
});
it("normalizes width, case and Unicode", () => {
  expect(normalize(" Ａ－００１ ")).toBe(normalize("a-001"));
  expect(normalize("Straße")).toBe(normalize("STRASSE"));
});
it("rejects parent cycles but allows references", () => {
  const edges = [
    { source_card_id: "a", target_card_id: "b", kind: "parent" },
    { source_card_id: "b", target_card_id: "c", kind: "parent" },
  ];
  expect(wouldCycle(edges, "c", "a")).toBe(true);
  expect(wouldCycle(edges, "a", "c")).toBe(false);
  expect(wouldCycle([{ ...edges[0], kind: "reference" }], "b", "a")).toBe(
    false,
  );
});
it("avoids overlapping initial positions", () => {
  expect(placement([{ canvas_x: 0, canvas_y: 0 }], 0, 0)).toEqual({
    x: 190,
    y: 0,
  });
});
