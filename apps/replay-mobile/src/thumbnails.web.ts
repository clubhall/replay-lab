import type { VideoPlayer } from "expo-video";
export async function thumbnails(
  _player: VideoPlayer,
  uri: string,
  times: number[],
): Promise<string[]> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  const wait = (event: string) =>
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener(event, done);
        video.removeEventListener("error", fail);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const fail = () => {
        cleanup();
        reject(new Error("Thumbnail unavailable"));
      };
      const timer = setTimeout(fail, 12000);
      video.addEventListener(event, done, { once: true });
      video.addEventListener("error", fail, { once: true });
    });
  try {
    const loaded = wait("loadeddata");
    video.src = uri;
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");
    if (!context) return [];
    const images: string[] = [];
    for (const time of times) {
      const target = Math.max(0.02, Math.min(time, video.duration - 0.03));
      if (Math.abs(target - video.currentTime) > 0.001) {
        const seeked = wait("seeked");
        video.currentTime = target;
        await seeked;
      }
      context.drawImage(video, 0, 0, 320, 180);
      images.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return images;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
