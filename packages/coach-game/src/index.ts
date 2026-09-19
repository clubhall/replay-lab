import { z } from "zod";

export const PlayerSchema = z.enum(["athlete", "opponent"]);
export type Player = z.infer<typeof PlayerSchema>;
export const TennisFormatSchema = z.literal("singles-best-of-three-advantage");
const count = z.number().int().nonnegative();
const tallySchema = z.object({ athlete: count, opponent: count });
export type Tally = z.infer<typeof tallySchema>;
const zero = (): Tally => ({ athlete: 0, opponent: 0 });
export const otherPlayer = (player: Player): Player =>
  player === "athlete" ? "opponent" : "athlete";

export const PointEventSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    ordinal: z.number().int().positive(),
    revision: z.number().int().positive(),
    state: z.enum(["demo", "inferred", "confirmed", "rejected"]),
    source: z.enum(["manual", "import", "model"]),
    confirmedBy: z.string().min(1).optional(),
    methodVersion: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).default([]),
    startMs: z.number().finite().nonnegative(),
    endMs: z.number().finite().nonnegative(),
    winner: PlayerSchema.optional(),
    server: PlayerSchema.optional(),
    outcome: z
      .enum([
        "ace",
        "winner",
        "forced-error",
        "unforced-error",
        "double-fault",
        "unknown",
        "let",
      ])
      .optional(),
    rallyContacts: count.optional(),
    firstServeIn: z.boolean().optional(),
    serveNumber: z.union([z.literal(1), z.literal(2)]).optional(),
    secondServeFault: z.boolean().optional(),
  })
  .superRefine((event, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (event.endMs <= event.startMs)
      issue("Point interval must have a positive duration");
    if (event.state === "confirmed" && !event.confirmedBy)
      issue("Confirmation requires an identified reviewer");
    if (event.outcome === "let" && event.winner)
      issue("A let does not award a point");
    if (event.state === "confirmed" && event.outcome !== "let" && !event.winner)
      issue("A confirmed point requires a winner");
    if (
      event.outcome === "ace" &&
      (!event.server || event.winner !== event.server)
    )
      issue("An ace requires the server to win");
    if (
      event.outcome === "double-fault" &&
      (!event.server ||
        event.winner !== otherPlayer(event.server) ||
        event.serveNumber !== 2 ||
        event.secondServeFault !== true)
    ) {
      issue(
        "A double fault requires the server, receiver winner, and observed second-service fault",
      );
    }
    if (event.firstServeIn === true && event.serveNumber === 2)
      issue("A second service cannot follow a valid first service");
    if (event.firstServeIn === false && event.serveNumber === 1 && event.winner)
      issue("A fault on first service does not end the point");
    if (event.secondServeFault === true && event.outcome !== "double-fault")
      issue(
        "An observed second-service fault must be recorded as a double fault",
      );
  });
export type PointEvent = z.infer<typeof PointEventSchema>;

export type CompletedSet = { games: Tally; winner: Player; tieBreak?: Tally };
export type TennisScore = {
  sets: CompletedSet[];
  games: Tally;
  points: Tally;
  server: Player;
  tieBreakFirstServer?: Player;
  winner?: Player;
};

export function createTennisScore(
  firstServer: Player = "athlete",
): TennisScore {
  return {
    sets: [],
    games: zero(),
    points: zero(),
    server: PlayerSchema.parse(firstServer),
  };
}

/** Standard singles, advantage games, seven-point set tie-break, best of three. */
export function awardPoint(current: TennisScore, winner: Player): TennisScore {
  PlayerSchema.parse(winner);
  if (current.winner)
    throw new Error(
      "The match is complete; additional points are not accepted",
    );
  const score: TennisScore = {
    ...current,
    sets: [...current.sets],
    games: { ...current.games },
    points: { ...current.points },
  };
  const loser = otherPlayer(winner);
  score.points[winner] += 1;
  const tieBreak = score.tieBreakFirstServer !== undefined;
  if (
    score.points[winner] >= (tieBreak ? 7 : 4) &&
    score.points[winner] - score.points[loser] >= 2
  ) {
    score.games[winner] += 1;
    const completedTieBreak = tieBreak ? { ...score.points } : undefined;
    score.points = zero();
    score.server = otherPlayer(score.tieBreakFirstServer ?? score.server);
    delete score.tieBreakFirstServer;
    if (
      tieBreak ||
      (score.games[winner] >= 6 &&
        score.games[winner] - score.games[loser] >= 2)
    ) {
      score.sets.push({
        games: { ...score.games },
        winner,
        ...(completedTieBreak ? { tieBreak: completedTieBreak } : {}),
      });
      score.games = zero();
      if (score.sets.filter((set) => set.winner === winner).length === 2)
        score.winner = winner;
    } else if (score.games.athlete === 6 && score.games.opponent === 6) {
      score.tieBreakFirstServer = score.server;
    }
  } else if (tieBreak) {
    const total = score.points.athlete + score.points.opponent;
    const first = score.tieBreakFirstServer!;
    score.server =
      Math.floor((total + 1) / 2) % 2 === 1 ? otherPlayer(first) : first;
  }
  return score;
}

