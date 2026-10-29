import { z } from "zod";

// A clip always belongs to one original; only a reel may cross originals.
export const ReelClipSchema = z
  .object({
    id: z.string().min(1).max(100),
    sessionId: z.string().min(1).max(100),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    label: z.string().max(200),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .strict()
  .refine((c) => c.endMs > c.startMs, "Invalid clip interval");
export const ReelSchema = z
  .object({
    version: z.literal("reel/v1"),
    id: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
    clips: z.array(ReelClipSchema).max(32),
  })
  .strict()
  .refine(
    (r) => new Set(r.clips.map((c) => c.id)).size === r.clips.length,
    "Duplicate clip ID",
  );
export const RenderSchema = z
  .object({
    reel: ReelSchema,
    sources: z
      .array(
        z
          .object({
            fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
            size: z
              .number()
              .int()
              .positive()
              .max(1024 ** 3),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((r, ctx) => {
    const hashes = new Set(r.sources.map((s) => s.fingerprint));
    if (
      hashes.size !== r.sources.length ||
      r.sources.reduce((n, s) => n + s.size, 0) > 1024 ** 3
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate sources or batch exceeds 1 GiB",
      });
    if (
      !r.reel.clips.length ||
      r.reel.clips.some((c) => !hashes.has(c.fingerprint))
    )
      ctx.addIssue({ code: "custom", message: "Missing original source" });
    if (reelDuration(r.reel) > 120_000)
      ctx.addIssue({ code: "custom", message: "Reel exceeds 120 seconds" });
  });
export type Reel = z.infer<typeof ReelSchema>;
export type ReelClip = z.infer<typeof ReelClipSchema>;
export type RenderRequest = z.infer<typeof RenderSchema>;
export function reelDuration(reel: Reel) {
  return reel.clips.reduce((n, c) => n + c.endMs - c.startMs, 0);
}
export function reviseReel(reel: Reel, clips: ReelClip[]): Reel {
  return ReelSchema.parse({ ...reel, revision: reel.revision + 1, clips });
}
