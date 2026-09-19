/** Real, on-device IMAGE inference. ROI association applies only to this frame. */
export interface PoseContext {
  sessionId: string;
  assetId: string;
  revision: number;
  playerId: string;
}

export interface NormalizedRoi {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export const POSE_MODEL = {
  name: "MediaPipe Pose Landmarker Lite",
  runtimeVersion: "0.10.32",
  modelVersion: "float16/1",
  runtimeUrl:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  license: "Apache-2.0",
  licenseUrl: "https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE",
  modelCardUrl:
    "https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf",
  mode: "IMAGE",
  maxPoses: 2,
} as const;

export interface PoseEvidence extends PoseContext {
  timestampSeconds: number;
  sourceWidth: number;
  sourceHeight: number;
  roi: NormalizedRoi;
  status: "matched" | "no-pose" | "ambiguous" | "insufficient-visibility";
  landmarks: PoseLandmark[] | null;
  detectedPoseCount: number;
  reason: string;
  model: typeof POSE_MODEL;
  association: "user-roi-single-frame";
  quality: { visibleCount: number; personHeightPixels: number };
}

export interface PoseWorkerRequest {
  bitmap: ImageBitmap;
  runtimeUrl: string;
  wasmUrl: string;
  modelUrl: string;
}
export type PoseWorkerResponse =
  | { poses: PoseLandmark[][] }
  | { error: string };

// Landmark indices from the official MediaPipe 33-point topology.
export const POSE_CONNECTIONS: readonly (readonly [number, number])[] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [27, 31],
  [28, 30],
  [30, 32],
  [28, 32],
];