export function formatPointScore(score: TennisScore): {
  athlete: string;
  opponent: string;
} {
  if (score.tieBreakFirstServer)
    return {
      athlete: String(score.points.athlete),
      opponent: String(score.points.opponent),
    };
  const { athlete, opponent } = score.points;
  if (athlete >= 3 && opponent >= 3)
    return {
      athlete: athlete > opponent ? "AD" : "40",
      opponent: opponent > athlete ? "AD" : "40",
    };
  const labels = ["0", "15", "30", "40"];
  return { athlete: labels[athlete], opponent: labels[opponent] };
}

const completedSetSchema = z
  .object({
    games: tallySchema,
    winner: PlayerSchema,
    tieBreak: tallySchema.optional(),
  })
  .superRefine((set, ctx) => {
    const won = set.games[set.winner];
    const lost = set.games[otherPlayer(set.winner)];
    const validNormal = (won === 6 && lost <= 4) || (won === 7 && lost === 5);
    const validTieBreak =
      won === 7 &&
      lost === 6 &&
      set.tieBreak !== undefined &&
      set.tieBreak[set.winner] >= 7 &&
      set.tieBreak[set.winner] - set.tieBreak[otherPlayer(set.winner)] >= 2 &&
      (set.tieBreak[set.winner] === 7 ||
        set.tieBreak[set.winner] - set.tieBreak[otherPlayer(set.winner)] === 2);
    if (!(validNormal && !set.tieBreak) && !validTieBreak)
      ctx.addIssue({ code: "custom", message: "Invalid completed set" });
  });

export const TennisScoreSchema = z
  .object({
    sets: z.array(completedSetSchema).max(3),
    games: tallySchema,
    points: tallySchema,
    server: PlayerSchema,
    tieBreakFirstServer: PlayerSchema.optional(),
    winner: PlayerSchema.optional(),
  })
  .superRefine((score, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const wins = {
      athlete: score.sets.filter((set) => set.winner === "athlete").length,
      opponent: score.sets.filter((set) => set.winner === "opponent").length,
    };
    const matchWinner =
      wins.athlete === 2
        ? "athlete"
        : wins.opponent === 2
          ? "opponent"
          : undefined;
    if (
      score.winner !== matchWinner ||
      (score.sets.length === 3 && score.sets[0].winner === score.sets[1].winner)
    )
      issue("Invalid match completion");
    if (
      score.winner &&
      (score.games.athlete ||
        score.games.opponent ||
        score.points.athlete ||
        score.points.opponent ||
        score.tieBreakFirstServer)
    )
      issue("Completed match must not contain an active game");
    const maxGames = Math.max(score.games.athlete, score.games.opponent);
    if (
      maxGames > 6 ||
      (maxGames >= 6 &&
        Math.abs(score.games.athlete - score.games.opponent) >= 2)
    )
      issue("Active set has already finished");
    const isTieBreak = score.games.athlete === 6 && score.games.opponent === 6;
    if (isTieBreak !== Boolean(score.tieBreakFirstServer))
      issue("Tie-break state must agree with games");
    if (
      Math.max(score.points.athlete, score.points.opponent) >=
        (isTieBreak ? 7 : 4) &&
      Math.abs(score.points.athlete - score.points.opponent) >= 2
    )
      issue("Active game has already finished");
    if (score.tieBreakFirstServer) {
      const total = score.points.athlete + score.points.opponent;
      const expected =
        Math.floor((total + 1) / 2) % 2 === 1
          ? otherPlayer(score.tieBreakFirstServer)
          : score.tieBreakFirstServer;
      if (score.server !== expected) issue("Incorrect tie-break server");
    }
  });

