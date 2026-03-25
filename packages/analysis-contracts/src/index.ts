import { z } from "zod";
import {
  EngineRunSchema,
  InsightSchema,
  OverlayLayerSchema,
  PoseFrameSchema,
  ReplaySessionDocumentSchema,
  ReplaySessionSchema,
  SegmentSchema,
  TrackSchema,
  VideoAssetSchema,
  createSegment,
  createId,
  nowIso,
  sortSegments,
  upsertById,
  type EngineRun,
  type Insight,
  type OverlayLayer,
  type PoseFrame,
  type ReplaySessionDocument,
  type Segment,
  type Track,
  type VideoAsset
} from "@clubhall/video-domain";

export const EngineRequestSchema = z.object({
  version: z.literal("v1"),
  engineId: z.string().min(1),
  sessionId: z.string().min(1),
  assetId: z.string().min(1),
  segmentId: z.string().optional(),
  timeRangeMs: z.tuple([z.number().nonnegative(), z.number().nonnegative()]).optional(),
  options: z.record(z.string(), z.unknown()).default({})
});

export const EngineOutputSchema = z.object({
  segments: z.array(SegmentSchema).optional(),
  tracks: z.array(TrackSchema).optional(),
  poseFrames: z.array(PoseFrameSchema).optional(),
  insights: z.array(InsightSchema).optional(),
  diagnostics: z
    .object({
      latencyMs: z.number().finite().nonnegative().optional(),
      warnings: z.array(z.string()).default([])
    })
    .optional(),
  raw: z.record(z.string(), z.unknown()).optional()
});

export const ExportedAssetSchema = VideoAssetSchema.omit({
  storage: true
}).extend({
  storageHint: z.object({
    kind: z.enum(["opfs", "external"]),
    fileName: z.string().optional(),
    relinkRequired: z.boolean().default(true)
  })
});

export const ClubhallReplayExportV1Schema = z.object({
  version: z.literal("clubhall-replay/v1"),
  exportedAt: z.string().datetime(),
  assetFingerprint: z.string().min(1),
  asset: ExportedAssetSchema,
  session: ReplaySessionSchema,
  segments: z.array(SegmentSchema),
  tracks: z.array(TrackSchema),
  poseFrames: z.array(PoseFrameSchema),
  insights: z.array(InsightSchema),
  engineRuns: z.array(EngineRunSchema),
  overlayLayers: z.array(OverlayLayerSchema)
});

export type EngineRequest = z.infer<typeof EngineRequestSchema>;
export type EngineOutput = z.infer<typeof EngineOutputSchema>;
export type ClubhallReplayExportV1 = z.infer<typeof ClubhallReplayExportV1Schema>;

export function createSessionExport(document: ReplaySessionDocument): ClubhallReplayExportV1 {
  return ClubhallReplayExportV1Schema.parse({
    version: "clubhall-replay/v1",
    exportedAt: nowIso(),
    assetFingerprint: document.asset.fingerprint,
    asset: {
      ...document.asset,
      storageHint: {
        kind: document.asset.storage.kind,
        fileName: document.asset.storage.fileName,
        relinkRequired: document.asset.storage.relinkRequired
      }
    },
    session: document.session,
    segments: document.segments,
    tracks: document.tracks,
    poseFrames: document.poseFrames,
    insights: document.insights,
    engineRuns: document.engineRuns,
    overlayLayers: document.overlayLayers
  });
}

export function parseSessionExport(data: unknown) {
  return ClubhallReplayExportV1Schema.parse(data);
}

