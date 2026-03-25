import { describe, expect, it } from "vitest";
import { scaleBox, scalePoint } from "./index";

describe("replay-overlays", () => {
  it("scales normalized points to canvas coordinates", () => {
    const scaled = scalePoint({ x: 0.5, y: 0.25 }, { width: 800, height: 400 }, { width: 1920, height: 1080 });
    expect(scaled).toEqual({ x: 400, y: 100 });
  });

  it("scales normalized boxes to canvas coordinates", () => {
    const scaled = scaleBox(
      { x: 0.1, y: 0.2, width: 0.25, height: 0.3 },
      { width: 1000, height: 500 },
      { width: 1920, height: 1080 }
    );
    expect(scaled).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 150
    });
  });
});

