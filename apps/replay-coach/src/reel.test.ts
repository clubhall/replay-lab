import { describe, it, expect } from "vitest";
import { RenderSchema, ReelSchema, reviseReel } from "./reel";
const clip = {
  id: "c1",
  sessionId: "s1",
  fingerprint: "a".repeat(64),
  label: "A",
  startMs: 0,
  endMs: 30_000,
};
const reel = {
  version: "reel/v1" as const,
  id: "r",
  revision: 0,
  clips: [clip],
};
describe("immutable multiasset selections", () => {
  it("keeps the old render snapshot when trim/order changes", () => {
    const next = reviseReel(reel, [{ ...clip, endMs: 20_000 }]);
    expect(next.revision).toBe(1);
    expect(reel.clips[0].endMs).toBe(30_000);
  });
  it("rejects duplicate IDs, unsupported versions, missing originals and resource limits", () => {
    expect(() => ReelSchema.parse({ ...reel, clips: [clip, clip] })).toThrow();
    expect(() => ReelSchema.parse({ ...reel, version: "reel/v2" })).toThrow();
    expect(() =>
      RenderSchema.parse({
        reel,
        sources: [{ fingerprint: "b".repeat(64), size: 1 }],
      }),
    ).toThrow();
    expect(() =>
      RenderSchema.parse({
        reel: { ...reel, clips: [{ ...clip, endMs: 121_000 }] },
        sources: [{ fingerprint: clip.fingerprint, size: 1 }],
      }),
    ).toThrow();
    expect(() =>
      RenderSchema.parse({
        reel,
        sources: [{ fingerprint: clip.fingerprint, size: 1024 ** 3 + 1 }],
      }),
    ).toThrow();
  });
});
