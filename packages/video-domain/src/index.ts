import { z } from "zod";

export const TimestampMsSchema = z.number().finite().nonnegative();

export const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const BoundingBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative()
});

export const VideoStorageSchema = z.object({
  kind: z.enum(["opfs", "external"]),
  opfsPath: z.string().optional(),
  fileName: z.string().optional(),
  relinkRequired: z.boolean().default(false)
});

export const VideoAssetSchema = z.object({
  id: z.string().min(1),
  fingerprint: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: TimestampMsSchema.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  storage: VideoStorageSchema
});

export const SegmentSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    label: z.string().min(1),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
    startMs: TimestampMsSchema,
    endMs: TimestampMsSchema,
    color: z.string().optional(),
    source: z.enum(["manual", "proposal", "engine", "import"]),
    confidence: z.number().min(0).max(1).optional(),
    accepted: z.boolean().default(true),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .refine((segment) => segment.endMs > segment.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"]
  });

export const TrackSampleSchema = z.object({
  timestampMs: TimestampMsSchema,
  box: BoundingBoxSchema.optional(),
  centroid: PointSchema.optional(),
  confidence: z.number().min(0).max(1).optional()
});

export const TrackSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  runId: z.string().optional(),
  label: z.string().min(1),
  className: z.string().min(1),
  source: z.enum(["engine", "manual", "import"]),
  color: z.string().optional(),
  points: z.array(TrackSampleSchema).default([])
});

export const PoseKeypointSchema = z.object({
  name: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite().optional(),
  visibility: z.number().min(0).max(1).optional()
});

export const PoseFrameSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  trackId: z.string().optional(),
  runId: z.string().optional(),
  timestampMs: TimestampMsSchema,
  provider: z.string().min(1),
  keypoints: z.array(PoseKeypointSchema)
});

export const InsightSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  segmentId: z.string().optional(),
  runId: z.string().optional(),
  kind: z.enum(["summary", "caption", "event", "metric", "diagnostic"]),
  title: z.string().min(1),
  body: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime()
});

export const OverlayLayerSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["boxes", "trails", "keypoints", "court-lines", "exclusion-zones"]),
  source: z.enum(["manual", "engine", "import", "system"]),
  visible: z.boolean().default(true),
  color: z.string().optional(),
  bindings: z.array(z.string()).default([]),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const EngineRunTargetSchema = z.object({
  assetId: z.string().min(1),
  sessionId: z.string().min(1),
  segmentId: z.string().optional(),
  timeRangeMs: z.tuple([TimestampMsSchema, TimestampMsSchema]).optional()
});

