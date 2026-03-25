import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { drawOverlayFrame } from "@clubhall/replay-overlays";
import type { OverlayLayer, PoseFrame, Track } from "@clubhall/video-domain";

type VideoMetadata = {
  durationMs: number;
  width: number;
  height: number;
};

type ReplayPlayerProps = {
  assetUrl?: string | null;
  title: string;
  currentTimeMs: number;
  isPlaying: boolean;
  sourceSize: {
    width: number;
    height: number;
  };
  layers: OverlayLayer[];
  tracks: Track[];
  poseFrames: PoseFrame[];
  overlayContent?: ReactNode;
  onTimeUpdate: (timeMs: number) => void;
  onMetadata: (metadata: VideoMetadata) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
};

type VideoElementWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function ReplayPlayer({
  assetUrl,
  title,
  currentTimeMs,
  isPlaying,
  sourceSize,
  layers,
  tracks,
  poseFrames,
  overlayContent,
  onTimeUpdate,
  onMetadata,
  onPlayStateChange
}: ReplayPlayerProps) {
  const videoRef = useRef<VideoElementWithFrameCallback | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderTimeMs, setRenderTimeMs] = useState(currentTimeMs);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const effectiveTimeMs = isPlaying ? renderTimeMs : currentTimeMs;

  useEffect(() => {
    setRenderTimeMs(currentTimeMs);
  }, [currentTimeMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (isPlaying) {
      void video.play().catch(() => onPlayStateChange(false));
    } else {
      video.pause();
    }
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || Math.abs(video.currentTime * 1000 - currentTimeMs) < 120) {
      return;
    }
    video.currentTime = currentTimeMs / 1000;
  }, [currentTimeMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let frameHandle = 0;
    const tick = () => {
      const nextTimeMs = video.currentTime * 1000;
      setRenderTimeMs(nextTimeMs);
      onTimeUpdate(nextTimeMs);
      if (video.requestVideoFrameCallback && !video.paused && !video.ended) {
        frameHandle = video.requestVideoFrameCallback(tick);
      }
    };

    if (isPlaying && video.requestVideoFrameCallback) {
      frameHandle = video.requestVideoFrameCallback(tick);
    }

    return () => {
      if (frameHandle && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(frameHandle);
      }
    };
  }, [isPlaying, onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }

    const resize = () => {
      const rect = video.getBoundingClientRect();
      setCanvasSize({
        width: rect.width,
        height: rect.height
      });
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(video);
    resize();
    return () => observer.disconnect();
  }, [assetUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    drawOverlayFrame({
      ctx,
      canvasSize,
      sourceSize,
      currentTimeMs: effectiveTimeMs,
      layers,
      tracks,
      poseFrames
    });
  }, [canvasSize, effectiveTimeMs, layers, poseFrames, sourceSize, tracks]);

  const controls = useMemo(
    () => ({
      onLoadedMetadata() {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        onMetadata({
          durationMs: video.duration * 1000,
          width: video.videoWidth,
          height: video.videoHeight
        });
      },
      onTimeUpdate() {
        const video = videoRef.current;
        if (!video) {
          return;
        }
        const nextTimeMs = video.currentTime * 1000;
        setRenderTimeMs(nextTimeMs);
        onTimeUpdate(nextTimeMs);
      }
    }),
    [onMetadata, onTimeUpdate]
  );

  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        minHeight: 0
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <strong style={{ display: "block", fontSize: "1.1rem" }}>{title}</strong>
          <span style={{ color: "var(--ch-color-ink-muted)", fontSize: "0.9rem" }}>
            {Math.round(effectiveTimeMs / 1000)}s
          </span>
        </div>
        <button
          type="button"
          onClick={() => onPlayStateChange(!isPlaying)}
          style={{
            borderRadius: 999,
            border: "1px solid var(--ch-color-border)",
            background: "rgba(244, 239, 229, 0.08)",
            color: "var(--ch-color-ink)",
            padding: "0.72rem 0.9rem",
            cursor: "pointer"
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          background: "#040811",
          aspectRatio: "16 / 9",
          border: "1px solid var(--ch-color-border)"
        }}
      >
        {assetUrl ? (
          <>
            <video
              ref={videoRef}
              src={assetUrl}
              controls={false}
              preload="metadata"
              onLoadedMetadata={controls.onLoadedMetadata}
              onTimeUpdate={controls.onTimeUpdate}
              onPlay={() => onPlayStateChange(true)}
              onPause={() => onPlayStateChange(false)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block"
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none"
              }}
            />
            {overlayContent}
          </>
        ) : (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: "100%",
              height: "100%",
              color: "var(--ch-color-ink-muted)"
            }}
          >
            Reattach the source video to continue playback.
          </div>
        )}
      </div>
    </div>
  );
}
