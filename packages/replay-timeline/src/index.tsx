import { useMemo } from "react";
import { formatTimecode, type Segment } from "@clubhall/video-domain";

export type ReplayTimelineProps = {
  durationMs: number;
  currentTimeMs: number;
  segments: Segment[];
  selectedSegmentId?: string;
  thumbnails?: Record<string, string>;
  onSeek: (timeMs: number) => void;
  onSelectSegment: (segmentId: string) => void;
};

export function ReplayTimeline({
  durationMs,
  currentTimeMs,
  segments,
  selectedSegmentId,
  thumbnails,
  onSeek,
  onSelectSegment
}: ReplayTimelineProps) {
  const ticks = useMemo(() => {
    const tickCount = Math.min(16, Math.max(6, Math.floor(durationMs / 30_000)));
    return Array.from({ length: tickCount + 1 }, (_, index) => {
      const ratio = index / tickCount;
      const timeMs = durationMs * ratio;
      return {
        ratio,
        timeMs
      };
    });
  }, [durationMs]);
  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId]
  );
  const coverageRatio = useMemo(() => {
    if (durationMs <= 0) {
      return 0;
    }
    const covered = segments.reduce((sum, segment) => sum + (segment.endMs - segment.startMs), 0);
    return Math.min(100, (covered / durationMs) * 100);
  }, [durationMs, segments]);

  return (
    <div
      style={{
        display: "grid",
        gap: "0.9rem"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ch-color-ink-muted)" }}>
        <strong style={{ color: "var(--ch-color-ink)" }}>Timeline</strong>
        <span>
          {formatTimecode(currentTimeMs)} / {formatTimecode(durationMs)}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
          gap: "0.65rem"
        }}
      >
        <div
          style={{
            borderRadius: 18,
            border: "1px solid var(--ch-color-border)",
            background: "rgba(11, 16, 32, 0.44)",
            padding: "0.75rem 0.85rem"
          }}
        >
          <strong style={{ display: "block", color: "var(--ch-color-ink)" }}>{segments.length}</strong>
          <span style={{ color: "var(--ch-color-ink-muted)", fontSize: "0.8rem" }}>segments in session</span>
        </div>
        <div
          style={{
            borderRadius: 18,
            border: "1px solid var(--ch-color-border)",
            background: "rgba(11, 16, 32, 0.44)",
            padding: "0.75rem 0.85rem"
          }}
        >
          <strong style={{ display: "block", color: "var(--ch-color-ink)" }}>{coverageRatio.toFixed(1)}%</strong>
          <span style={{ color: "var(--ch-color-ink-muted)", fontSize: "0.8rem" }}>timeline coverage</span>
        </div>
        <div
          style={{
            borderRadius: 18,
            border: "1px solid var(--ch-color-border)",
            background: "rgba(11, 16, 32, 0.44)",
            padding: "0.75rem 0.85rem"
          }}
        >
          <strong style={{ display: "block", color: "var(--ch-color-ink)" }}>
            {selectedSegment ? selectedSegment.label : "No segment"}
          </strong>
          <span style={{ color: "var(--ch-color-ink-muted)", fontSize: "0.8rem" }}>
            {selectedSegment ? `${formatTimecode(selectedSegment.startMs)} - ${formatTimecode(selectedSegment.endMs)}` : "Select a segment to inspect it"}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          padding: "1rem 0.8rem 1.1rem",
          borderRadius: 24,
          background: "rgba(11, 16, 32, 0.76)",
          border: "1px solid var(--ch-color-border)"
        }}
      >
        <div style={{ position: "relative", height: 30, marginBottom: "0.9rem" }}>
          {ticks.map((tick) => (
            <div
              key={tick.timeMs}
              style={{
                position: "absolute",
                left: `${tick.ratio * 100}%`,
                top: 0,
                transform: "translateX(-50%)",
                color: "var(--ch-color-ink-muted)",
                fontSize: "0.72rem"
              }}
            >
              {formatTimecode(tick.timeMs)}
            </div>
          ))}
        </div>

        <div
          role="presentation"
          onClick={(event) => {
            const container = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - container.left) / container.width;
            onSeek(Math.max(0, Math.min(durationMs, ratio * durationMs)));
          }}
          style={{
            position: "relative",
            height: 150,
            borderRadius: 20,
            background: "rgba(25, 36, 67, 0.9)",
            cursor: "pointer"
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "16px 0 78px",
              borderTop: "1px solid rgba(244, 239, 229, 0.08)",
              borderBottom: "1px solid rgba(244, 239, 229, 0.08)"
            }}
          />
          {segments.map((segment) => {
            const left = (segment.startMs / durationMs) * 100;
            const width = ((segment.endMs - segment.startMs) / durationMs) * 100;
            const selected = segment.id === selectedSegmentId;
            return (
              <button
                key={segment.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSegment(segment.id);
                }}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${Math.max(width, 1.8)}%`,
                  top: 38,
                  height: 42,
                  borderRadius: 16,
                  border: selected ? "1px solid var(--ch-color-accent)" : "1px solid rgba(244, 239, 229, 0.08)",
                  background: selected ? "rgba(134, 239, 172, 0.26)" : "rgba(134, 239, 172, 0.14)",
                  color: "var(--ch-color-ink)",
                  textAlign: "left",
                  padding: "0.35rem 0.45rem",
                  overflow: "hidden"
                }}
                title={`${segment.label} (${formatTimecode(segment.startMs)} - ${formatTimecode(segment.endMs)})`}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden"
                  }}
                >
                  {segment.label}
                </span>
              </button>
            );
          })}

          {segments.map((segment) => {
            const midpoint = ((segment.startMs + segment.endMs) / 2 / durationMs) * 100;
            const thumbnail = thumbnails?.[segment.id];
            return (
              <div
                key={`${segment.id}-marker`}
                style={{
                  position: "absolute",
                  left: `${midpoint}%`,
                  bottom: 16,
                  transform: "translateX(-50%)",
                  width: 70,
                  textAlign: "center"
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 42,
                    overflow: "hidden",
                    borderRadius: 14,
                    border: "1px solid rgba(244, 239, 229, 0.08)",
                    background: thumbnail
                      ? `center / cover no-repeat url(${thumbnail})`
                      : "linear-gradient(135deg, rgba(134, 239, 172, 0.16), rgba(125, 211, 252, 0.14))"
                  }}
                />
                <span style={{ fontSize: "0.68rem", color: "var(--ch-color-ink-muted)" }}>
                  {formatTimecode(segment.startMs)}
                </span>
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              left: `${(currentTimeMs / durationMs) * 100}%`,
              top: 16,
              bottom: 16,
              width: 2,
              transform: "translateX(-50%)",
              background: "linear-gradient(180deg, var(--ch-color-accent), rgba(134, 239, 172, 0.18))",
              boxShadow: "0 0 18px rgba(134, 239, 172, 0.5)"
            }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={durationMs || 0}
          step={50}
          value={Math.min(currentTimeMs, durationMs || 0)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          style={{ width: "100%", marginTop: "0.9rem" }}
        />
      </div>
    </div>
  );
}

export async function captureVideoThumbnail(assetUrl: string, timeMs: number) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await waitForVideoEvent(video, "loadedmetadata", () => {
      video.src = assetUrl;
      video.load();
    });
    const lastFrameTime = Number.isFinite(video.duration)
      ? Math.max(0, video.duration - 0.001)
      : 0;
    const seekTime = Math.min(
      lastFrameTime,
      Math.max(0, Number.isFinite(timeMs) ? timeMs / 1000 : 0),
    );
    if (Math.abs(video.currentTime - seekTime) > 0.001) {
      await waitForVideoEvent(video, "seeked", () => {
        video.currentTime = seekTime;
      });
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D unavailable");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

function waitForVideoEvent(
  target: HTMLMediaElement,
  eventName: keyof HTMLMediaElementEventMap,
  action?: () => void,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      target.removeEventListener(eventName, onResolve);
      target.removeEventListener("error", onReject);
    };
    const onResolve = () => {
      cleanup();
      resolve();
    };
    const onReject = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${eventName}`));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out while waiting for ${eventName}`));
    }, 10_000);
    target.addEventListener(eventName, onResolve, { once: true });
    target.addEventListener("error", onReject, { once: true });
    try {
      action?.();
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(`Failed while waiting for ${eventName}`, { cause: error }));
    }
  });
}
