export type CoachStroke = "forehand" | "backhand" | "serve" | "return";

export interface CoachIdentity {
  sessionId: string;
  assetId: string;
  assetFingerprint: string;
  athleteId: string;
  playerTrackId: string;
  revision: number;
}

export interface CoachAthlete {
  id: string;
  playerTrackId: string;
  dominantHand: "left" | "right" | "unknown";
  backhand: "one-handed" | "two-handed" | "unknown";
  experience: string;
  goal: string;
  painReported?: boolean;
}

/** Coordinates refer to the decoded source image, before display transforms. */
export interface CoachPoseFrame {
  id: string;
  sessionId: string;
  trackId: string;
  timestampMs: number;
  keypoints: Array<{ name: string; x: number; y: number; visibility?: number }>;
}

export interface CoachPoseEvidence extends CoachIdentity {
  id: string;
  kind: "model" | "geometric-demo";
  state: "inferred" | "confirmed" | "demo" | "rejected";
  provider: string;
  modelVersion: string;
  runId: string;
  coordinates: "source-normalized";
  identityVerified: boolean;
  cameraStable: boolean;
  bodyFullyVisible: boolean;
  personHeightPx: number;
  frames: CoachPoseFrame[];
}

/** Human labels are separate from model output; pose alone cannot mark contact. */
export interface CoachPhaseMark extends CoachIdentity {
  id: string;
  phase: "preparation" | "contact";
  timestampMs: number;
  source: "manual";
  state: "confirmed" | "rejected";
  methodVersion: string;
  confirmedBy: string;
}

export interface CoachInput {
  requestId: string;
  sessionId: string;
  assetId: string;
  assetFingerprint: string;
  revision: number;
  durationMs: number;
  startMs: number;
  endMs: number;
  athlete: CoachAthlete;
  stroke: CoachStroke;
  pose?: CoachPoseEvidence;
  phaseMarks?: CoachPhaseMark[];
}

export type CoachAction =
  | { type: "seek"; timestampMs: number }
  | { type: "slow"; rate: 0.25 | 0.5 | 1 }
  | { type: "loop"; startMs: number; endMs: number }
  | { type: "request_confirmation"; eventId: string }
  | { type: "offer_drill"; drillId: string };

export interface CoachDrill {
  id: string;
  title: string;
  instructions: string;
  objective: string;
  comparison: string;
  origin: "clubhall-authored-adaptation";
  sourceIds: string[];
}

export interface CoachObservation extends CoachIdentity {
  id: string;
  evidenceIds: string[];
  stroke: CoachStroke;
  phase: "preparation";
  startMs: number;
  endMs: number;
  observation: string;
  interpretation: string;
  uncertainty: string;
  strength: string;
  cue?: string;
  drill?: CoachDrill;
  sourceIds: string[];
  reassessment: string;
}

export type CoachAbstentionReason =
  | "invalid_context"
  | "missing_pose"
  | "non_body_evidence"
  | "identity_mismatch"
  | "stale_revision"
  | "invalid_timestamps"
  | "insufficient_quality"
  | "unsupported_stroke"
  | "missing_phase_confirmation"
  | "contradictory_phases";

export type CoachResult = {
  requestId: string;
  revision: number;
  rubricVersion: string;
  knowledgeVersion: string;
  actions: CoachAction[];
} & (
  | {
      status: "abstained";
      reason: CoachAbstentionReason;
      message: string;
      missingEvidence: string[];
    }
  | { status: "observation"; observation: CoachObservation }
);

export interface CoachKnowledgeSource {
  sourceId: string;
  url: string;
  title: string;
  authors: string[];
  organization: string;
  publicationYear: number | null;
  accessedOn: string;
  paraphrase: string;
  populationAndTask: string;
  evidenceType:
    | "federation-coaching-curriculum"
    | "federation-coaching-advice"
    | "model-documentation";
  evidenceStrength: string;
  restrictions: string[];
  concepts: string[];
}
