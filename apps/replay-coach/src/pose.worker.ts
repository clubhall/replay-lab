// Keep this worker classic. A module worker cannot execute MediaPipe's importScripts WASM loader.
// Runtime + model URLs are pinned and supplied by pose.ts; image pixels never leave this worker.
type WorkerPoseRequest = import("./pose").PoseWorkerRequest;
type WorkerPoseResponse = import("./pose").PoseWorkerResponse;
type VisionApi = typeof import("@mediapipe/tasks-vision");

self.onmessage = async (event: MessageEvent<WorkerPoseRequest>) => {
  const { bitmap, runtimeUrl, wasmUrl, modelUrl } = event.data;
  let landmarker: import("@mediapipe/tasks-vision").PoseLandmarker | undefined;
  try {
    const vision = (await import(
      /* @vite-ignore */ runtimeUrl
    )) as unknown as VisionApi;
    const files = await vision.FilesetResolver.forVisionTasks(wasmUrl);
    landmarker = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" },
      runningMode: "IMAGE",
      numPoses: 2,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    const result = landmarker.detect(bitmap);
    self.postMessage({
      poses: result.landmarks.map((pose) =>
        pose.map(({ x, y, z, visibility }) => ({ x, y, z, visibility })),
      ),
    } satisfies WorkerPoseResponse);
  } catch (error) {
    self.postMessage({
      error: `Não foi possível executar o modelo local. ${error instanceof Error ? error.message : "Falha desconhecida."}`,
    } satisfies WorkerPoseResponse);
  } finally {
    bitmap.close();
    landmarker?.close();
  }
};
