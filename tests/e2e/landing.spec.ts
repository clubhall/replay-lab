import { waitForEvidence } from "./replay-helpers";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1536, height: 1024 } });

test("landing page offers a real match import and a playable sample", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your match, reimagined." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a video", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Try a sample", exact: true }),
  ).toBeEnabled();
  await waitForEvidence(page);
  await page.screenshot({ path: testInfo.outputPath("landing-desktop.png") });
});
