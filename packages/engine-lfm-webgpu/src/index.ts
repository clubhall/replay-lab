import { createTextInsight } from "@clubhall/analysis-contracts";
import { type Insight, type ReplaySessionDocument, type Segment, type Track } from "@clubhall/video-domain";

export type LfmSummaryResult = {
  insight: Insight | null;
  warnings: string[];
  available: boolean;
};

export async function summarizeSegmentWithLfmWebGpu(input: {
  enabled: boolean;
  document: ReplaySessionDocument;
  segment: Segment;
}): Promise<LfmSummaryResult> {
  if (!input.enabled) {
    return {
      insight: null,
      warnings: ["LFM WebGPU lane is disabled by feature flag."],
      available: false
    };
  }

  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return {
      insight: null,
      warnings: ["WebGPU is unavailable in this browser; semantic lane skipped."],
      available: false
    };
  }

  const tracksInSegment = filterTracksForSegment(input.document.tracks, input.segment);
  const ballSamples = tracksInSegment.filter((track) => track.className === "sports ball").flatMap((track) => track.points).length;
  const playerSamples = tracksInSegment.filter((track) => track.className === "person").flatMap((track) => track.points).length;
  const body = buildFallbackNarrative(input.segment, ballSamples, playerSamples);

  return {
    insight: createTextInsight(input.document.session.id, "Segment semantic summary", body, {
      kind: "summary",
      segmentId: input.segment.id,
      confidence: 0.45
    }),
    warnings: ["Heuristic fallback summary generated. Replace with LFM model runner when model assets are configured."],
    available: true
  };
}

function filterTracksForSegment(tracks: Track[], segment: Segment) {
  return tracks
    .map((track) => ({
      ...track,
      points: track.points.filter((point) => point.timestampMs >= segment.startMs && point.timestampMs <= segment.endMs)
    }))
    .filter((track) => track.points.length > 0);
}

function buildFallbackNarrative(segment: Segment, ballSamples: number, playerSamples: number) {
  const durationSeconds = Math.round((segment.endMs - segment.startMs) / 1000);
  if (ballSamples === 0 && playerSamples === 0) {
    return `Segment spans ${durationSeconds}s with limited visual signals. Treat this as an ambiguous moment that needs manual naming.`;
  }
  if (ballSamples > 4) {
    return `Segment spans ${durationSeconds}s with sustained ball visibility and ${playerSamples} player detections. This likely captures an active rally window or point transition.`;
  }
  return `Segment spans ${durationSeconds}s with ${playerSamples} player detections and short ball visibility. This likely captures setup, recovery, or a serve/contact moment.`;
}
