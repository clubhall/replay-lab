import { z } from "zod";
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("seek"),
    timestampMs: z.number().nonnegative().finite(),
  }),
  z.object({
    type: z.literal("slow"),
    rate: z.union([z.literal(0.25), z.literal(0.5), z.literal(1)]),
  }),
  z.object({
    type: z.literal("loop"),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  }),
  z.object({
    type: z.literal("propose_clip"),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  }),
  z.object({ type: z.literal("request_better_view") }),
]);
export type Action = z.infer<typeof ActionSchema>;
export const RequestSchema = z
  .object({
    requestId: z.string().uuid(),
    sessionId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    intent: z.string().min(1).max(1200),
    durationMs: z.number().positive().finite(),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  })
  .refine((x) => x.startMs < x.endMs && x.endMs <= x.durationMs);
export type DecisionRequest = z.infer<typeof RequestSchema>;
export const DecisionSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  revision: z.number().int(),
  source: z.enum(["local", "jev"]),
  reason: z.string(),
  action: ActionSchema,
});
export function validateAction(action: unknown, durationMs: number): Action {
  const a = ActionSchema.parse(action);
  if (
    ("timestampMs" in a && a.timestampMs > durationMs) ||
    ("endMs" in a && (a.endMs > durationMs || a.startMs >= a.endMs))
  )
    throw new Error("Ação fora do vídeo.");
  return a;
}
export function localDecision(r: DecisionRequest, reason = "not_configured") {
  const text = r.intent.toLowerCase();
  const action: Action = /lent|slow/.test(text)
    ? { type: "slow", rate: 0.5 }
    : /loop|repet|repit/.test(text)
      ? { type: "loop", startMs: r.startMs, endMs: r.endMs }
      : /cort|clip|export/.test(text)
        ? { type: "propose_clip", startMs: r.startMs, endMs: r.endMs }
        : /rever|review|início/.test(text)
          ? { type: "seek", timestampMs: r.startMs }
          : { type: "request_better_view" };
  return DecisionSchema.parse({
    requestId: r.requestId,
    sessionId: r.sessionId,
    revision: r.revision,
    source: "local",
    reason,
    action,
  });
}
export function acceptDecision(raw: unknown, current: DecisionRequest) {
  const d = DecisionSchema.parse(raw);
  if (
    d.requestId !== current.requestId ||
    d.sessionId !== current.sessionId ||
    d.revision !== current.revision
  )
    throw new Error("Resposta obsoleta.");
  validateAction(d.action, current.durationMs);
  return d;
}
