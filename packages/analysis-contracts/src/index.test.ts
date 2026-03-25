import { describe, expect, it } from "vitest";
import { createSessionDocument, nowIso } from "@clubhall/video-domain";
import { createSessionExport, parseSessionExport, proposeSegmentsFromSignals } from "./index";

describe("analysis-contracts", () => {
  it("round-trips a session export without embedding the video binary", () => {
    const document = createSessionDocument({
      id: "asset_fixture",
      fingerprint: "fixture-fingerprint",
      name: "match.mp4",
      mimeType: "video/mp4",
      sizeBytes: 100,
      durationMs: 20_000,
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
    const exported = createSessionExport(document);
    const parsed = parseSessionExport(exported);

    expect(parsed.version).toBe("clubhall-replay/v1");
    expect(parsed.assetFingerprint).toBe(document.asset.fingerprint);
    expect(parsed.asset).not.toHaveProperty("storage");
  });

  it("proposes tennis-oriented segments from tracked ball and player signals", () => {
    const document = createSessionDocument({
      id: "asset_fixture",
      fingerprint: "fixture-fingerprint",
      name: "match.mp4",
      mimeType: "video/mp4",
      sizeBytes: 100,
      durationMs: 20_000,
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
    document.tracks = [
      {
        id: "track_ball",
        sessionId: document.session.id,
        label: "Ball",
        className: "sports ball",
        source: "engine",
        points: [
          { timestampMs: 5_000, centroid: { x: 0.4, y: 0.6 }, confidence: 0.9 },
          { timestampMs: 5_500, centroid: { x: 0.48, y: 0.48 }, confidence: 0.92 },
          { timestampMs: 6_000, centroid: { x: 0.58, y: 0.36 }, confidence: 0.91 },
          { timestampMs: 7_000, centroid: { x: 0.5, y: 0.46 }, confidence: 0.88 },
          { timestampMs: 8_000, centroid: { x: 0.42, y: 0.56 }, confidence: 0.87 }
        ]
      },
      {
        id: "track_player",
        sessionId: document.session.id,
        label: "Player",
        className: "person",
        source: "engine",
        points: [
          { timestampMs: 5_000, centroid: { x: 0.35, y: 0.74 }, confidence: 0.95 },
          { timestampMs: 5_500, centroid: { x: 0.4, y: 0.7 }, confidence: 0.95 },
          { timestampMs: 6_000, centroid: { x: 0.5, y: 0.65 }, confidence: 0.95 }
        ]
      }
    ];
    const proposals = proposeSegmentsFromSignals({
      sessionId: document.session.id,
      durationMs: document.asset.durationMs ?? 0,
      tracks: document.tracks
    });

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.some((segment) => segment.label.includes("candidate"))).toBe(true);
  });
});
