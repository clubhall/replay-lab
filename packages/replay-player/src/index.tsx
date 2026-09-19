import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { drawOverlayFrame } from "@clubhall/replay-overlays";
import type { OverlayLayer, PoseFrame, Track } from "@clubhall/video-domain";

type VideoMetadata = {
  durationMs: number;
  width: number;
  height: number;
};

export type ReplayPlayerProps = {
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
  playbackRate?: number;
  muted?: boolean;
  loopRange?: { startMs: number; endMs: number };
  showControls?: boolean;
  className?: string;
  onTimeUpdate: (timeMs: number) => void;
  onMetadata: (metadata: VideoMetadata) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onError?: (message: string) => void;
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
  playbackRate = 1,
  muted = false,
  loopRange,
  showControls = true,
  className,
  onTimeUpdate,
  onMetadata,
  onPlayStateChange,
  onError
}: ReplayPlayerProps) {
  const videoRef = useRef<VideoElementWithFrameCallback | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportedPositionRef = useRef<{
    assetUrl: typeof assetUrl;
    timeMs: number;
  } | null>(null);
  const playRequestRef = useRef(0);
  const [renderTimeMs, setRenderTimeMs] = useState(currentTimeMs);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const effectiveTimeMs = isPlaying ? renderTimeMs : currentTimeMs;

  const reportTime = useCallback(
    (timeMs: number) => {
      reportedPositionRef.current = { assetUrl, timeMs };
      setRenderTimeMs(timeMs);
      onTimeUpdate(timeMs);
    },
    [assetUrl, onTimeUpdate]
  );

  const playVideo = useCallback(
    (video: HTMLVideoElement) => {
      const request = ++playRequestRef.current;
      void video.play().catch((error: unknown) => {
        if (videoRef.current !== video || request !== playRequestRef.current) {
          return;
        }
        onPlayStateChange(false);
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          onError?.("Playback could not start. Try pressing play again.");
        }
      });
    },
    [onError, onPlayStateChange]
  );

  const seekVideo = useCallback((video: HTMLVideoElement, timeMs: number) => {
    const nextTimeMs = clampTime(timeMs, video.duration);
    if (Math.abs(video.currentTime * 1000 - nextTimeMs) > 1) {
      video.currentTime = nextTimeMs / 1000;
    }
    setRenderTimeMs(nextTimeMs);
    return nextTimeMs;
  }, []);

  const syncRate = useCallback(
    (video: HTMLVideoElement) => {
      const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
      try {
        video.playbackRate = rate;
      } catch {
        onError?.("This playback speed is not supported by your browser.");
      }
    },
    [onError, playbackRate]
  );

  const loopStartMs = loopRange?.startMs;
  const loopEndMs = loopRange?.endMs;

  const readLoop = useCallback(
    (video: HTMLVideoElement) => {
      if (
        loopStartMs === undefined ||
        loopEndMs === undefined ||
        !Number.isFinite(loopStartMs) ||
        !Number.isFinite(loopEndMs) ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        return null;
      }
      const startMs = clampTime(loopStartMs, video.duration);
      const endMs = clampTime(loopEndMs, video.duration);
      return endMs > startMs ? { startMs, endMs } : null;
    },
    [loopEndMs, loopStartMs]
  );

  const syncPlayback = useCallback(
    (video: HTMLVideoElement) => {
      if (!isPlaying) {
        ++playRequestRef.current;
        video.pause();
        return;
      }
      if (video.readyState < 1) {
        return;
      }
      const loop = readLoop(video);
      const timeMs = video.currentTime * 1000;
      if (loop && (timeMs < loop.startMs || timeMs >= loop.endMs)) {
        reportTime(seekVideo(video, loop.startMs));
      } else if (video.ended || timeMs >= video.duration * 1000) {
        reportTime(seekVideo(video, 0));
      }
      if (video.paused) {
        playVideo(video);
      }
    },
    [isPlaying, playVideo, readLoop, reportTime, seekVideo]
  );

  // A reported media time coming back through the controlled prop is an echo,
  // not a new seek. Applying it would pull advancing video frames backward.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) {
      return;
    }
    const reported = reportedPositionRef.current;
    if (reported && reported.assetUrl === assetUrl && reported.timeMs === currentTimeMs) {
      return;
    }
    seekVideo(video, currentTimeMs);
  }, [assetUrl, currentTimeMs, seekVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    syncPlayback(video);
  }, [assetUrl, syncPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      syncRate(video);
    }
  }, [assetUrl, syncRate]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 1) {
      return;
    }
    const loop = readLoop(video);
    const nextTimeMs = clampTime(video.currentTime * 1000, video.duration);
    if (isPlaying && loop && !video.seeking && (nextTimeMs >= loop.endMs || nextTimeMs < loop.startMs)) {
      reportTime(seekVideo(video, loop.startMs));
      if (video.paused) {
        playVideo(video);
      }
      return;
    }
    reportTime(nextTimeMs);
  }, [isPlaying, playVideo, readLoop, reportTime, seekVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let frameHandle = 0;
    const tick = () => {
      handleTimeUpdate();
      if (video.requestVideoFrameCallback && video === videoRef.current) {
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
  }, [assetUrl, handleTimeUpdate, isPlaying]);

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

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gap: "0.75rem",
        minHeight: 0
      }}
    >
      {showControls && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
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
      )}
      <div
        className="replay-player-screen"
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
              key={assetUrl}
              ref={videoRef}
              src={assetUrl}
              aria-label={title}
              playsInline
              muted={muted}
              controls={false}
              preload="metadata"
              onLoadedMetadata={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                syncRate(video);
                reportTime(seekVideo(video, currentTimeMs));
                if (
                  Number.isFinite(video.duration) &&
                  video.duration > 0 &&
                  video.videoWidth > 0 &&
                  video.videoHeight > 0
                ) {
                  onMetadata({
                    durationMs: video.duration * 1000,
                    width: video.videoWidth,
                    height: video.videoHeight
                  });
                }
                syncPlayback(video);
              }}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => onPlayStateChange(true)}
              onPause={() => {
                const video = videoRef.current;
                if (video && video.paused && !(video.ended && isPlaying && readLoop(video))) {
                  onPlayStateChange(false);
                }
              }}
              onEnded={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                const loop = readLoop(video);
                if (isPlaying && loop) {
                  reportTime(seekVideo(video, loop.startMs));
                  playVideo(video);
                } else {
                  reportTime(clampTime(video.currentTime * 1000, video.duration));
                  onPlayStateChange(false);
                }
              }}
              onError={() => {
                ++playRequestRef.current;
                onPlayStateChange(false);
                onError?.("The video could not be loaded. Try opening the source file again.");
              }}
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

function clampTime(timeMs: number, durationSeconds: number) {
  const finiteTime = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;
  return Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? Math.min(finiteTime, durationSeconds * 1000)
    : finiteTime;
}
