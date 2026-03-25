import { createTextInsight } from "@clubhall/analysis-contracts";
import { PoseFrameSchema, createId, type Insight, type PoseFrame, type Segment, type Track } from "@clubhall/video-domain";

export type PoseAnalysisResult = {
  poseFrames: PoseFrame[];
  insights: Insight[];
  diagnostics?: {
    warnings: string[];
  };
};

export interface PoseProvider {
  id: string;
  label: string;
  isAvailable(): Promise<boolean>;
  analyzeSegment(input: {
    sessionId: string;
    segment: Segment;
    tracks: Track[];
  }): Promise<PoseAnalysisResult>;
}

export function createBrowserPoseProvider(): PoseProvider {
  return {
    id: "browser-track-box",
    label: "Browser fallback pose",
    async isAvailable() {
      return typeof window !== "undefined";
    },
    async analyzeSegment({ sessionId, segment, tracks }) {
      const personTracks = tracks.filter((track) => track.className === "person");
      const poseFrames: PoseFrame[] = [];
      for (const track of personTracks) {
        for (const point of track.points) {
          if (point.timestampMs < segment.startMs || point.timestampMs > segment.endMs || !point.box) {
            continue;
          }
          poseFrames.push(
            PoseFrameSchema.parse({
              id: createId("pose"),
              sessionId,
              trackId: track.id,
              timestampMs: point.timestampMs,
              provider: "browser-track-box",
              keypoints: createFallbackKeypoints(point.box)
            })
          );
        }
      }

      return {
        poseFrames,
        insights: [
          createTextInsight(
            sessionId,
            "Pose overlay",
            poseFrames.length > 0
              ? "Browser fallback pose skeleton generated from detected player boxes."
              : "No person tracks were available for fallback pose generation.",
            { segmentId: segment.id, kind: "diagnostic" }
          )
        ],
        diagnostics: {
          warnings: ["Fallback pose provider uses tracked person boxes until MediaPipe or ViTPose is configured."]
        }
      };
    }
  };
}

function createFallbackKeypoints(box: { x: number; y: number; width: number; height: number }) {
  const left = box.x;
  const top = box.y;
  const width = box.width;
  const height = box.height;

  return [
    { name: "left_shoulder", x: left + width * 0.32, y: top + height * 0.26, visibility: 0.72 },
    { name: "right_shoulder", x: left + width * 0.68, y: top + height * 0.26, visibility: 0.72 },
    { name: "left_elbow", x: left + width * 0.26, y: top + height * 0.44, visibility: 0.68 },
    { name: "right_elbow", x: left + width * 0.74, y: top + height * 0.44, visibility: 0.68 },
    { name: "left_wrist", x: left + width * 0.2, y: top + height * 0.62, visibility: 0.63 },
    { name: "right_wrist", x: left + width * 0.8, y: top + height * 0.62, visibility: 0.63 },
    { name: "left_hip", x: left + width * 0.4, y: top + height * 0.56, visibility: 0.82 },
    { name: "right_hip", x: left + width * 0.6, y: top + height * 0.56, visibility: 0.82 },
    { name: "left_knee", x: left + width * 0.38, y: top + height * 0.78, visibility: 0.7 },
    { name: "right_knee", x: left + width * 0.62, y: top + height * 0.78, visibility: 0.7 },
    { name: "left_ankle", x: left + width * 0.36, y: top + height * 0.98, visibility: 0.58 },
    { name: "right_ankle", x: left + width * 0.64, y: top + height * 0.98, visibility: 0.58 }
  ];
}

