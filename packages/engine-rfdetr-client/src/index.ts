import { z } from "zod";
import { EngineOutputSchema, EngineRequestSchema } from "@clubhall/analysis-contracts";
import { EngineRunSchema, VideoAssetSchema, type EngineRun, type VideoAsset } from "@clubhall/video-domain";

const AssetRegistrationResponseSchema = VideoAssetSchema;
const RunResponseSchema = z.object({
  run: EngineRunSchema,
  output: EngineOutputSchema.optional()
});

export type RfdetrClient = ReturnType<typeof createRfdetrClient>;

export function createRfdetrClient(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async registerAsset(file: File) {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${normalizedBaseUrl}/api/v1/assets`, {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        throw new Error(`Asset upload failed with ${response.status}`);
      }
      const payload = await response.json();
      return AssetRegistrationResponseSchema.parse(payload);
    },
    async createRun(request: {
      asset: VideoAsset;
      sessionId: string;
      timeRangeMs?: [number, number];
      segmentId?: string;
      classes?: string[];
      fixtureMode?: boolean;
    }) {
      const payload = EngineRequestSchema.parse({
        version: "v1",
        engineId: "rfdetr",
        sessionId: request.sessionId,
        assetId: request.asset.id,
        segmentId: request.segmentId,
        timeRangeMs: request.timeRangeMs,
        options: {
          classes: request.classes ?? ["person", "sports ball"],
          fixtureMode: request.fixtureMode ?? true
        }
      });

      const response = await fetch(`${normalizedBaseUrl}/api/v1/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Run creation failed with ${response.status}`);
      }
      const data = await response.json();
      return RunResponseSchema.parse(data);
    },
    async getRun(runId: string) {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/runs/${runId}`);
      if (!response.ok) {
        throw new Error(`Run retrieval failed with ${response.status}`);
      }
      return RunResponseSchema.parse(await response.json());
    },
    async pollRun(runId: string, onUpdate?: (run: EngineRun) => void) {
      while (true) {
        const response = await this.getRun(runId);
        onUpdate?.(response.run);
        if (response.run.status === "completed" || response.run.status === "failed") {
          return response;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };
}
