import { createSessionExport } from "@clubhall/analysis-contracts";
import {
  OverlayLayerSchema,
  TrackSchema,
  createEngineRun,
  createSessionDocument,
  nowIso,
  type ReplaySessionDocument
} from "@clubhall/video-domain";

export function createFixtureDocument(): ReplaySessionDocument {
  const document = createSessionDocument({
    id: "asset_fixture",
    fingerprint: "fixture-asset",
    name: "sample-match.mp4",
    mimeType: "video/mp4",
    sizeBytes: 10_000_000,
    durationMs: 180_000,
    width: 1920,
    height: 1080,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    storage: {
      kind: "external",
      relinkRequired: true,
      fileName: "sample-match.mp4"
    }
  });

  const run = createEngineRun("rfdetr", "fixture", {
    assetId: document.asset.id,
    sessionId: document.session.id
  });

  document.tracks = [
    TrackSchema.parse({
      id: "track_player_a",
      sessionId: document.session.id,
      runId: run.id,
      label: "Near player",
      className: "person",
      source: "engine",
      color: "#86efac",
      points: [
        { timestampMs: 5_000, centroid: { x: 0.42, y: 0.71 }, box: { x: 0.35, y: 0.47, width: 0.14, height: 0.34 }, confidence: 0.95 },
        { timestampMs: 7_000, centroid: { x: 0.41, y: 0.7 }, box: { x: 0.34, y: 0.46, width: 0.15, height: 0.35 }, confidence: 0.95 },
        { timestampMs: 9_000, centroid: { x: 0.43, y: 0.68 }, box: { x: 0.35, y: 0.44, width: 0.16, height: 0.36 }, confidence: 0.95 }
      ]
    }),
    TrackSchema.parse({
      id: "track_ball",
      sessionId: document.session.id,
      runId: run.id,
      label: "Ball",
      className: "sports ball",
      source: "engine",
      color: "#7dd3fc",
      points: [
        { timestampMs: 5_200, centroid: { x: 0.48, y: 0.46 }, confidence: 0.88 },
        { timestampMs: 5_700, centroid: { x: 0.5, y: 0.44 }, confidence: 0.89 },
        { timestampMs: 6_100, centroid: { x: 0.55, y: 0.39 }, confidence: 0.92 },
        { timestampMs: 6_500, centroid: { x: 0.58, y: 0.33 }, confidence: 0.91 },
        { timestampMs: 7_000, centroid: { x: 0.52, y: 0.42 }, confidence: 0.9 },
        { timestampMs: 7_500, centroid: { x: 0.44, y: 0.51 }, confidence: 0.87 },
        { timestampMs: 8_000, centroid: { x: 0.36, y: 0.58 }, confidence: 0.87 }
      ]
    })
  ];
  document.engineRuns = [
    {
      ...run,
      status: "completed",
      diagnostics: {
        latencyMs: 512,
        warnings: [],
        meanConfidence: 0.9
      }
    }
  ];
  document.overlayLayers = [
    ...document.overlayLayers,
    OverlayLayerSchema.parse({
      id: "layer_court_fixture",
      sessionId: document.session.id,
      name: "Fixture court",
      kind: "court-lines",
      source: "import",
      visible: true,
      bindings: [],
      payload: {
        lines: [
          [{ x: 0.12, y: 0.16 }, { x: 0.88, y: 0.16 }],
          [{ x: 0.22, y: 0.82 }, { x: 0.78, y: 0.82 }]
        ]
      }
    })
  ];

  return document;
}

export function createFixtureExport() {
  return createSessionExport(createFixtureDocument());
}

