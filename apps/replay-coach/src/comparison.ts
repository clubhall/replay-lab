import { z } from "zod";

const SourceSchema = z
  .object({
    sessionId: z.string(),
    fingerprint: z.string(),
    referenceMs: z.number().finite().nonnegative(),
  })
  .strict();
export const ComparisonSchema = z
  .object({
    version: z.literal("comparison/v1"),
    left: SourceSchema,
    right: SourceSchema,
    positionMs: z.number().finite().nonnegative(),
  })
  .strict();
export type Comparison = z.infer<typeof ComparisonSchema>;
export type ComparisonWindow = {
  leftStartMs: number;
  rightStartMs: number;
  durationMs: number;
  referenceMs: number;
  offsetMs: number;
};

// Source references represent the same instant. Retain only their shared coverage.
export function comparisonWindow(
  leftDurationMs: number,
  rightDurationMs: number,
  leftReferenceMs: number,
  rightReferenceMs: number,
): ComparisonWindow {
  if (
    ![leftDurationMs, rightDurationMs, leftReferenceMs, rightReferenceMs].every(
      Number.isFinite,
    ) ||
    leftDurationMs <= 0 ||
    rightDurationMs <= 0 ||
    leftReferenceMs < 0 ||
    rightReferenceMs < 0 ||
    leftReferenceMs >= leftDurationMs ||
    rightReferenceMs >= rightDurationMs
  )
    throw new Error(
      "As referências devem estar dentro dos vídeos disponíveis.",
    );
  const offsetMs = rightReferenceMs - leftReferenceMs;
  const leftStartMs = Math.max(0, -offsetMs);
  const rightStartMs = Math.max(0, offsetMs);
  return {
    leftStartMs,
    rightStartMs,
    offsetMs,
    durationMs: Math.min(
      leftDurationMs - leftStartMs,
      rightDurationMs - rightStartMs,
    ),
    referenceMs: leftReferenceMs - leftStartMs,
  };
}
export function comparisonTimes(window: ComparisonWindow, positionMs: number) {
  if (!Number.isFinite(positionMs)) throw new Error("Posição inválida.");
  const clampedMs = Math.max(0, Math.min(window.durationMs, positionMs));
  return {
    positionMs: clampedMs,
    leftMs: window.leftStartMs + clampedMs,
    rightMs: window.rightStartMs + clampedMs,
  };
}
