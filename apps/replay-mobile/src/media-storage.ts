import { File, Paths, Directory } from "expo-file-system";

export async function saveMedia(id: string, uri: string) {
  const directory = new Directory(Paths.document, "replays");
  directory.create({ intermediates: true, idempotent: true });
  const extension = uri.split("?")[0].split(".").pop();
  const file = new File(
    directory,
    `${id}.${extension && /^[a-z0-9]{2,5}$/i.test(extension) ? extension : "mp4"}`,
  );
  await new File(uri).copy(file);
  return file.uri;
}
export function resolveMedia(_id: string, uri: string) {
  return Promise.resolve(new File(uri).exists ? uri : null);
}
export function removeMedia(_id: string, uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
  return Promise.resolve();
}
