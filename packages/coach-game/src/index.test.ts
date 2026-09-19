import { describe, expect, it } from "vitest";
import {
  awardPoint,
  createTennisScore,
  deriveTennisSession,
  firstReplayReward,
  formatPointScore,
  PointEventSchema,
  reconcileRewardLedger,
  ScoreCheckpointSchema,
  TennisFormatSchema,
  TennisScoreSchema,
} from "./index";
import type { Player, PointEvent } from "./index";

const event = (
  ordinal: number,
  winner: Player = "athlete",
  patch: Partial<PointEvent> = {},
): PointEvent =>
  PointEventSchema.parse({
    id: `point-${ordinal}`,
    sessionId: "session",
    ordinal,
    revision: 1,
    state: "confirmed",
    source: "manual",
    confirmedBy: "reviewer",
    methodVersion: "manual-v1",
    startMs: (ordinal - 1) * 1000,
    endMs: ordinal * 1000,
    evidenceIds: [`evidence-${ordinal}`],
    winner,
    ...patch,
  });
const play = (winners: Player[], start = createTennisScore()) =>
  winners.reduce(awardPoint, start);
const winGames = (winners: Player[], start = createTennisScore()) =>
  play(
    winners.flatMap((winner) => Array<Player>(4).fill(winner)),
    start,
  );
const derive = (events: unknown[]) =>
  deriveTennisSession({ sessionId: "session", events });

describe("standard tennis rules", () => {
  it("wins a love game and alternates the server without mutating the previous state", () => {
    const initial = createTennisScore();
    const score = play(Array<Player>(4).fill("athlete"), initial);
    expect(score.games).toEqual({ athlete: 1, opponent: 0 });
    expect(score.points).toEqual({ athlete: 0, opponent: 0 });
    expect(score.server).toBe("opponent");
    expect(initial).toEqual(createTennisScore());
  });
  it("returns to deuce after exchanging advantages and requires two consecutive points", () => {
    const deuce = play([
      "athlete",
      "athlete",
      "athlete",
      "opponent",
      "opponent",
      "opponent",
      "athlete",
      "opponent",
    ]);
    expect(formatPointScore(deuce)).toEqual({ athlete: "40", opponent: "40" });
    expect(deuce.games.athlete).toBe(0);
    const advantage = awardPoint(deuce, "athlete");
    expect(formatPointScore(advantage)).toEqual({
      athlete: "AD",
      opponent: "40",
    });
    expect(awardPoint(advantage, "athlete").games.athlete).toBe(1);
  });
  it("wins an extended set 7–5", () => {
    const fiveAll = winGames(
      Array.from({ length: 10 }, (_, i) => (i % 2 ? "opponent" : "athlete")),
    );
    const score = winGames(["athlete", "athlete"], fiveAll);
    expect(score.sets).toEqual([
      { games: { athlete: 7, opponent: 5 }, winner: "athlete" },
    ]);
    expect(score.games).toEqual({ athlete: 0, opponent: 0 });
  });
  it("uses the one-two-two service order and requires two points at 6–6 in the tie-break", () => {
    let score = winGames(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? "opponent" : "athlete")),
    );
    expect(score.tieBreakFirstServer).toBe("athlete");
    const servers: Player[] = [];
    for (let index = 0; index < 12; index += 1) {
      servers.push(score.server);
      score = awardPoint(score, index % 2 ? "opponent" : "athlete");
    }
    expect(servers.slice(0, 7)).toEqual([
      "athlete",
      "opponent",
      "opponent",
      "athlete",
      "athlete",
      "opponent",
      "opponent",
    ]);
    expect(formatPointScore(score)).toEqual({ athlete: "6", opponent: "6" });
    score = play(["athlete", "athlete"], score);
    expect(score.sets[0]).toEqual({
      games: { athlete: 7, opponent: 6 },
      winner: "athlete",
      tieBreak: { athlete: 8, opponent: 6 },
    });
    expect(score.server).toBe("opponent");
    expect(score.tieBreakFirstServer).toBeUndefined();
  });
  it("ends at two won sets and rejects an additional point", () => {
    const score = winGames(Array<Player>(12).fill("athlete"));
    expect(score.winner).toBe("athlete");
    expect(score.sets).toHaveLength(2);
    expect(() => awardPoint(score, "opponent")).toThrow("complete");
  });
  it("plays a deciding third standard set when the first two sets are split", () => {
    const score = winGames([
      ...Array<Player>(6).fill("athlete"),
      ...Array<Player>(6).fill("opponent"),
      ...Array<Player>(6).fill("athlete"),
    ]);
    expect(score.sets).toHaveLength(3);
    expect(score.winner).toBe("athlete");
  });
  it("does not expose unimplemented no-ad or match tie-break formats", () => {
    expect(TennisFormatSchema.safeParse("no-ad").success).toBe(false);
    expect(TennisFormatSchema.safeParse("match-tie-break").success).toBe(false);
  });
  it("produces valid states throughout a long alternating match", () => {
    let score = createTennisScore("opponent");
    for (let index = 0; index < 250; index += 1) {
      score = awardPoint(score, index % 3 === 0 ? "athlete" : "opponent");
      expect(TennisScoreSchema.safeParse(score).success).toBe(true);
      if (score.winner) break;
    }
  });
});