export const ScoreCheckpointSchema = z.object({
  sessionId: z.string().min(1),
  afterOrdinal: count,
  source: z.literal("manual"),
  confirmedBy: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  score: TennisScoreSchema,
});
export type ScoreCheckpoint = z.infer<typeof ScoreCheckpointSchema>;

export type Ratio = {
  numerator: number;
  denominator: number;
  value: number | null;
};
function ratio(numerator: number, denominator: number): Ratio {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}
export type PlayerStatistics = {
  pointsWon: Ratio;
  firstServeIn: Ratio;
  firstServePointsWon: Ratio;
  secondServePointsWon: Ratio;
  breakPointsConverted: Ratio;
  aces: number | null;
  winners: number | null;
  forcedErrors: number | null;
  unforcedErrors: number | null;
  doubleFaults: number | null;
};
export type SessionStatistics = {
  athlete: PlayerStatistics;
  opponent: PlayerStatistics;
  confirmedPoints: number;
  observedEvents: number;
  classifiedPoints: number;
  longestRally: number | null;
  coverage: "none" | "partial" | "observed-prefix";
};
export type Reward = {
  key: string;
  sessionId: string;
  ruleId:
    | "constructed-point"
    | "decisive-serve"
    | "under-pressure"
    | "first-replay";
  ruleVersion: 1;
  evidenceId: string;
  evidenceRevision: number;
  label: string;
  xp: number;
  athleteId?: string;
};
function reward(
  event: PointEvent,
  ruleId: Reward["ruleId"],
  label: string,
  xp: number,
): Reward {
  return {
    key: JSON.stringify([event.sessionId, ruleId, 1, event.id]),
    sessionId: event.sessionId,
    ruleId,
    ruleVersion: 1,
    evidenceId: event.id,
    evidenceRevision: event.revision,
    label,
    xp,
  };
}
export type DerivationIssue = {
  code:
    | "invalid-event"
    | "wrong-session"
    | "conflicting-revision"
    | "demo-promotion"
    | "duplicate-ordinal"
    | "missing-point"
    | "unconfirmed-point"
    | "server-mismatch"
    | "match-complete";
  eventId?: string;
  ordinal?: number;
  message: string;
};
export type TennisSessionDerivation = {
  score: TennisScore;
  complete: boolean;
  appliedPointIds: string[];
  latestEvents: PointEvent[];
  issues: DerivationIssue[];
  statistics: SessionStatistics;
  rewards: Reward[];
};

