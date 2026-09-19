import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeFrame,
  associatePose,
  isEvidenceCurrent,
  validRoi,
  visibleLandmark,
} from "./pose";
import type { PoseContext, PoseLandmark } from "./pose";

const context: PoseContext = {
  sessionId: "session",
  assetId: "asset",
  revision: 1,
  playerId: "player",
};
const roi = { x: 0.1, y: 0.05, width: 0.35, height: 0.9 };
function pose(center = 0.3): PoseLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: center + (i % 2 ? -0.04 : 0.04),
    y: 0.1 + i * 0.02,
    z: 0,
    visibility: 0.95,
  }));
}

describe("single-frame player association", () => {
  it("selects by ROI rather than model result order", () => {
    const evidence = associatePose(
      [pose(0.8), pose()],
      context,
      roi,
      4,
      1920,
      1080,
    );
    expect(evidence.status).toBe("matched");
    expect(evidence.landmarks?.[0].x).toBeCloseTo(0.34);
    expect(evidence.association).toBe("user-roi-single-frame");
    expect(evidence.detectedPoseCount).toBe(2);
  });
  it("abstains when both people fit selection", () => {
    const evidence = associatePose(
      [pose(), pose(0.35)],
      context,
      roi,
      4,
      1920,
      1080,
    );
    expect(evidence.status).toBe("ambiguous");
    expect(evidence.landmarks).toBeNull();
  });
  it("never fabricates landmarks from a selected box", () => {
    expect(associatePose([], context, roi, 4, 1920, 1080).landmarks).toBeNull();
    expect(associatePose([pose(0.8)], context, roi, 4, 1920, 1080).status).toBe(
      "no-pose",
    );
  });
  it("rejects occluded torsos and people below the source-pixel gate", () => {
    const occluded = pose();
    occluded[11].visibility = 0.7;
    expect(associatePose([occluded], context, roi, 4, 1920, 1080).status).toBe(
      "insufficient-visibility",
    );
    expect(associatePose([pose()], context, roi, 4, 320, 240).status).toBe(
      "insufficient-visibility",
    );
  });
  it("filters off-screen and malformed landmarks instead of clamping them", () => {
    expect(visibleLandmark({ ...pose()[0], x: -0.01 })).toBe(false);
    expect(visibleLandmark({ ...pose()[0], y: NaN })).toBe(false);
    expect(visibleLandmark({ ...pose()[0], visibility: 0.79 })).toBe(false);
    expect(validRoi({ ...roi, width: 1 })).toBe(false);
  });
  it("invalidates evidence for every identity revision and frame change", () => {
    const evidence = associatePose([pose()], context, roi, 4, 1920, 1080);
    expect(isEvidenceCurrent(evidence, context, 4)).toBe(true);
    for (const change of [
      { sessionId: "other" },
      { assetId: "other" },
      { revision: 2 },
      { playerId: "other" },
    ]) {
      expect(isEvidenceCurrent(evidence, { ...context, ...change }, 4)).toBe(
        false,
      );
    }
    expect(isEvidenceCurrent(evidence, context, 4.04)).toBe(false);
  });
});

describe("frame request lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function setup() {
    const video = {
      paused: true,
      seeking: false,
      readyState: 2,
      videoWidth: 1920,
      videoHeight: 1080,
      currentTime: 4,
      currentSrc: "blob:source",
    } as HTMLVideoElement;
    const close = vi.fn();
    const terminate = vi.fn();
    const send = vi.fn();
    const instance = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null,
      onmessageerror: null,
      terminate,
      postMessage: send,
    };
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }) }),
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ close })),
    );
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          return instance;
        }
      },
    );
    return { video, close, terminate, send, instance };
  }
  it("terminates the worker on cancellation and rejects without evidence", async () => {
    const { video, terminate } = setup();
    const controller = new AbortController();
    const request = analyzeFrame(video, context, roi, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(terminate).toHaveBeenCalledOnce();
  });
  it("does not return a result after the source or displayed frame changes", async () => {
    const { video, instance, terminate } = setup();
    const request = analyzeFrame(video, context, roi);
    await Promise.resolve();
    video.currentTime = 8;
    instance.onmessage?.({ data: { poses: [pose()] } } as MessageEvent);
    await expect(request).rejects.toThrow("O quadro mudou");
    expect(terminate).toHaveBeenCalledOnce();
  });
  it("bounds a model download/inference that never returns", async () => {
    vi.useFakeTimers();
    const { video, terminate } = setup();
    const request = analyzeFrame(video, context, roi);
    const rejected = expect(request).rejects.toThrow("45 segundos");
    await vi.advanceTimersByTimeAsync(45_000);
    await rejected;
    expect(terminate).toHaveBeenCalledOnce();
  });
  it("preserves model failures as errors rather than empty or synthetic poses", async () => {
    const { video, instance } = setup();
    const request = analyzeFrame(video, context, roi);
    await Promise.resolve();
    instance.onmessage?.({
      data: { error: "Model download failed" },
    } as MessageEvent);
    await expect(request).rejects.toThrow("Model download failed");
  });
  it("requires a paused loaded frame before starting work", async () => {
    const { video, send } = setup();
    Object.defineProperty(video, "paused", { value: false });
    await expect(analyzeFrame(video, context, roi)).rejects.toThrow(
      "Pause o vídeo",
    );
    expect(send).not.toHaveBeenCalled();
  });
});
