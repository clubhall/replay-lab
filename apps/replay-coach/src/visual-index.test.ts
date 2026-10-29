import { describe, it, expect } from "vitest";
import { indexFrames } from "./visual-index";
describe("measured visual-change indexing", () => {
  it("links detected intervals to original time without making sporting claims", () => {
    const frames = new Uint8Array(32 * 18 * 12);
    frames.fill(255, 32 * 18 * 6);
    const result = indexFrames(frames, "a".repeat(64), "run");
    expect(result.coverageMs).toBe(6000);
    expect(result.candidates).toEqual([
      {
        id: `${"a".repeat(64)}:3000`,
        startMs: 2000,
        endMs: 5000,
        changeScore: 1,
      },
    ]);
    expect(result.warnings.join(" ")).toContain("não identifica golpes");
  });
  it("abstains on constant images rather than inventing moments", () => {
    expect(
      indexFrames(new Uint8Array(32 * 18 * 10), "b".repeat(64), "run")
        .candidates,
    ).toEqual([]);
  });
});