export const EngineRunSchema = z.object({
  id: z.string().min(1),
  engineId: z.string().min(1),
  engineVersion: z.string().min(1),
  target: EngineRunTargetSchema,
  status: z.enum(["queued", "running", "completed", "failed"]),
  diagnostics: z
    .object({
      latencyMs: z.number().finite().nonnegative().optional(),
      warnings: z.array(z.string()).default([]),
      meanConfidence: z.number().min(0).max(1).optional(),
      error: z.string().optional()
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ReplaySessionSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  title: z.string().min(1),
  selectedSegmentId: z.string().optional(),
  overlayVisibility: z.record(z.string(), z.boolean()).default({}),
  engineRunIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  lastViewedTimeMs: TimestampMsSchema.default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ReplaySessionDocumentSchema = z.object({
  asset: VideoAssetSchema,
  session: ReplaySessionSchema,
  segments: z.array(SegmentSchema).default([]),
  tracks: z.array(TrackSchema).default([]),
  poseFrames: z.array(PoseFrameSchema).default([]),
  insights: z.array(InsightSchema).default([]),
  engineRuns: z.array(EngineRunSchema).default([]),
  overlayLayers: z.array(OverlayLayerSchema).default([])
});

export type Point = z.infer<typeof PointSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type VideoStorage = z.infer<typeof VideoStorageSchema>;
export type VideoAsset = z.infer<typeof VideoAssetSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type TrackSample = z.infer<typeof TrackSampleSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type PoseKeypoint = z.infer<typeof PoseKeypointSchema>;
export type PoseFrame = z.infer<typeof PoseFrameSchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type OverlayLayer = z.infer<typeof OverlayLayerSchema>;
export type EngineRunTarget = z.infer<typeof EngineRunTargetSchema>;
export type EngineRun = z.infer<typeof EngineRunSchema>;
export type ReplaySession = z.infer<typeof ReplaySessionSchema>;
export type ReplaySessionDocument = z.infer<typeof ReplaySessionDocumentSchema>;

export const DEFAULT_LAYER_DEFINITIONS = [
  { id: "boxes", name: "Detections", kind: "boxes", color: "#86efac" },
  { id: "trails", name: "Trails", kind: "trails", color: "#7dd3fc" },
  { id: "keypoints", name: "Pose", kind: "keypoints", color: "#fbbf24" },
  { id: "court-lines", name: "Court", kind: "court-lines", color: "#f4efe5" },
  { id: "exclusion-zones", name: "Exclusion", kind: "exclusion-zones", color: "#f87171" }
] as const;

export function createId(prefix: string) {
  const entropy = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${entropy}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createDefaultOverlayLayers(sessionId: string): OverlayLayer[] {
  return DEFAULT_LAYER_DEFINITIONS.map((layer) =>
    OverlayLayerSchema.parse({
      id: layer.id,
      sessionId,
      name: layer.name,
      kind: layer.kind,
      color: layer.color,
      source: "system",
      visible: true,
      bindings: [],
      payload: {}
    })
  );
}

export function createSessionDocument(asset: VideoAsset, title = asset.name.replace(/\.[^/.]+$/, "")): ReplaySessionDocument {
  const createdAt = nowIso();
  const sessionId = createId("session");
  return ReplaySessionDocumentSchema.parse({
    asset,
    session: {
      id: sessionId,
      assetId: asset.id,
      title,
      selectedSegmentId: undefined,
      overlayVisibility: {},
      engineRunIds: [],
      tags: [],
      lastViewedTimeMs: 0,
      createdAt,
      updatedAt: createdAt
    },
    segments: [],
    tracks: [],
    poseFrames: [],
    insights: [],
    engineRuns: [],
    overlayLayers: createDefaultOverlayLayers(sessionId)
  });
}

export function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  const next = [...items];
  next[index] = nextItem;
  return next;
}

export function sortSegments(segments: Segment[]) {
  return [...segments].sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
}

export function formatTimecode(timeMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function createSegment(
  sessionId: string,
  startMs: number,
  endMs: number,
  label = "Untitled moment",
  source: Segment["source"] = "manual"
): Segment {
  const timestamp = nowIso();
  return SegmentSchema.parse({
    id: createId("segment"),
    sessionId,
    label,
    tags: [],
    startMs,
    endMs,
    color: "#86efac",
    source,
    accepted: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function createEngineRun(
  engineId: string,
  engineVersion: string,
  target: EngineRunTarget,
  status: EngineRun["status"] = "queued"
): EngineRun {
  const createdAt = nowIso();
  return EngineRunSchema.parse({
    id: createId("run"),
    engineId,
    engineVersion,
    target,
    status,
    createdAt,
    updatedAt: createdAt
  });
}

export function findSelectedSegment(document: ReplaySessionDocument) {
  return document.segments.find((segment) => segment.id === document.session.selectedSegmentId) ?? null;
}

export function getTrackSampleAtTime(track: Track, timeMs: number, toleranceMs = 100) {
  let best: TrackSample | undefined;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const point of track.points) {
    const delta = Math.abs(point.timestampMs - timeMs);
    if (delta <= toleranceMs && delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return best;
}

export function getPoseFrameAtTime(frames: PoseFrame[], timeMs: number, toleranceMs = 120) {
  let best: PoseFrame | undefined;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const delta = Math.abs(frame.timestampMs - timeMs);
    if (delta <= toleranceMs && delta < bestDelta) {
      best = frame;
      bestDelta = delta;
    }
  }
  return best;
}

export function getSegmentMidpoint(segment: Segment) {
  return segment.startMs + (segment.endMs - segment.startMs) / 2;
}

export function mergeSessionDocument(
  document: ReplaySessionDocument,
  patch: Partial<Omit<ReplaySessionDocument, "session" | "asset">> & {
    session?: Partial<ReplaySession>;
    asset?: Partial<VideoAsset>;
  }
): ReplaySessionDocument {
  return ReplaySessionDocumentSchema.parse({
    ...document,
    ...patch,
    session: {
      ...document.session,
      ...patch.session,
      updatedAt: nowIso()
    },
    asset: {
      ...document.asset,
      ...patch.asset,
      updatedAt: nowIso()
    }
  });
}

