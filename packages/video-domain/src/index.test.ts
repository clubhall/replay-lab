import { describe, expect, it } from "vitest";
import { SegmentSchema, createSegment, createSessionDocument, formatTimecode, nowIso } from "./index";

describe("video-domain", () => {
  it("creates valid manual segments with increasing timestamps", () => {
    const segment = createSegment("session_1", 1_000, 4_500, "Baseline rally");
    expect(segment.startMs).toBe(1_000);
    expect(segment.endMs).toBe(4_500);
    expect(segment.source).toBe("manual");
  });

  it("rejects segments whose end timestamp does not exceed start timestamp", () => {
    expect(() =>
      SegmentSchema.parse({
        id: "segment_bad",
        sessionId: "session_1",
        label: "Bad",
        tags: [],
        startMs: 3_000,
        endMs: 3_000,
        source: "manual",
        accepted: true,
        createdAt: nowIso(),
        updatedAt: nowIso()
      })
    ).toThrow(/greater/);
  });

  it("formats timecodes for sub-hour and multi-hour values", () => {
    expect(formatTimecode(61_000)).toBe("1:01");
    expect(formatTimecode(3_661_000)).toBe("1:01:01");
  });

  it("creates a session document with default overlay layers", () => {
    const document = createSessionDocument({
      id: "asset_1",
      fingerprint: "fingerprint",
      name: "match.mp4",
      mimeType: "video/mp4",
      sizeBytes: 10,
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      storage: {
        kind: "external",
        fileName: "match.mp4",
        relinkRequired: true
      }
    });
    expect(document.overlayLayers).toHaveLength(5);
  });
});