describe("evidence and event history", () => {
  it("stops cumulative scoring at a missing ordinal but retains labelled clip-local statistics", () => {
    const result = derive([event(1), event(2), event(4, "opponent")]);
    expect(result.complete).toBe(false);
    expect(result.appliedPointIds).toEqual(["point-1", "point-2"]);
    expect(result.score.points).toEqual({ athlete: 2, opponent: 0 });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "missing-point", ordinal: 3 }),
    );
    expect(result.statistics.athlete.pointsWon).toEqual({
      numerator: 2,
      denominator: 3,
      value: 2 / 3,
    });
    expect(result.statistics.coverage).toBe("partial");
  });
  it("replays a correction independent of arrival order and treats duplicates idempotently", () => {
    const original = event(2);
    const correction = event(2, "opponent", { revision: 2 });
    const result = derive([
      correction,
      event(1),
      original,
      event(1),
      correction,
    ]);
    expect(result.complete).toBe(true);
    expect(result.latestEvents).toHaveLength(2);
    expect(result.score.points).toEqual({ athlete: 1, opponent: 1 });
    expect(original.winner).toBe("athlete");
  });
  it("fails closed for conflicting same-revision contents", () => {
    const result = derive([event(1), event(1, "opponent")]);
    expect(result.complete).toBe(false);
    expect(result.appliedPointIds).toHaveLength(0);
    expect(result.statistics.confirmedPoints).toBe(0);
  });
  it("does not silently select one of two point IDs claiming the same ordinal", () => {
    const result = derive([
      event(1),
      event(1, "opponent", { id: "different" }),
    ]);
    expect(result.statistics.confirmedPoints).toBe(0);
    expect(
      result.issues.some((issue) => issue.code === "duplicate-ordinal"),
    ).toBe(true);
  });
  it("separates demo evidence and prevents changing demo state to mint a real point", () => {
    const demo = event(1, "athlete", {
      id: "demo",
      state: "demo",
      outcome: "ace",
      server: "athlete",
    });
    expect(derive([demo, event(1)]).appliedPointIds).toEqual(["point-1"]);
    const result = derive([demo, { ...demo, revision: 2, state: "confirmed" }]);
    expect(result.statistics.confirmedPoints).toBe(0);
    expect(result.rewards).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "demo-promotion")).toBe(
      true,
    );
  });
  it("requires confirmed evidence and a known winner before awarding a point", () => {
    expect(
      PointEventSchema.safeParse({ ...event(1), confirmedBy: undefined })
        .success,
    ).toBe(false);
    expect(
      PointEventSchema.safeParse({ ...event(1), winner: undefined }).success,
    ).toBe(false);
    const result = derive([
      event(1, "athlete", { state: "inferred" }),
      event(2),
    ]);
    expect(result.appliedPointIds).toHaveLength(0);
    expect(result.complete).toBe(false);
  });
  it("does not turn a let or first service fault into a point", () => {
    const letEvent = event(1, "athlete", { winner: undefined, outcome: "let" });
    const result = derive([letEvent, event(2)]);
    expect(result.score.points.athlete).toBe(1);
    expect(result.statistics.confirmedPoints).toBe(1);
    expect(
      PointEventSchema.safeParse({
        ...event(1),
        firstServeIn: false,
        serveNumber: 1,
      }).success,
    ).toBe(false);
  });
  it("requires second-service-fault evidence for a double fault", () => {
    const fault = {
      ...event(1, "opponent"),
      outcome: "double-fault",
      server: "athlete",
      serveNumber: 2,
    };
    expect(PointEventSchema.safeParse(fault).success).toBe(false);
    expect(
      PointEventSchema.safeParse({ ...fault, secondServeFault: true }).success,
    ).toBe(true);
    expect(
      PointEventSchema.safeParse({
        ...fault,
        secondServeFault: true,
        winner: "athlete",
      }).success,
    ).toBe(false);
  });
  it("rejects contradictory serve facts, invalid intervals and cross-session evidence", () => {
    expect(
      PointEventSchema.safeParse({
        ...event(1),
        firstServeIn: true,
        serveNumber: 2,
      }).success,
    ).toBe(false);
    expect(PointEventSchema.safeParse({ ...event(1), endMs: 0 }).success).toBe(
      false,
    );
    expect(
      PointEventSchema.safeParse({ ...event(1), startMs: Infinity }).success,
    ).toBe(false);
    expect(
      derive([event(1, "athlete", { sessionId: "other" })]).statistics
        .confirmedPoints,
    ).toBe(0);
    expect(
      deriveTennisSession({
        sessionId: "session",
        events: [event(1)],
        assetDurationMs: 500,
      }).statistics.confirmedPoints,
    ).toBe(0);
  });
  it("rejects evidence with a contradictory known server", () => {
    const result = derive([
      event(1, "opponent", { server: "opponent", outcome: "ace" }),
    ]);
    expect(
      result.issues.some((issue) => issue.code === "server-mismatch"),
    ).toBe(true);
    expect(result.statistics.confirmedPoints).toBe(0);
    expect(result.rewards).toHaveLength(0);
  });
  it("does not count confirmed points recorded after a completed match", () => {
    const result = derive(Array.from({ length: 50 }, (_, i) => event(i + 1)));
    expect(result.appliedPointIds).toHaveLength(48);
    expect(result.statistics.confirmedPoints).toBe(48);
    expect(result.issues.some((issue) => issue.code === "match-complete")).toBe(
      true,
    );
  });
  it("continues from an explicit manual checkpoint and rejects malformed checkpoints", () => {
    const checkpoint = {
      sessionId: "session",
      afterOrdinal: 20,
      source: "manual" as const,
      confirmedBy: "reviewer",
      evidenceIds: ["scoreboard"],
      score: createTennisScore("opponent"),
    };
    const result = deriveTennisSession({
      sessionId: "session",
      events: [event(21, "opponent", { server: "opponent" })],
      checkpoint,
    });
    expect(result.complete).toBe(true);
    expect(result.score.points.opponent).toBe(1);
    expect(result.statistics.coverage).toBe("partial");
    expect(
      ScoreCheckpointSchema.safeParse({ ...checkpoint, evidenceIds: [] })
        .success,
    ).toBe(false);
    expect(() =>
      deriveTennisSession({ sessionId: "other", events: [], checkpoint }),
    ).toThrow("different session");
    expect(
      ScoreCheckpointSchema.safeParse({
        ...checkpoint,
        score: { ...checkpoint.score, games: { athlete: 6, opponent: 0 } },
      }).success,
    ).toBe(false);
  });
});