export function restoreDocumentFromExport(data: ClubhallReplayExportV1, asset: VideoAsset): ReplaySessionDocument {
  return ReplaySessionDocumentSchema.parse({
    asset,
    session: {
      ...data.session,
      assetId: asset.id,
      updatedAt: nowIso()
    },
    segments: data.segments.map((segment) => ({ ...segment, sessionId: data.session.id })),
    tracks: data.tracks.map((track) => ({ ...track, sessionId: data.session.id })),
    poseFrames: data.poseFrames.map((frame) => ({ ...frame, sessionId: data.session.id })),
    insights: data.insights.map((insight) => ({ ...insight, sessionId: data.session.id })),
    engineRuns: data.engineRuns.map((run) => ({
      ...run,
      target: {
        ...run.target,
        assetId: asset.id,
        sessionId: data.session.id
      }
    })),
    overlayLayers: data.overlayLayers.map((layer) => ({ ...layer, sessionId: data.session.id }))
  });
}

export function mergeEngineOutputIntoDocument(
  document: ReplaySessionDocument,
  run: EngineRun,
  output: EngineOutput
): ReplaySessionDocument {
  const nextSegments = [...document.segments];
  const nextTracks = [...document.tracks];
  const nextPoseFrames = [...document.poseFrames];
  const nextInsights = [...document.insights];

  for (const segment of output.segments ?? []) {
    nextSegments.push(SegmentSchema.parse({ ...segment, sessionId: document.session.id }));
  }

  for (const track of output.tracks ?? []) {
    const normalizedTrack = TrackSchema.parse({
      ...track,
      sessionId: document.session.id,
      runId: run.id,
      source: track.source ?? "engine"
    });
    const merged = upsertById(nextTracks, normalizedTrack);
    nextTracks.length = 0;
    nextTracks.push(...merged);
  }

  for (const frame of output.poseFrames ?? []) {
    const normalizedFrame = PoseFrameSchema.parse({
      ...frame,
      sessionId: document.session.id,
      runId: run.id
    });
    nextPoseFrames.push(normalizedFrame);
  }

  for (const insight of output.insights ?? []) {
    const normalizedInsight = InsightSchema.parse({
      ...insight,
      id: insight.id || createId("insight"),
      sessionId: document.session.id,
      runId: run.id,
      createdAt: insight.createdAt || nowIso()
    });
    nextInsights.push(normalizedInsight);
  }

  const normalizedRun = EngineRunSchema.parse({
    ...run,
    status: run.status,
    diagnostics: {
      ...run.diagnostics,
      ...output.diagnostics
    },
    updatedAt: nowIso()
  });

  return ReplaySessionDocumentSchema.parse({
    ...document,
    session: {
      ...document.session,
      engineRunIds: Array.from(new Set([...document.session.engineRunIds, normalizedRun.id])),
      updatedAt: nowIso()
    },
    segments: sortSegments(nextSegments),
    tracks: nextTracks,
    poseFrames: nextPoseFrames,
    insights: nextInsights,
    engineRuns: upsertById(document.engineRuns, normalizedRun)
  });
}

type Polygon = {
  points: Array<{ x: number; y: number }>;
};

