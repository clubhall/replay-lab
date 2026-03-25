import { expect, test } from "@playwright/test";

test("landing page shows the primary replay CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Replay operating layer/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Match Video/i })).toBeVisible();
});
