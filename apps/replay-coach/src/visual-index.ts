import { z } from "zod";
export const VisualIndexSchema = z.object({
  version: z.literal("visual-change/v1"),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  runId: z.string(),
  sampledFps: z.literal(2),
  coverageMs: z.number().nonnegative(),
  warnings: z.array(z.string()),
  candidates: z.array(
    z.object({
      id: z.string(),
      startMs: z.number().nonnegative(),
      endMs: z.number().positive(),
      changeScore: z.number().min(0).max(1),
    }),
  ),
});
export type VisualIndex = z.infer<typeof VisualIndexSchema>;
// Mean absolute luma difference, not a tennis or athlete classifier.
export function indexFrames(
  frames: Uint8Array,
  fingerprint: string,
  runId: string,
): VisualIndex {
  const size = 32 * 18,
    count = Math.floor(frames.length / size);
  const candidates: VisualIndex["candidates"] = [];
  for (let frame = 1; frame < count; frame++) {
    let delta = 0;
    for (let pixel = 0; pixel < size; pixel++)
      delta += Math.abs(
        frames[frame * size + pixel] - frames[(frame - 1) * size + pixel],
      );
    const score = delta / size / 255;
    if (score < 0.08) continue;
    const time = frame * 500;
    if (candidates.some((c) => Math.abs(c.startMs + 1000 - time) < 2000))
      continue;
    candidates.push({
      id: `${fingerprint}:${time}`,
      startMs: Math.max(0, time - 1000),
      endMs: Math.min(count * 500, time + 2000),
      changeScore: score,
    });
  }
  return VisualIndexSchema.parse({
    version: "visual-change/v1",
    fingerprint,
    runId,
    sampledFps: 2,
    coverageMs: count * 500,
    warnings: [
      "Índice visual experimental: mudanças de luminosidade/câmera; não identifica golpes, vencedores, erros ou atletas.",
      "Cobertura limitada aos primeiros 120 segundos; limiar 0,08 não calibrado em partidas reais.",
    ],
    candidates,
  });
}
