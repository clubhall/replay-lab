import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  sampleVideo,
  openSample,
  saveMoment,
  seekTo,
  waitForVideo,
  waitForEvidence,
  chooseFile,
} from "./replay-helpers";

test.use({ viewport: { width: 1536, height: 1024 } });

test("sample playback advances, pauses, seeks, and changes speed", async ({
  page,
}) => {
  const video = await openSample(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0.4);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);

  await seekTo(page, 3);
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("0.5");
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.playbackRate),
    )
    .toBe(0.5);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(3.3);
});

test("an imported local match can be relinked after reload without losing its moments", async ({
  page,
}) => {
  // Exercise the supported file-relink path on browsers without OPFS.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {},
    });
  });
  await page.goto("/");
  await chooseFile(
    page,
    page.getByRole("button", { name: "Choose a video", exact: true }),
    sampleVideo,
  );
  await expect(page).toHaveURL(/\/watch\/[^/]+$/);
  await waitForVideo(page);
  await saveMoment(page, "Keep this return");

  await page.reload();
  const relink = page.getByRole("button", {
    name: "Relink original video",
    exact: true,
  });
  await expect(relink).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Watch Keep this return",
      exact: true,
    }),
  ).toBeVisible();

  const wrongChooserPromise = page.waitForEvent("filechooser");
  await relink.click();
  await (
    await wrongChooserPromise
  ).setFiles({
    name: "different-match.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.concat([
      await readFile(sampleVideo),
      Buffer.from("different match"),
    ]),
  });
  await expect(page.getByRole("alert")).toContainText(/does not match/i);

  await chooseFile(page, relink, sampleVideo);
  const video = await waitForVideo(page);
  await page
    .getByRole("button", { name: "Watch Keep this return", exact: true })
    .click();
  await expect
    .poll(async () =>
      Math.abs(
        (await video.evaluate(
          (element: HTMLVideoElement) => element.currentTime,
        )) - 2,
      ),
    )
    .toBeLessThan(0.2);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(2.3);
  await expect(
    page.getByRole("button", {
      name: "Watch Keep this return",
      exact: true,
    }),
  ).toBeVisible();
});

test("a practice review persists and exports its time range, note, and source fingerprint", async ({
  page,
}) => {
  const video = await openSample(page);
  await saveMoment(
    page,
    "A return to practise",
    1,
    3,
    "Recover toward the centre before the next shot.",
  );
  await page
    .getByRole("button", { name: "Review in slow motion", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Playback speed" }),
  ).toHaveValue("0.5");
  await expect(
    page.getByRole("button", { name: "Loop moment", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(1.2);
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reviewed", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Watch A return to practise",
      exact: true,
    }),
  ).toContainText("Reviewed");

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export replay", exact: true })
    .click();
  const download = await downloadPromise;
  await expect(download.failure()).resolves.toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.clubhall-replay\.json$/);
  const path = await download.path();
  if (!path) {
    throw new Error("The replay export did not produce a readable file.");
  }
  const exported: unknown = JSON.parse(await readFile(path, "utf8"));
  expect(exported).toMatchObject({
    version: "clubhall-replay/v1",
    assetFingerprint: createHash("sha256")
      .update(await readFile(sampleVideo))
      .digest("hex"),
    segments: expect.arrayContaining([
      expect.objectContaining({
        label: "A return to practise",
        startMs: 1000,
        endMs: 3000,
        notes: "Recover toward the centre before the next shot.",
        tags: expect.arrayContaining(["reviewed"]),
      }),
    ]),
  });
});

test("a phone viewport supports moment capture with reduced motion and no horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const video = await openSample(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  await saveMoment(page, "A moment from my phone");
  await expect(
    page.getByRole("button", {
      name: "Watch A moment from my phone",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return (
              animation.playState === "running" &&
              timing?.iterations === Infinity &&
              Number(timing.duration) > 1
            );
          }).length,
      ),
    )
    .toBe(0);
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThan(1);
  await waitForEvidence(page);
  await page.screenshot({
    path: testInfo.outputPath("saved-moment-mobile.png"),
    fullPage: true,
  });
});
