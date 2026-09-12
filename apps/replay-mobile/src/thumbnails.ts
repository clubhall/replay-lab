import type { VideoPlayer } from "expo-video";
export async function thumbnails(
  player: VideoPlayer,
  _uri: string,
  times: number[],
) {
  return player.generateThumbnailsAsync(times, { maxWidth: 320 });
}