export function visibleLandmark(
  point: PoseLandmark | undefined,
  threshold = 0.8,
): point is PoseLandmark {
  return (
    !!point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z) &&
    Number.isFinite(point.visibility) &&
    point.visibility >= threshold &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function validRoi(roi: NormalizedRoi): boolean {
  return (
    Object.values(roi).every(Number.isFinite) &&
    roi.x >= 0 &&
    roi.y >= 0 &&
    roi.width > 0 &&
    roi.height > 0 &&
    roi.x + roi.width <= 1.000001 &&
    roi.y + roi.height <= 1.000001
  );
}

function inside(point: PoseLandmark, roi: NormalizedRoi): boolean {
  return (
    point.x >= roi.x &&
    point.x <= roi.x + roi.width &&
    point.y >= roi.y &&
    point.y <= roi.y + roi.height
  );
}

/** Conservative engineering gates, not calibrated scientific confidence. */
export function associatePose(
  poses: PoseLandmark[][],
  context: PoseContext,
  roi: NormalizedRoi,
  timestampSeconds: number,
  sourceWidth: number,
  sourceHeight: number,
): PoseEvidence {
  const base: PoseEvidence = {
    ...context,
    roi: { ...roi },
    timestampSeconds,
    sourceWidth,
    sourceHeight,
    status: "no-pose",
    landmarks: null,
    detectedPoseCount: poses.length,
    reason: "Nenhuma pose associada ao jogador selecionado neste quadro.",
    model: POSE_MODEL,
    association: "user-roi-single-frame",
    quality: { visibleCount: 0, personHeightPixels: 0 },
  };
  if (!validRoi(roi))
    return { ...base, reason: "Selecione uma região válida para este quadro." };
  const torso = [11, 12, 23, 24];
  const candidates = poses.filter((pose) => {
    if (pose.length !== 33) return false;
    const core = torso
      .map((index) => pose[index])
      .filter((p) => visibleLandmark(p, 0.5));
    return core.length >= 2 && core.filter((p) => inside(p, roi)).length >= 2;
  });
  if (candidates.length > 1)
    return {
      ...base,
      status: "ambiguous",
      reason:
        "Mais de um corpo coincide com a seleção. Ajuste a região neste quadro.",
    };
  const selected = candidates[0];
  if (!selected) return base;
  const visible = selected.filter((p) => visibleLandmark(p));
  const personHeightPixels = visible.length
    ? (Math.max(...visible.map((p) => p.y)) -
        Math.min(...visible.map((p) => p.y))) *
      sourceHeight
    : 0;
  const quality = { visibleCount: visible.length, personHeightPixels };
  if (
    !torso.every(
      (index) =>
        visibleLandmark(selected[index]) && inside(selected[index], roi),
    ) ||
    personHeightPixels < 180
  ) {
    return {
      ...base,
      quality,
      status: "insufficient-visibility",
      reason:
        "Corpo pequeno ou tronco pouco visível. A seleção exige quatro pontos do tronco visíveis (≥0,8) e altura observada ≥180 px; são critérios provisórios.",
    };
  }
  return {
    ...base,
    quality,
    status: "matched",
    landmarks: selected.map((p) => ({ ...p })),
    reason:
      "Pose estimada no quadro e associada à seleção manual. Não há rastreamento entre quadros.",
  };
}

export function isEvidenceCurrent(
  evidence: PoseEvidence,
  context: PoseContext,
  timestampSeconds: number,
): boolean {
  return (
    evidence.sessionId === context.sessionId &&
    evidence.assetId === context.assetId &&
    evidence.revision === context.revision &&
    evidence.playerId === context.playerId &&
    Math.abs(evidence.timestampSeconds - timestampSeconds) < 0.001
  );
}

/** Caller must invalidate ROI and abort on seek, source, player or revision changes. */
export function analyzeFrame(
  video: HTMLVideoElement,
  context: PoseContext,
  roi: NormalizedRoi,
  signal?: AbortSignal,
): Promise<PoseEvidence> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Análise cancelada.", "AbortError"));
      return;
    }
    if (
      !video.paused ||
      video.seeking ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      reject(
        new Error("Pause o vídeo em um quadro carregado antes de analisar."),
      );
      return;
    }
    if (!validRoi(roi)) {
      reject(new Error("Selecione o jogador neste quadro."));
      return;
    }
    const identity = { ...context };
    const selection = { ...roi };
    const timestamp = video.currentTime;
    const source = video.currentSrc;
    const width = video.videoWidth;
    const height = video.videoHeight;
    let worker: Worker | undefined;
    let bitmap: ImageBitmap | undefined;
    let settled = false;
    const finish = (error?: Error, evidence?: PoseEvidence) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker?.terminate();
      bitmap?.close();
      if (error) reject(error);
      else if (evidence) resolve(evidence);
    };
    const abort = () =>
      finish(new DOMException("Análise cancelada.", "AbortError"));
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "A análise excedeu 45 segundos. Verifique a conexão para baixar o modelo e tente novamente.",
          ),
        ),
      45_000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    void (async () => {
      try {
        // Synchronous intrinsic-size snapshot prevents letterboxing entering model coordinates.
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const drawing = canvas.getContext("2d");
        if (!drawing)
          throw new Error("Captura de quadro indisponível neste navegador.");
        drawing.drawImage(video, 0, 0, width, height);
        bitmap = await createImageBitmap(canvas);
        if (settled) {
          bitmap.close();
          return;
        }
        // Classic worker is deliberate: MediaPipe's WASM loader uses importScripts.
        worker = new Worker(new URL("./pose.worker.ts", import.meta.url));
        worker.onerror = (event) =>
          finish(
            new Error(
              event.message || "Não foi possível iniciar a análise local.",
            ),
          );
        worker.onmessageerror = () =>
          finish(new Error("Resposta inválida do processamento local."));
        worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
          if ("error" in event.data) {
            finish(new Error(event.data.error));
            return;
          }
          if (
            video.currentSrc !== source ||
            video.videoWidth !== width ||
            video.videoHeight !== height ||
            !video.paused ||
            video.seeking ||
            Math.abs(video.currentTime - timestamp) >= 0.001
          ) {
            finish(
              new Error(
                "O quadro mudou durante a análise. Selecione o jogador novamente.",
              ),
            );
            return;
          }
          finish(
            undefined,
            associatePose(
              event.data.poses,
              identity,
              selection,
              timestamp,
              width,
              height,
            ),
          );
        };
        worker.postMessage(
          {
            bitmap,
            runtimeUrl: POSE_MODEL.runtimeUrl,
            wasmUrl: POSE_MODEL.wasmUrl,
            modelUrl: POSE_MODEL.modelUrl,
          } satisfies PoseWorkerRequest,
          [bitmap],
        );
        bitmap = undefined;
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("Falha ao analisar este quadro."),
        );
      }
    })();
  });
}
