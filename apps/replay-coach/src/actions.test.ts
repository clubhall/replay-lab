import { describe, it, expect } from "vitest";
import {
  acceptDecision,
  localDecision,
  validateAction,
  RequestSchema,
} from "./actions";
import { compose } from "../server/decision";
const request = {
  requestId: "8f4c1e43-d0c5-4e10-819d-a02fe55e4067",
  sessionId: "s",
  revision: 2,
  intent: "repita este trecho",
  durationMs: 8000,
  startMs: 1000,
  endMs: 3000,
};
describe("bounded replay decisions", () => {
  it("chooses real shared actions and labels local fallback", async () => {
    expect(await compose(request)).toMatchObject({
      source: "local",
      reason: "not_configured",
      action: { type: "loop", startMs: 1000, endMs: 3000 },
    });
  });
  it("never promotes technique questions to inferred medical claims", () => {
    expect(
      localDecision({ ...request, intent: "Minha técnica causa dor?" }).action
        .type,
    ).toBe("request_better_view");
  });
  it.each([
    { type: "seek", timestampMs: 9000 },
    { type: "loop", startMs: 3000, endMs: 1000 },
    { type: "slow", rate: 2 },
    { type: "execute", code: "anything" },
  ])("rejects invalid action %j", (a) => {
    expect(() => validateAction(a, 8000)).toThrow();
  });
  it("rejects stale response or wrong session", () => {
    const d = localDecision(request);
    expect(() => acceptDecision({ ...d, revision: 1 }, request)).toThrow();
    expect(() =>
      acceptDecision({ ...d, sessionId: "other" }, request),
    ).toThrow();
  });
  it("rejects wrong request id", () => {
    expect(() =>
      acceptDecision({ ...localDecision(request), requestId: "old" }, request),
    ).toThrow();
  });
  it("rejects a range outside source duration", () => {
    expect(() => RequestSchema.parse({ ...request, endMs: 9000 })).toThrow();
  });
  it("falls back on malformed provider data", async () => {
    const result = await compose(request, {
      key: "test",
      fetchImpl: () => Promise.resolve(new Response("{}")),
    });
    expect(result).toMatchObject({
      source: "local",
      reason: "invalid_response",
    });
  });
  it("falls back on provider error", async () => {
    expect(
      await compose(request, {
        key: "test",
        fetchImpl: () => Promise.resolve(new Response("", { status: 503 })),
      }),
    ).toMatchObject({ source: "local", reason: "provider_unavailable" });
  });
  it("falls back on timeout with abort propagated", async () => {
    const fetchImpl: typeof fetch = (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });
    expect(
      await compose(request, { key: "test", fetchImpl, timeoutMs: 5 }),
    ).toMatchObject({ source: "local", reason: "timeout_or_cancelled" });
  });
  it("validates distribution before accepting provider selection", async () => {
    const payload = {
      answers: {
        next_action: {
          type: "choice",
          choice: "slow",
          confidence: 0.9,
          probabilities: {
            review: 0,
            slow: 0.9,
            loop: 0,
            clip: 0,
            clarify: 0.1,
          },
        },
      },
    };
    expect(
      await compose(request, {
        key: "test",
        fetchImpl: () => Promise.resolve(Response.json(payload)),
      }),
    ).toMatchObject({ source: "jev", action: { type: "slow", rate: 0.5 } });
    payload.answers.next_action.probabilities.slow = 0;
    expect(
      await compose(request, {
        key: "test",
        fetchImpl: () => Promise.resolve(Response.json(payload)),
      }),
    ).toMatchObject({ source: "local", reason: "invalid_response" });
  });
});
