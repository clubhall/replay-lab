// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureVideoThumbnail } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockCanvas() {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,thumbnail",
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  return drawImage;
}

describe("captureVideoThumbnail", () => {
  it("waits for the first decoded frame without seeking to zero", async () => {
    const drawImage = mockCanvas();
    const seek = vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set");
    const load = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(function (this: HTMLMediaElement) {
        if (!this.hasAttribute("src")) return;
        Object.defineProperty(this, "duration", {
          value: 10,
          configurable: true,
        });
        Object.defineProperty(this, "readyState", {
          value: 1,
          writable: true,
          configurable: true,
        });
        this.dispatchEvent(new Event("loadedmetadata"));
      });
    const pending = captureVideoThumbnail("blob:test", 0);
    const video = load.mock.contexts[0] as HTMLMediaElement;
    await Promise.resolve();
    expect(drawImage).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
    Object.defineProperty(video, "readyState", { value: 2 });
    video.dispatchEvent(new Event("loadeddata"));
    await expect(pending).resolves.toBe("data:image/jpeg;base64,thumbnail");
    expect(drawImage).toHaveBeenCalledOnce();
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("registers the seek listener before changing playback position", async () => {
    mockCanvas();
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      if (!this.hasAttribute("src")) return;
      Object.defineProperty(this, "duration", {
        value: 10,
        configurable: true,
      });
      Object.defineProperty(this, "readyState", {
        value: 2,
        configurable: true,
      });
      this.dispatchEvent(new Event("loadedmetadata"));
    });
    const seek = vi
      .spyOn(HTMLMediaElement.prototype, "currentTime", "set")
      .mockImplementation(function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event("seeked"));
      });
    await expect(captureVideoThumbnail("blob:test", 4000)).resolves.toBe(
      "data:image/jpeg;base64,thumbnail",
    );
    expect(seek).toHaveBeenCalledWith(4);
  });

  it("times out a stalled video and releases its source", async () => {
    vi.useFakeTimers();
    mockCanvas();
    const load = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});
    const pending = expect(
      captureVideoThumbnail("blob:stalled", 4000),
    ).rejects.toThrow("Timed out while waiting for loadedmetadata");
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    const video = load.mock.contexts[0] as HTMLMediaElement;
    expect(video.hasAttribute("src")).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
