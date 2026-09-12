export async function shareFile(uri: string, name: string, _mime: string) {
  void _mime;
  const blob = await (await fetch(uri)).blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function shareTextFile(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  try {
    await shareFile(url, name, mime);
  } finally {
    URL.revokeObjectURL(url);
  }
}
