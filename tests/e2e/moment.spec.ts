import { expect, test } from "@playwright/test";
import {
  openSample,
  saveMoment,
  waitForVideo,
  waitForEvidence,
} from "./replay-helpers";

test.use({ viewport: { width: 1536, height: 1024 }, video: "on" });

test("a saved moment loops its chosen range and survives a reload with its note", async ({
  page,
}, testInfo) => {
  const video = await openSample(page);
  await saveMoment(page, "Recovery return");
  const moment = page.getByRole("button", {
    name: "Watch Recovery return",
    exact: true,
  });
  await expect(moment).toBeVisible();
  await moment.click();
  await expect
    .poll(async () =>
      Math.abs(
        (await video.evaluate(
          (element: HTMLVideoElement) => element.currentTime,
        )) - 2,
      ),
    )
    .toBeLessThan(0.2);

  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.seeking))
    .toBe(false);
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThan(1);
  await waitForEvidence(page);
  await page.screenshot({
    path: testInfo.outputPath("saved-moment-desktop.png"),
  });

  const loop = page.getByRole("button", { name: "Loop moment", exact: true });
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  // Observe native media events: toggling a button alone cannot prove a range loops.
  const loopSamples = await video.evaluate(
    (element: HTMLVideoElement) =>
      new Promise<number[]>((resolve, reject) => {
        const samples: number[] = [];
        let previous = element.currentTime;
        const cleanup = () => {
          element.removeEventListener("timeupdate", record);
          clearTimeout(timeout);
        };
        const record = () => {
          const current = element.currentTime;
          samples.push(current);
          if (previous > 3.4 && current < 2.4) {
            cleanup();
            resolve(samples);
          }
          previous = current;
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `The selected range did not repeat. Observed media times: ${samples.join(", ")}`,
            ),
          );
        }, 8_000);
        element.addEventListener("timeupdate", record);
      }),
  );
  expect(Math.min(...loopSamples)).toBeGreaterThanOrEqual(1.95);
  expect(Math.max(...loopSamples)).toBeLessThan(4.35);
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await page.reload();
  await waitForVideo(page);
  await expect(moment).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Recovery return", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit moment" });
  await expect
    .poll(async () =>
      Number(
        await dialog
          .getByLabel("Start (seconds)", { exact: true })
          .inputValue(),
      ),
    )
    .toBe(2);
  await expect
    .poll(async () =>
      Number(
        await dialog.getByLabel("End (seconds)", { exact: true }).inputValue(),
      ),
    )
    .toBe(4);
  await expect(
    dialog.getByRole("textbox", { name: "What did you notice?", exact: true }),
  ).toHaveValue("Watch my recovery after the return.");
  await dialog
    .getByLabel("Moment name", { exact: true })
    .fill("Recover toward the centre");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Watch Recover toward the centre",
      exact: true,
    }),
  ).toBeVisible();
  await expect(moment).toHaveCount(0);
});
