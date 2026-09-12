import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export async function shareFile(uri: string, _name: string, mime: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  await Sharing.shareAsync(uri, {
    mimeType: mime,
    dialogTitle: "Share from ClubHall Replay",
  });
}
export async function shareTextFile(text: string, name: string, mime: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await shareFile(file.uri, name, mime);
}