/** Rebuild from immutable event history. `complete` describes the observed prefix, not video coverage. */
export function deriveTennisSession(input: {
  sessionId: string;
  events: readonly unknown[];
  firstServer?: Player;
  format?: z.infer<typeof TennisFormatSchema>;
  checkpoint?: ScoreCheckpoint;
  assetDurationMs?: number;
}): TennisSessionDerivation {
  z.string().min(1).parse(input.sessionId);
  if (input.assetDurationMs !== undefined)
    z.number().finite().nonnegative().parse(input.assetDurationMs);
  TennisFormatSchema.parse(input.format ?? "singles-best-of-three-advantage");
  const issues: DerivationIssue[] = [];
  const histories = new Map<string, PointEvent[]>();
  for (const raw of input.events) {
    const parsed = PointEventSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push({ code: "invalid-event", message: parsed.error.message });
      continue;
    }
    const event = parsed.data;
    if (event.sessionId !== input.sessionId) {
      issues.push({
        code: "wrong-session",
        eventId: event.id,
        message: "Event belongs to a different session",
      });
      continue;
    }
    if (
      input.assetDurationMs !== undefined &&
      event.endMs > input.assetDurationMs
    ) {
      issues.push({
        code: "invalid-event",
        eventId: event.id,
        message: "Event exceeds the media duration",
      });
      continue;
    }
    const history = histories.get(event.id) ?? [];
    history.push(event);
    histories.set(event.id, history);
  }
  const latestEvents: PointEvent[] = [];
  const blocked = new Set<string>();
  for (const [id, history] of histories) {
    history.sort((a, b) => b.revision - a.revision);
    const latest = history[0];
    const revisions = new Map<number, string>();
    for (const event of history) {
      const value = JSON.stringify(event);
      if (
        revisions.has(event.revision) &&
        revisions.get(event.revision) !== value
      ) {
        blocked.add(id);
        issues.push({
          code: "conflicting-revision",
          eventId: id,
          message: "The same point revision has conflicting contents",
        });
      }
      revisions.set(event.revision, value);
    }
    if (
      history.some((event) => event.state === "demo") &&
      latest.state !== "demo"
    ) {
      blocked.add(id);
      issues.push({
        code: "demo-promotion",
        eventId: id,
        message: "Demo evidence cannot be promoted into a real point",
      });
    }
    latestEvents.push(latest);
  }
  latestEvents.sort(
    (a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id),
  );
  const real = latestEvents.filter((event) => event.state !== "demo");
  const ordinals = new Map<number, PointEvent>();
  for (const event of real) {
    const existing = ordinals.get(event.ordinal);
    if (existing) {
      blocked.add(existing.id);
      blocked.add(event.id);
      issues.push({
        code: "duplicate-ordinal",
        eventId: event.id,
        ordinal: event.ordinal,
        message: "Two points claim the same ordinal",
      });
    }
    ordinals.set(event.ordinal, event);
  }
  const checkpoint = input.checkpoint
    ? ScoreCheckpointSchema.parse(input.checkpoint)
    : undefined;
  if (checkpoint && checkpoint.sessionId !== input.sessionId)
    throw new Error("Checkpoint belongs to a different session");
  let score: TennisScore = checkpoint
    ? checkpoint.score
    : createTennisScore(input.firstServer);
  let expected = (checkpoint?.afterOrdinal ?? 0) + 1;
  const appliedPointIds: string[] = [];
  const breakChances: { event: PointEvent; receiver: Player }[] = [];
  const rewards: Reward[] = [];
  const invalidScorePoints = new Set<string>();
  for (const event of real.filter(
    (candidate) => candidate.ordinal >= expected,
  )) {
    if (event.ordinal !== expected) {
      issues.push({
        code: "missing-point",
        ordinal: expected,
        message: `Point ${expected} is missing; the accumulated score stops here`,
      });
      break;
    }
    if (event.state !== "confirmed" || blocked.has(event.id)) {
      issues.push({
        code: "unconfirmed-point",
        eventId: event.id,
        ordinal: event.ordinal,
        message:
          "The accumulated score stops at unconfirmed or ambiguous evidence",
      });
      break;
    }
    if (score.winner) {
      invalidScorePoints.add(event.id);
      issues.push({
        code: "match-complete",
        eventId: event.id,
        message: "A point cannot follow a completed match",
      });
      break;
    }
    if (event.server && event.server !== score.server) {
      invalidScorePoints.add(event.id);
      issues.push({
        code: "server-mismatch",
        eventId: event.id,
        message: "Recorded server disagrees with the known service order",
      });
      break;
    }
    if (event.outcome !== "let" && event.winner) {
      const receiver = otherPlayer(score.server);
      const receiverHasGamePoint =
        !score.tieBreakFirstServer &&
        score.points[receiver] >= 3 &&
        score.points[receiver] > score.points[score.server];
      if (receiverHasGamePoint) {
        breakChances.push({ event, receiver });
        if (score.server === "athlete" && event.winner === "athlete")
          rewards.push(reward(event, "under-pressure", "Sob pressão", 50));
      }
      score = awardPoint(score, event.winner);
      appliedPointIds.push(event.id);
    }
    expected += 1;
  }
  // Clip-local statistics remain useful past gaps, but contradictions and ambiguous evidence do not.
  const confirmed = real.filter(
    (event) =>
      event.state === "confirmed" &&
      event.winner &&
      event.outcome !== "let" &&
      !blocked.has(event.id) &&
      !invalidScorePoints.has(event.id) &&
      !(score.winner && event.ordinal >= expected),
  );
  const classified = confirmed.filter(
    (event) => event.outcome && event.outcome !== "unknown",
  );
  const buildStats = (player: Player): PlayerStatistics => {
    const serving = confirmed.filter((event) => event.server === player);
    const firstKnown = serving.filter(
      (event) => event.firstServeIn !== undefined,
    );
    const firstIn = serving.filter((event) => event.firstServeIn === true);
    const second = serving.filter((event) => event.serveNumber === 2);
    const chances = breakChances.filter((chance) => chance.receiver === player);
    const outcomeCount = (
      outcome: PointEvent["outcome"],
      winning: boolean,
    ): number | null =>
      classified.length === 0
        ? null
        : classified.filter(
            (event) =>
              event.outcome === outcome &&
              event.winner === (winning ? player : otherPlayer(player)),
          ).length;
    return {
      pointsWon: ratio(
        confirmed.filter((event) => event.winner === player).length,
        confirmed.length,
      ),
      firstServeIn: ratio(
        firstKnown.filter((event) => event.firstServeIn).length,
        firstKnown.length,
      ),
      firstServePointsWon: ratio(
        firstIn.filter((event) => event.winner === player).length,
        firstIn.length,
      ),
      secondServePointsWon: ratio(
        second.filter((event) => event.winner === player).length,
        second.length,
      ),
      breakPointsConverted: ratio(
        chances.filter(({ event }) => event.winner === player).length,
        chances.length,
      ),
      aces: outcomeCount("ace", true),
      winners: outcomeCount("winner", true),
      forcedErrors: outcomeCount("forced-error", false),
      unforcedErrors: outcomeCount("unforced-error", false),
      doubleFaults: outcomeCount("double-fault", false),
    };
  };
  for (const event of confirmed) {
    if ((event.rallyContacts ?? 0) >= 8)
      rewards.push(reward(event, "constructed-point", "Ponto construído", 40));
  }
  const firstAce = confirmed.find(
    (event) => event.outcome === "ace" && event.winner === "athlete",
  );
  if (firstAce)
    rewards.push(reward(firstAce, "decisive-serve", "Saque decisivo", 50));
  const rallies = confirmed.flatMap((event) =>
    event.rallyContacts === undefined ? [] : [event.rallyContacts],
  );
  const complete = issues.length === 0;
  return {
    score,
    complete,
    appliedPointIds,
    latestEvents,
    issues,
    rewards,
    statistics: {
      athlete: buildStats("athlete"),
      opponent: buildStats("opponent"),
      confirmedPoints: confirmed.length,
      observedEvents: real.length,
      classifiedPoints: classified.length,
      longestRally: rallies.length ? Math.max(...rallies) : null,
      coverage:
        confirmed.length === 0
          ? "none"
          : complete && !checkpoint
            ? "observed-prefix"
            : "partial",
    },
  };
}