export function proposeSegmentsFromSignals(input: {
  sessionId: string;
  durationMs: number;
  tracks: Track[];
  poseFrames?: PoseFrame[];
  exclusionZones?: OverlayLayer[];
}): Segment[] {
  const ballTracks = input.tracks.filter((track) => track.className === "sports ball");
  const playerTracks = input.tracks.filter((track) => track.className === "person");
  const zones = input.exclusionZones?.flatMap((layer) => ((layer.payload.zones as Polygon[] | undefined) ?? [])) ?? [];

  const ballSamples = ballTracks
    .flatMap((track) => track.points)
    .filter((sample) => sample.centroid && !isInsideAnyZone(sample.centroid, zones))
    .sort((left, right) => left.timestampMs - right.timestampMs);

  const proposals: Segment[] = [];
  let rallyStart = -1;
  for (let index = 0; index < ballSamples.length; index += 1) {
    const sample = ballSamples[index];
    const previous = ballSamples[index - 1];
    if (!previous || sample.timestampMs - previous.timestampMs > 1400) {
      rallyStart = sample.timestampMs;
      proposals.push(
        createSegment(
          input.sessionId,
          Math.max(0, sample.timestampMs - 600),
          Math.min(input.durationMs, sample.timestampMs + 1400),
          "Serve candidate",
          "proposal"
        )
      );
    }

    const next = ballSamples[index + 1];
    const gap = next ? next.timestampMs - sample.timestampMs : 2000;
    if (rallyStart >= 0 && gap > 1400) {
      const rallyEnd = sample.timestampMs;
      if (rallyEnd - rallyStart > 2200) {
        proposals.push(createSegment(input.sessionId, rallyStart, rallyEnd, "Rally candidate", "proposal"));
        proposals.push(
          createSegment(
            input.sessionId,
            Math.max(rallyStart, rallyEnd - 450),
            Math.min(input.durationMs, rallyEnd + 800),
            "End of point candidate",
            "proposal"
          )
        );
      }
      rallyStart = -1;
    }
  }

  for (const track of ballTracks) {
    for (let index = 1; index < track.points.length - 1; index += 1) {
      const previous = track.points[index - 1].centroid;
      const current = track.points[index].centroid;
      const next = track.points[index + 1].centroid;
      if (!previous || !current || !next) {
        continue;
      }

      const velocityBefore = distance(previous, current);
      const velocityAfter = distance(current, next);
      const delta = Math.abs(velocityAfter - velocityBefore);
      if (delta > 0.06) {
        proposals.push(
          createSegment(
            input.sessionId,
            Math.max(0, track.points[index].timestampMs - 180),
            Math.min(input.durationMs, track.points[index].timestampMs + 280),
            "Contact candidate",
            "proposal"
          )
        );
      }
    }
  }

  const movementSpike = detectPlayerMovementSpike(playerTracks);
  for (const time of movementSpike) {
    proposals.push(
      createSegment(
        input.sessionId,
        Math.max(0, time - 600),
        Math.min(input.durationMs, time + 900),
        "Movement spike",
        "proposal"
      )
    );
  }

  return dedupeSegments(sortSegments(proposals));
}

function dedupeSegments(segments: Segment[]) {
  const deduped: Segment[] = [];
  for (const segment of segments) {
    const duplicate = deduped.find(
      (candidate) =>
        candidate.label === segment.label &&
        Math.abs(candidate.startMs - segment.startMs) < 400 &&
        Math.abs(candidate.endMs - segment.endMs) < 400
    );
    if (!duplicate) {
      deduped.push(segment);
    }
  }
  return deduped;
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function detectPlayerMovementSpike(tracks: Track[]) {
  const spikes: number[] = [];
  for (const track of tracks) {
    for (let index = 1; index < track.points.length; index += 1) {
      const previous = track.points[index - 1].centroid;
      const current = track.points[index].centroid;
      if (!previous || !current) {
        continue;
      }
      const movement = distance(previous, current);
      if (movement > 0.085) {
        spikes.push(track.points[index].timestampMs);
      }
    }
  }
  return spikes;
}

function isInsideAnyZone(point: { x: number; y: number }, zones: Polygon[]) {
  return zones.some((zone) => isPointInsidePolygon(point, zone.points));
}

function isPointInsidePolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const xi = polygon[current].x;
    const yi = polygon[current].y;
    const xj = polygon[previous].x;
    const yj = polygon[previous].y;

    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function createTextInsight(
  sessionId: string,
  title: string,
  body: string,
  options: Partial<Pick<Insight, "segmentId" | "runId" | "confidence" | "kind">> = {}
): Insight {
  return InsightSchema.parse({
    id: createId("insight"),
    sessionId,
    title,
    body,
    kind: options.kind ?? "summary",
    segmentId: options.segmentId,
    runId: options.runId,
    confidence: options.confidence,
    createdAt: nowIso()
  });
}

export function createImportedOverlayLayer(
  sessionId: string,
  name: string,
  kind: OverlayLayer["kind"],
  payload: OverlayLayer["payload"]
): OverlayLayer {
  return OverlayLayerSchema.parse({
    id: createId("layer"),
    sessionId,
    name,
    kind,
    source: "import",
    visible: true,
    bindings: [],
    payload
  });
}
