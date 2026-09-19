import { describe, expect, it } from "vitest";
import {
  coachKnowledge,
  evaluateCoach,
  type CoachInput,
  type CoachPoseEvidence,
} from "./index";

/** Fabricated contract fixtures, never athlete or model-validation evidence. */
function fixture(): CoachInput & { pose: CoachPoseEvidence } {
  const identity = {
    sessionId: "session",
    assetId: "asset",
    assetFingerprint: "fingerprint",
    athleteId: "athlete",
    playerTrackId: "player",
    revision: 2,
  };
  return {
    requestId: "request",
    sessionId: "session",
    assetId: "asset",
    assetFingerprint: "fingerprint",
    revision: 2,
    durationMs: 10_000,
    startMs: 1000,
    endMs: 1800,
    athlete: {
      id: "athlete",
      playerTrackId: "player",
      dominantHand: "right",
      backhand: "two-handed",
      experience: "self-reported recreational",
      goal: "Review preparation",
    },
    stroke: "forehand",
    pose: {
      ...identity,
      id: "pose",
      kind: "model",
      state: "inferred",
      provider: "mediapipe-pose-landmarker",
      modelVersion: "fixture-version",
      runId: "fixture-run",
      coordinates: "source-normalized",
      identityVerified: true,
      cameraStable: true,
      bodyFullyVisible: true,
      personHeightPx: 300,
      frames: Array.from({ length: 9 }, (_, i) => ({
        id: `frame-${i}`,
        sessionId: "session",
        trackId: "player",
        timestampMs: 1000 + i * 100,
        keypoints: [
          "shoulder",
          "elbow",
          "wrist",
          "hip",
          "knee",
          "ankle",
        ].flatMap((joint, j) => [
          {
            name: `left_${joint}`,
            x: 0.4,
            y: 0.1 + j * 0.14,
            visibility: 0.95,
          },
          {
            name: `right_${joint}`,
            x: 0.6,
            y: 0.1 + j * 0.14,
            visibility: 0.95,
          },
        ]),
      })),
    },
    phaseMarks: [
      {
        ...identity,
        id: "prep",
        phase: "preparation",
        timestampMs: 1100,
        source: "manual",
        state: "confirmed",
        methodVersion: "human-v1",
        confirmedBy: "reviewer",
      },
      {
        ...identity,
        id: "contact",
        phase: "contact",
        timestampMs: 1700,
        source: "manual",
        state: "confirmed",
        methodVersion: "human-v1",
        confirmedBy: "reviewer",
      },
    ],
  };
}

function expectAbstention(input: CoachInput, reason: string) {
  const result = evaluateCoach(input);
  expect(result).toMatchObject({ status: "abstained", reason });
  expect(result).not.toHaveProperty("observation");
  expect(result.actions.some((action) => action.type === "offer_drill")).toBe(
    false,
  );
}