describe("honest statistics", () => {
  it("leaves unknown denominators and outcomes unavailable", () => {
    const stats = derive([event(1)]).statistics;
    expect(stats.athlete.firstServeIn.value).toBeNull();
    expect(stats.athlete.secondServePointsWon.denominator).toBe(0);
    expect(stats.athlete.aces).toBeNull();
    expect(stats.athlete.unforcedErrors).toBeNull();
    expect(stats.longestRally).toBeNull();
    expect(stats.athlete.pointsWon.denominator).toBe(1);
  });
  it("uses separate observed denominators and includes double faults in second-service points", () => {
    const stats = derive([
      event(1, "athlete", {
        server: "athlete",
        firstServeIn: true,
        serveNumber: 1,
        outcome: "ace",
      }),
      event(2, "opponent", {
        server: "athlete",
        firstServeIn: false,
        serveNumber: 2,
        secondServeFault: true,
        outcome: "double-fault",
      }),
      event(3, "athlete", {
        server: "athlete",
        firstServeIn: false,
        serveNumber: 2,
      }),
      event(4, "athlete", { server: "athlete", rallyContacts: 12 }),
    ]).statistics;
    expect(stats.athlete.firstServeIn).toEqual({
      numerator: 1,
      denominator: 3,
      value: 1 / 3,
    });
    expect(stats.athlete.firstServePointsWon).toEqual({
      numerator: 1,
      denominator: 1,
      value: 1,
    });
    expect(stats.athlete.secondServePointsWon).toEqual({
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    expect(stats.athlete.doubleFaults).toBe(1);
    expect(stats.opponent.doubleFaults).toBe(0);
    expect(stats.classifiedPoints).toBe(2);
    expect(stats.longestRally).toBe(12);
  });
  it("counts break opportunities from the complete pre-point score and attributes errors to the loser", () => {
    const result = derive([
      event(1, "opponent"),
      event(2, "opponent"),
      event(3, "opponent"),
      event(4, "athlete"),
      event(5, "opponent", { outcome: "unforced-error" }),
    ]);
    expect(result.statistics.opponent.breakPointsConverted).toEqual({
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    expect(result.statistics.athlete.unforcedErrors).toBe(1);
    expect(
      result.rewards.find((item) => item.ruleId === "under-pressure")
        ?.evidenceId,
    ).toBe("point-4");
  });
  it("never invents break opportunities across a gap", () => {
    const result = derive([
      event(1, "opponent"),
      event(2, "opponent"),
      event(4, "opponent"),
      event(5, "athlete"),
    ]);
    expect(result.statistics.opponent.breakPointsConverted.value).toBeNull();
    expect(
      result.rewards.some((item) => item.ruleId === "under-pressure"),
    ).toBe(false);
  });
});

describe("reward ledger", () => {
  it("grants the first ace once and stays unchanged through repeated derivations and duplicate input", () => {
    const ace = event(1, "athlete", {
      server: "athlete",
      outcome: "ace",
      rallyContacts: 8,
    });
    const result = derive([
      ace,
      ace,
      event(2, "athlete", { server: "athlete", outcome: "ace" }),
    ]);
    const ledger = reconcileRewardLedger(undefined, result.rewards);
    expect(ledger.balance).toBe(90);
    expect(ledger.entries).toHaveLength(2);
    expect(
      reconcileRewardLedger(
        ledger,
        derive([
          ace,
          ace,
          event(2, "athlete", { server: "athlete", outcome: "ace" }),
        ]).rewards,
      ),
    ).toEqual(ledger);
  });
  it("revokes corrected-away evidence, preserves history and does not mutate the prior ledger", () => {
    const ace = event(1, "athlete", { server: "athlete", outcome: "ace" });
    const ledger = reconcileRewardLedger(undefined, derive([ace]).rewards);
    const correction = event(1, "opponent", {
      revision: 2,
      server: "athlete",
      outcome: "unknown",
    });
    const next = reconcileRewardLedger(
      ledger,
      derive([ace, correction]).rewards,
    );
    expect(next.balance).toBe(0);
    expect(next.entries.map((entry) => entry.action)).toEqual([
      "grant",
      "revoke",
    ]);
    expect(ledger.balance).toBe(50);
    expect(ledger.entries).toHaveLength(1);
  });
  it("supersedes a reward revision without duplicating its net credit", () => {
    const point = event(1, "athlete", { rallyContacts: 8 });
    const ledger = reconcileRewardLedger(undefined, derive([point]).rewards);
    const revised = derive([
      point,
      { ...point, revision: 2, rallyContacts: 9 },
    ]);
    const next = reconcileRewardLedger(ledger, revised.rewards);
    expect(next.balance).toBe(40);
    expect(next.entries.map((entry) => entry.action)).toEqual([
      "grant",
      "revoke",
      "grant",
    ]);
    expect(next.entries.at(-1)?.reward.evidenceRevision).toBe(2);
    expect(reconcileRewardLedger(next, revised.rewards)).toEqual(next);
  });
  it("revokes a rejected ace and rewards neither inferred nor demo points", () => {
    const ace = event(1, "athlete", { server: "athlete", outcome: "ace" });
    const ledger = reconcileRewardLedger(undefined, derive([ace]).rewards);
    const rejected = derive([ace, { ...ace, revision: 2, state: "rejected" }]);
    expect(reconcileRewardLedger(ledger, rejected.rewards).balance).toBe(0);
    expect(rejected.statistics.athlete.aces).toBeNull();
    expect(derive([{ ...ace, state: "inferred" }]).rewards).toHaveLength(0);
    expect(derive([{ ...ace, state: "demo" }]).rewards).toHaveLength(0);
  });
  it("requires a saved own review and grants first replay once per athlete across sessions", () => {
    const review = {
      id: "review",
      sessionId: "session",
      athleteId: "athlete-1",
      evidenceId: "own-moment",
      evidenceRevision: 1,
      reviewed: true as const,
      saved: true as const,
      ownMoment: true as const,
      state: "confirmed" as const,
    };
    const first = firstReplayReward(review)!;
    const ledger = reconcileRewardLedger(undefined, [first]);
    expect(ledger.balance).toBe(25);
    const second = firstReplayReward(
      { ...review, sessionId: "another-session", evidenceId: "another-moment" },
      ledger,
    )!;
    expect(second).toEqual(first);
    expect(reconcileRewardLedger(ledger, [second])).toEqual(ledger);
    expect(() =>
      firstReplayReward({ ...review, saved: false } as unknown as Parameters<
        typeof firstReplayReward
      >[0]),
    ).toThrow();
    const revoked = reconcileRewardLedger(ledger, []);
    expect(firstReplayReward(review, revoked)).toBeNull();
  });
});
