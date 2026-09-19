import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";

export const sampleVideo = fileURLToPath(
  new URL(
    "../../apps/replay-web/public/assets/tennis-demo.mp4",
    import.meta.url,
  ),
);

export async function waitForVideo(page: Page) {
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.duration))
    .toBeGreaterThan(4);
  return video;
}

export async function openSample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample", exact: true }).click();
  await expect(page).toHaveURL(/\/watch\/[^/]+$/);
  return waitForVideo(page);
}

export async function chooseFile(page: Page, button: Locator, path: string) {
  const chooserPromise = page.waitForEvent("filechooser");
  await button.click();
  await (await chooserPromise).setFiles(path);
}

export async function saveMoment(
  page: Page,
  name: string,
  start = 2,
  end = 4,
  notes = "Watch my recovery after the return.",
) {
  await page.getByRole("button", { name: "Save moment", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save a moment" });
  await dialog.getByLabel("Moment name", { exact: true }).fill(name);
  await dialog
    .getByLabel("Start (seconds)", { exact: true })
    .fill(String(start));
  await dialog.getByLabel("End (seconds)", { exact: true }).fill(String(end));
  await dialog
    .getByRole("textbox", { name: "What did you notice?", exact: true })
    .fill(notes);
  await dialog
    .getByRole("button", { name: "Save moment", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

export async function seekTo(page: Page, seconds: number) {
  const video = page.locator("video");
  const duration = await video.evaluate(
    (element: HTMLVideoElement) => element.duration,
  );
  const position = page.getByRole("slider", { name: "Playback position" });
  const maximum = Number(await position.getAttribute("max"));
  const step = Number(await position.getAttribute("step")) || 1;
  // Match the native range's units while testing the resulting media time.
  await position.fill(
    String(Math.round(((seconds / duration) * maximum) / step) * step),
  );
  await expect
    .poll(async () =>
      Math.abs(
        (await video.evaluate(
          (element: HTMLVideoElement) => element.currentTime,
        )) - seconds,
      ),
    )
    .toBeLessThan(0.2);
}

export async function waitForEvidence(page: Page) {
  await expect(
    page.getByRole("button", { name: "Open match", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images: HTMLImageElement[]) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
}