describe("evidence-grounded tennis coach", () => {
  it("abstains without pose; no generic tip is promoted to a detected error", () => {
    expectAbstention({ ...fixture(), pose: undefined }, "missing_pose");
  });

  it.each(["browser-track-box", "synthetic-pose", "fallback", "demo-pose"])(
    "rejects %s even when labeled model",
    (provider) => {
      const input = fixture();
      input.pose.provider = provider;
      expectAbstention(input, "non_body_evidence");
    },
  );

  it.each(["demo", "rejected"] as const)("rejects %s state", (state) => {
    const input = fixture();
    input.pose.state = state;
    expectAbstention(input, "non_body_evidence");
  });

  it("rejects absent model provenance", () => {
    const input = fixture();
    input.pose.modelVersion = "";
    expectAbstention(input, "non_body_evidence");
  });

  it.each([
    "sessionId",
    "assetId",
    "assetFingerprint",
    "athleteId",
    "playerTrackId",
  ] as const)("rejects mismatched %s", (key) => {
    const input = fixture();
    input.pose[key] = "other";
    expectAbstention(input, "identity_mismatch");
  });

  it("stops after an identity switch in any frame", () => {
    const input = fixture();
    input.pose.frames[4].trackId = "opponent";
    expectAbstention(input, "identity_mismatch");
  });

  it("requires verified identity even with one pose", () => {
    const input = fixture();
    input.pose.identityVerified = false;
    expectAbstention(input, "identity_mismatch");
  });

  it("invalidates an old analysis revision", () => {
    const input = fixture();
    input.pose.revision = 1;
    expectAbstention(input, "stale_revision");
  });

  it.each([Number.NaN, -1, 1801])(
    "rejects invalid frame timestamp %s",
    (timestampMs) => {
      const input = fixture();
      input.pose.frames[0].timestampMs = timestampMs;
      expectAbstention(input, "invalid_timestamps");
    },
  );

  it("rejects duplicate timestamps and evidence IDs", () => {
    const input = fixture();
    input.pose.frames[1].timestampMs = input.pose.frames[0].timestampMs;
    expectAbstention(input, "invalid_timestamps");
    const second = fixture();
    second.pose.frames[1].id = second.pose.frames[0].id;
    expectAbstention(second, "invalid_timestamps");
  });

  it("rejects intervals beyond media and nonfinite revisions", () => {
    expectAbstention({ ...fixture(), endMs: 10_001 }, "invalid_context");
    expectAbstention({ ...fixture(), revision: Number.NaN }, "invalid_context");
  });

  it.each(["cameraStable", "bodyFullyVisible"] as const)(
    "requires %s",
    (field) => {
      const input = fixture();
      input.pose[field] = false;
      expectAbstention(input, "insufficient_quality");
    },
  );

  it("requires source image height of at least 180 pixels", () => {
    const input = fixture();
    input.pose.personHeightPx = 179;
    expectAbstention(input, "insufficient_quality");
  });

  it("requires five valid samples and 80 percent joint coverage", () => {
    const short = fixture();
    short.pose.frames = short.pose.frames.slice(0, 4);
    expectAbstention(short, "insufficient_quality");
    const occluded = fixture();
    for (const frame of occluded.pose.frames.slice(0, 2))
      frame.keypoints[0].visibility = 0.79;
    expectAbstention(occluded, "insufficient_quality");
  });

  it("rejects long gaps rather than interpolating missing contact", () => {
    const input = fixture();
    input.pose.frames.splice(3, 3);
    expectAbstention(input, "insufficient_quality");
  });

  it("rejects nonfinite and missing joints", () => {
    const input = fixture();
    input.pose.frames.forEach((frame) => {
      frame.keypoints[0].x = Number.NaN;
    });
    expectAbstention(input, "insufficient_quality");
    const missing = fixture();
    missing.pose.frames.forEach((frame) => {
      frame.keypoints.pop();
    });
    expectAbstention(missing, "insufficient_quality");
  });

  it("body pose alone does not imply contact or preparation timing", () => {
    const input = fixture();
    input.phaseMarks = [];
    expectAbstention(input, "missing_phase_confirmation");
    expect(evaluateCoach(input).actions).toContainEqual({
      type: "request_confirmation",
      eventId: "request:preparation-contact",
    });
  });

  it.each(["serve", "return"] as const)(
    "does not apply groundstroke advice to %s",
    (stroke) => {
      expectAbstention({ ...fixture(), stroke }, "unsupported_stroke");
    },
  );

  it("rejects stale, out-of-range, or contradictory human marks", () => {
    const stale = fixture();
    stale.phaseMarks![0].revision = 1;
    expectAbstention(stale, "stale_revision");
    const outside = fixture();
    outside.phaseMarks![0].timestampMs = 0;
    expectAbstention(outside, "invalid_timestamps");
    const inverted = fixture();
    inverted.phaseMarks![0].timestampMs = 1750;
    expectAbstention(inverted, "contradictory_phases");
  });

  it("rejects colliding evidence IDs and contradictory rejected marks", () => {
    const colliding = fixture();
    colliding.phaseMarks![0].id = colliding.pose.id;
    expectAbstention(colliding, "contradictory_phases");
    const rejected = fixture();
    rejected.phaseMarks!.push({
      ...rejected.phaseMarks![0],
      id: "rejected",
      state: "rejected",
    });
    expectAbstention(rejected, "contradictory_phases");
  });

  it("returns one traceable observation and one adapted drill", () => {
    const result = evaluateCoach(fixture());
    expect(result.status).toBe("observation");
    if (result.status !== "observation")
      throw new Error("expected observation");
    expect(result.observation).toMatchObject({
      evidenceIds: ["pose", "prep", "contact"],
      athleteId: "athlete",
      revision: 2,
      startMs: 1100,
      endMs: 1700,
    });
    expect(result.observation.observation).toContain("1.10 s");
    expect(result.observation.uncertainty).toContain("não prova");
    expect(result.observation.drill?.origin).toBe(
      "clubhall-authored-adaptation",
    );
    expect(
      result.observation.sourceIds.every((id) =>
        coachKnowledge.some((source) => source.sourceId === id),
      ),
    ).toBe(true);
    expect(
      result.actions.filter((action) => action.type === "offer_drill"),
    ).toHaveLength(1);
  });

  it("preserves descriptive review but suppresses physical cues after reported pain", () => {
    const input = fixture();
    input.athlete.painReported = true;
    const result = evaluateCoach(input);
    expect(result.status).toBe("observation");
    if (result.status !== "observation")
      throw new Error("expected observation");
    expect(result.observation.cue).toBeUndefined();
    expect(result.observation.drill).toBeUndefined();
    expect(result.actions.some((action) => action.type === "offer_drill")).toBe(
      false,
    );
  });

  it("requires athlete-provided goal and experience before offering a drill", () => {
    const input = fixture();
    input.athlete.goal = "";
    const result = evaluateCoach(input);
    expect(result.status).toBe("observation");
    if (result.status !== "observation")
      throw new Error("expected observation");
    expect(result.observation.drill).toBeUndefined();
  });

  it("is deterministic and leaves evidence untouched", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    expect(evaluateCoach(input)).toEqual(evaluateCoach(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("every curated source carries provenance and applicability limits", () => {
    for (const source of coachKnowledge) {
      expect(source.url.startsWith("https://")).toBe(true);
      expect(source.authors.length).toBeGreaterThan(0);
      expect(source.restrictions.length).toBeGreaterThan(0);
      expect(source.accessedOn).toBe("2026-09-19");
      expect(source.evidenceStrength).not.toBe("");
    }
  });
});
