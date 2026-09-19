// Adapted design: accollier/made-for-me 6465a051 server/decision-core.mjs.
// The provider selects known actions; application code owns values and effects.
import { z } from "zod";
import { localDecision, RequestSchema } from "../src/actions";
const choices = ["review", "slow", "loop", "clip", "clarify"] as const;
const Answer = z.object({
  answers: z.object({
    next_action: z.object({
      type: z.literal("choice"),
      choice: z.enum(choices),
      confidence: z.number().min(0).max(1),
      probabilities: z.record(z.string(), z.number().min(0).max(1)),
    }),
  }),
});
export async function compose(
  raw: unknown,
  options: {
    key?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
) {
  const r = RequestSchema.parse(raw);
  if (!options.key) return localDecision(r);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(abort, options.timeoutMs ?? 900);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      "https://api.typesafe.ai/v1/systemone",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.key}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.TYPESAFE_MODEL ?? "jev-latest",
          state: {
            intent: r.intent,
            selection: { startMs: r.startMs, endMs: r.endMs },
            constraints:
              "Only select navigation. Never score, diagnose, upload, or export automatically.",
          },
          questions: {
            next_action: {
              type: "choice",
              instructions:
                "Choose only the explicitly requested replay action. Technique questions require clarify.",
              criteria: {
                review: "Seek to selected moment",
                slow: "Slow playback",
                loop: "Repeat selection",
                clip: "Prepare selection for export; never export automatically",
                clarify: "Request evidence for coaching or unsupported intent",
              },
            },
          },
        }),
      },
    );
    if (!response.ok) return localDecision(r, "provider_unavailable");
    const a = Answer.parse(await response.json()).answers.next_action;
    if (
      Object.keys(a.probabilities).length !== choices.length ||
      choices.some((x) => a.probabilities[x] === undefined) ||
      Math.abs(choices.reduce((s, x) => s + a.probabilities[x], 0) - 1) > 0.02
    )
      throw new Error("Invalid distribution");
    if (a.confidence < 0.58) return localDecision(r, "low_confidence");
    const intent = {
      review: "rever",
      slow: "slow",
      loop: "loop",
      clip: "clip",
      clarify: "?",
    }[a.choice];
    return {
      ...localDecision({ ...r, intent }, "typed_choice"),
      source: "jev" as const,
    };
  } catch {
    return localDecision(
      r,
      controller.signal.aborted ? "timeout_or_cancelled" : "invalid_response",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
