import { describe, expect, it } from "vitest";
import {
  comparisonWindow,
  comparisonTimes,
  ComparisonSchema,
} from "./comparison";

describe("reference-aligned shared coverage", () => {
  it("aligns unequal references while retaining only the common interval", () => {
    const window = comparisonWindow(8000, 8000, 1000, 3000);
    expect(window).toEqual({
      leftStartMs: 0,
      rightStartMs: 2000,
      durationMs: 6000,
      referenceMs: 1000,
      offsetMs: 2000,
    });
    expect(comparisonTimes(window, window.referenceMs)).toEqual({
      positionMs: 1000,
      leftMs: 1000,
      rightMs: 3000,
    });
  });
  it("handles a negative offset and asymmetric source durations", () => {
    const window = comparisonWindow(5000, 9000, 3000, 1000);
    expect(window).toEqual({
      leftStartMs: 2000,
      rightStartMs: 0,
      durationMs: 3000,
      referenceMs: 1000,
      offsetMs: -2000,
    });
    expect(comparisonTimes(window, 4000)).toEqual({
      positionMs: 3000,
      leftMs: 5000,
      rightMs: 3000,
    });
    expect(comparisonTimes(window, -99)).toEqual({
      positionMs: 0,
      leftMs: 2000,
      rightMs: 0,
    });
  });
  it("rejects unsupported state, nonfinite values and references outside actual media", () => {
    for (const args of [
      [0, 8000, 0, 0],
      [8000, 8000, 8000, 0],
      [8000, 8000, 0, -1],
      [NaN, 8000, 0, 0],
    ])
      expect(() =>
        comparisonWindow(args[0], args[1], args[2], args[3]),
      ).toThrow();
    expect(() =>
      comparisonTimes(comparisonWindow(8000, 8000, 0, 0), Infinity),
    ).toThrow();
    expect(() =>
      ComparisonSchema.parse({ version: "comparison/v2" }),
    ).toThrow();
  });
});