export type RewardLedgerEntry = {
  sequence: number;
  action: "grant" | "revoke";
  reward: Reward;
};
export type RewardLedger = { entries: RewardLedgerEntry[]; balance: number };

export const SavedReplayReviewSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  athleteId: z.string().min(1),
  evidenceId: z.string().min(1),
  evidenceRevision: z.number().int().positive(),
  reviewed: z.literal(true),
  saved: z.literal(true),
  ownMoment: z.literal(true),
  state: z.literal("confirmed"),
});
export type SavedReplayReview = z.infer<typeof SavedReplayReviewSchema>;

/** Supply the athlete-wide ledger to enforce once per athlete across sessions. */
export function firstReplayReward(
  raw: SavedReplayReview,
  previous?: RewardLedger,
): Reward | null {
  const review = SavedReplayReviewSchema.parse(raw);
  const key = JSON.stringify([review.athleteId, "first-replay", 1]);
  const historical =
    previous?.entries.filter((entry) => entry.reward.key === key) ?? [];
  if (historical.length) {
    const last = historical.at(-1)!;
    return last.action === "grant" ? { ...last.reward } : null;
  }
  return {
    key,
    sessionId: review.sessionId,
    ruleId: "first-replay",
    ruleVersion: 1,
    evidenceId: review.evidenceId,
    evidenceRevision: review.evidenceRevision,
    athleteId: review.athleteId,
    label: "Primeiro replay",
    xp: 25,
  };
}

/** Reconcile the full desired reward set; playback/seek never enters this function. */
export function reconcileRewardLedger(
  previous: RewardLedger | undefined,
  desired: readonly Reward[],
): RewardLedger {
  const entries = [...(previous?.entries ?? [])];
  const active = new Map<string, Reward>();
  for (const entry of entries) {
    if (entry.action === "grant") active.set(entry.reward.key, entry.reward);
    else active.delete(entry.reward.key);
  }
  const next = new Map<string, Reward>();
  for (const item of desired) {
    const existing = next.get(item.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item))
      throw new Error("Conflicting reward identity");
    next.set(item.key, item);
  }
  const append = (action: RewardLedgerEntry["action"], item: Reward) =>
    entries.push({ sequence: entries.length + 1, action, reward: { ...item } });
  for (const [key, item] of active) {
    const replacement = next.get(key);
    if (!replacement || JSON.stringify(replacement) !== JSON.stringify(item)) {
      append("revoke", item);
      active.delete(key);
    }
  }
  for (const [key, item] of next)
    if (!active.has(key)) {
      append("grant", item);
      active.set(key, item);
    }
  return {
    entries,
    balance: [...active.values()].reduce((sum, item) => sum + item.xp, 0),
  };
}
