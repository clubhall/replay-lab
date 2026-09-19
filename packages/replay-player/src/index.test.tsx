// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReplayPlayer, type ReplayPlayerProps } from "./index";

vi.mock("@clubhall/replay-overlays", () => ({ drawOverlayFrame: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function props(patch: Partial<ReplayPlayerProps> = {}): ReplayPlayerProps {
  return {
    assetUrl: "blob:match-one",
    title: "My tennis match",
    currentTimeMs: 0,
    isPlaying: false,
    sourceSize: { width: 1920, height: 1080 },
    layers: [],
    tracks: [],
    poseFrames: [],
    onTimeUpdate: vi.fn(),
    onMetadata: vi.fn(),
    onPlayStateChange: vi.fn(),
    onError: vi.fn(),
    ...patch,
  };
}

function loadMetadata(video: HTMLVideoElement, duration = 20) {
  Object.defineProperties(video, {
    readyState: { value: 1, configurable: true },
    duration: { value: duration, configurable: true },
    videoWidth: { value: 1920, configurable: true },
    videoHeight: { value: 1080, configurable: true },
  });
  fireEvent.loadedMetadata(video);
}

describe("ReplayPlayer", () => {
  it("restores the requested position after metadata and applies Watch presentation and speed", () => {
    const callbacks = props({
      currentTimeMs: 7_500,
      playbackRate: 0.5,
      muted: true,
      showControls: false,
      className: "watch-player",
    });
    const { container } = render(<ReplayPlayer {...callbacks} />);
    const video = screen.getByLabelText<HTMLVideoElement>("My tennis match");

    loadMetadata(video);

    expect(video.currentTime).toBe(7.5);
    expect(video.playbackRate).toBe(0.5);
    expect(video.playsInline).toBe(true);
    expect(video.muted).toBe(true);
    expect(callbacks.onMetadata).toHaveBeenCalledWith({
      durationMs: 20_000,
      width: 1920,
      height: 1080,
    });
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("watch-player");
  });

  it("applies precise external seeks without seeking backward for echoed media updates", () => {
    const callbacks = props({ currentTimeMs: 5_000 });
    const { rerender } = render(<ReplayPlayer {...callbacks} />);
    const video = screen.getByLabelText<HTMLVideoElement>("My tennis match");
    loadMetadata(video);

    rerender(<ReplayPlayer {...callbacks} currentTimeMs={5_040} />);
    expect(video.currentTime).toBe(5.04);

    video.currentTime = 6;
    fireEvent.timeUpdate(video);
    video.currentTime = 6.05;
    rerender(<ReplayPlayer {...callbacks} currentTimeMs={6_000} />);
    expect(video.currentTime).toBe(6.05);
  });

  it("loops at the selected boundary using media time and restarts at native ended", () => {
    const callbacks = props({
      isPlaying: true,
      currentTimeMs: 4_000,
      loopRange: { startMs: 4_000, endMs: 8_000 },
    });
    render(<ReplayPlayer {...callbacks} />);
    const video = screen.getByLabelText<HTMLVideoElement>("My tennis match");
    const playSpy = vi.spyOn(video, "play");
    loadMetadata(video);

    video.currentTime = 8.1;
    fireEvent.timeUpdate(video);
    expect(video.currentTime).toBe(4);
    expect(callbacks.onTimeUpdate).toHaveBeenLastCalledWith(4_000);

    video.currentTime = 20;
    Object.defineProperty(video, "ended", { value: true, configurable: true });
    fireEvent.pause(video);
    fireEvent.ended(video);
    expect(video.currentTime).toBe(4);
    expect(callbacks.onPlayStateChange).not.toHaveBeenCalledWith(false);
    expect(playSpy).toHaveBeenCalled();
  });

  it("stops at the end without a valid loop and clamps invalid requested times", () => {
    const callbacks = props({
      isPlaying: true,
      currentTimeMs: Number.NaN,
      loopRange: { startMs: 9_000, endMs: 4_000 },
    });
    render(<ReplayPlayer {...callbacks} />);
    const video = screen.getByLabelText<HTMLVideoElement>("My tennis match");
    loadMetadata(video);
    expect(video.currentTime).toBe(0);

    video.currentTime = 20;
    fireEvent.ended(video);
    expect(callbacks.onTimeUpdate).toHaveBeenLastCalledWith(20_000);
    expect(callbacks.onPlayStateChange).toHaveBeenCalledWith(false);
  });

  it("loads a new asset at its requested position and updates speed", () => {
    const callbacks = props({ currentTimeMs: 5_000 });
    const { rerender } = render(<ReplayPlayer {...callbacks} />);
    const previousVideo =
      screen.getByLabelText<HTMLVideoElement>("My tennis match");
    loadMetadata(previousVideo);

    rerender(
      <ReplayPlayer
        {...callbacks}
        assetUrl="blob:match-two"
        currentTimeMs={30_000}
        playbackRate={1.5}
      />,
    );
    const video = screen.getByLabelText<HTMLVideoElement>("My tennis match");
    expect(video).not.toBe(previousVideo);
    loadMetadata(video, 12);
    expect(video.currentTime).toBe(12);
    expect(video.playbackRate).toBe(1.5);
    expect(callbacks.onTimeUpdate).toHaveBeenLastCalledWith(12_000);
  });
});
