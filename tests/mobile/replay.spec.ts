import { expect, test } from "@playwright/test";
import path from "node:path";

test("plays, saves a bounded moment, persists edits and restores a deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.currentTime),
    )
    .toBeGreaterThan(0.3);
  await page
    .getByRole("button", { name: "Playback speed 1×", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.playbackRate),
    )
    .toBe(0.5);
  await page
    .getByRole("button", { name: "Save a moment", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.paused),
    )
    .toBe(true);
  await page
    .getByRole("textbox", { name: "Moment name" })
    .fill("Contact point");
  await page
    .getByRole("textbox", { name: "Moment note" })
    .fill("Keep the head still.");
  await page.getByRole("button", { name: "Tag Backhand", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep this moment", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Contact point", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Play Contact point", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page
          .locator("video")
          .first()
          .evaluate((v) => v.paused),
      { timeout: 9000 },
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.currentTime),
    )
    .toBeGreaterThan(2);
  expect(
    await page
      .locator("video")
      .first()
      .evaluate((v) => v.currentTime),
  ).toBeLessThan(5);
  await page
    .getByRole("button", { name: "Edit Contact point", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Moment note" })).toHaveValue(
    "Keep the head still.",
  );
  await page
    .getByRole("button", { name: "Delete moment", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel editing", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play Contact point", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("imports and retains media, renames a session, exports composition and notes", async ({
  page,
}) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import a video", exact: true })
    .click();
  await (
    await chooser
  ).setFiles(path.resolve("apps/replay-mobile/assets/tennis-demo.mp4"));
  await expect(page.getByText("ON YOUR DEVICE", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.currentTime),
    )
    .toBeGreaterThan(0.3);
  await page
    .getByRole("button", { name: "Session details", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Session name" })
    .fill("Sunday practice");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  await expect(
    page.getByText("Sunday practice", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Share session", exact: true })
    .click();
  const composition = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export HyperFrames composition",
      exact: true,
    })
    .click();
  expect((await composition).suggestedFilename()).toBe(
    "clubhall-composition.html",
  );
  const notes = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export moment notes", exact: true })
    .click();
  expect((await notes).suggestedFilename()).toBe("clubhall-moments.json");
  await page
    .getByRole("button", { name: "Close sharing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open collection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Sunday practice", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Baseline practice", exact: true })
    .click();
  await expect(page.getByText("DEMO SESSION", { exact: true })).toBeVisible();
});
