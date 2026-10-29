import { expect, test, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(
  new URL("../../apps/replay-coach/package.json", import.meta.url),
);
const execute = promisify(execFile);
const source = resolve("tests/coach/generated/source.mp4");
const second = resolve("tests/coach/generated/comparison-second.mp4");
const time = (page: Page, side: string) =>
  page
    .getByTestId(`compare-${side}`)
    .evaluate((video: HTMLVideoElement) => video.currentTime);
const offset = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector<HTMLVideoElement>(
      '[data-testid="compare-a"]',
    );
    const b = document.querySelector<HTMLVideoElement>(
      '[data-testid="compare-b"]',
    );
    return b!.currentTime - a!.currentTime;
  });
test.beforeAll(async () => {
  await execute(require("ffmpeg-static") as string, [
    "-y",
    "-i",
    source,
    "-c",
    "copy",
    "-metadata",
    "title=Independent synthetic comparison source",
    second,
  ]);
});
test("two actual local videos stay reference-aligned through pause, resume, end and reload", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "coach-desktop",
    "Local browser media storage; physical iPhone remains a separate gate.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByTestId("import-video").setInputFiles([source, second]);
  await expect(page.locator(".collection button")).toHaveCount(2);
  await expect(page.getByText(/Lote processado: 2 disponíveis/)).toBeVisible();
  await page
    .getByLabel("Vídeo A", { exact: true })
    .selectOption({ label: "source.mp4" });
  await page
    .getByLabel("Vídeo B", { exact: true })
    .selectOption({ label: "comparison-second.mp4" });
  await expect(page.getByTestId("compare-a")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reproduzir comparação", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Referência A (s)", { exact: true }).fill("1");
  await page.getByLabel("Referência B (s)", { exact: true }).fill("3");
  await expect(page.getByTestId("comparison-coverage")).toContainText(
    "cobertura comum 6.00 s",
  );
  await expect(page.getByTestId("comparison-coverage")).toContainText(
    "deslocamento B − A: 2.00 s",
  );
  await page
    .getByRole("button", { name: "Ir às referências", exact: true })
    .click();
  await expect.poll(() => time(page, "a")).toBeCloseTo(1, 1);
  await expect.poll(() => time(page, "b")).toBeCloseTo(3, 1);
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await expect.poll(() => time(page, "a")).toBeGreaterThan(1.3);
  await page
    .getByRole("button", { name: "Pausar comparação", exact: true })
    .click();
  const paused = await time(page, "a");
  await expect
    .poll(async () => Math.abs((await offset(page)) - 2))
    .toBeLessThan(0.1);
  await expect(page.getByTestId("compare-a")).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("compare-b")).toHaveJSProperty("paused", true);
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await expect.poll(() => time(page, "a")).toBeGreaterThan(paused + 0.2);
  await expect
    .poll(async () => Math.abs((await offset(page)) - 2))
    .toBeLessThan(0.1);
  await page
    .getByRole("button", { name: "Pausar comparação", exact: true })
    .click();
  const slider = page.getByRole("slider", {
    name: "Posição da comparação",
    exact: true,
  });
  await slider.focus();
  await slider.press("End");
  for (let i = 0; i < 20; i++) await slider.press("ArrowLeft");
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await expect(page.getByTestId("compare-a")).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("compare-b")).toHaveJSProperty("paused", true);
  await expect.poll(() => time(page, "a")).toBeCloseTo(6, 1);
  await expect.poll(() => time(page, "b")).toBeCloseTo(8, 1);
  await page.reload();
  await expect(
    page.getByLabel("Referência A (s)", { exact: true }),
  ).toHaveValue("1");
  await expect(
    page.getByLabel("Referência B (s)", { exact: true }),
  ).toHaveValue("3");
  await expect.poll(() => time(page, "a")).toBeCloseTo(6, 1);
  await expect
    .poll(async () => Math.abs((await offset(page)) - 2))
    .toBeLessThan(0.1);
  await page.getByLabel("Referência A (s)", { exact: true }).fill("99");
  await expect(page.getByRole("alert")).toContainText("dentro dos vídeos");
  await expect(
    page.getByRole("button", { name: "Reproduzir comparação", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Referência A (s)", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Ir às referências", exact: true })
    .click();
  await page
    .locator(".comparison-panel")
    .screenshot({ path: info.outputPath("comparison-aligned.png") });
  // Controlled browser seam: one native player can stall/reject its startup promise.
  await page.evaluate(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    const probe = { mode: "stall", release: () => Promise.resolve() };
    Object.assign(window, { comparisonStartProbe: probe });
    HTMLMediaElement.prototype.play = function () {
      if (this.dataset.testid === "compare-b") {
        if (probe.mode === "reject")
          return Promise.reject(
            new DOMException("Injected startup denial", "NotAllowedError"),
          );
        if (probe.mode === "stall")
          return new Promise<void>((resolve, reject) => {
            probe.release = () => nativePlay.call(this).then(resolve, reject);
          });
      }
      return nativePlay.call(this);
    };
  });
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar início da comparação", exact: true })
    .click();
  await expect(page.getByTestId("compare-a")).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("compare-b")).toHaveJSProperty("paused", true);
  await page.evaluate(() => {
    (
      window as unknown as { comparisonStartProbe: { mode: string } }
    ).comparisonStartProbe.mode = "normal";
  });
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  // Late fulfillment from the cancelled run must not stop or overwrite this retry.
  await page.evaluate(() =>
    (
      window as unknown as {
        comparisonStartProbe: { release: () => Promise<void> };
      }
    ).comparisonStartProbe.release(),
  );
  const retryStart = await time(page, "a");
  await expect.poll(() => time(page, "a")).toBeGreaterThan(retryStart + 0.2);
  await expect
    .poll(async () => Math.abs((await offset(page)) - 2))
    .toBeLessThan(0.1);
  await page
    .getByRole("button", { name: "Pausar comparação", exact: true })
    .click();
  for (const mode of ["reject", "stall"]) {
    await page.evaluate((mode) => {
      (
        window as unknown as { comparisonStartProbe: { mode: string } }
      ).comparisonStartProbe.mode = mode;
    }, mode);
    await page
      .getByRole("button", { name: "Reproduzir comparação", exact: true })
      .click();
    await expect(page.locator(".comparison-panel [role=status]")).toContainText(
      "não iniciou nos dois vídeos em até 2 s",
    );
    await expect(page.getByTestId("compare-a")).toHaveJSProperty(
      "paused",
      true,
    );
    await expect(page.getByTestId("compare-b")).toHaveJSProperty(
      "paused",
      true,
    );
  }
  await page.evaluate(() =>
    (
      window as unknown as {
        comparisonStartProbe: { release: () => Promise<void> };
      }
    ).comparisonStartProbe.release(),
  );
  await expect(page.getByTestId("compare-b")).toHaveJSProperty("paused", true);
  await page.evaluate(() => {
    (
      window as unknown as { comparisonStartProbe: { mode: string } }
    ).comparisonStartProbe.mode = "stall";
  });
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar início da comparação", exact: true })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as { comparisonStartProbe: { mode: string } }
    ).comparisonStartProbe.mode = "reject";
  });
  await page
    .getByRole("button", { name: "Reproduzir comparação", exact: true })
    .click();
  await expect(page.locator(".comparison-panel [role=status]")).toContainText(
    "não iniciou nos dois vídeos em até 2 s",
  );
  await page.evaluate(() =>
    (
      window as unknown as {
        comparisonStartProbe: { release: () => Promise<void> };
      }
    ).comparisonStartProbe.release(),
  );
  await expect(page.getByTestId("compare-a")).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("compare-b")).toHaveJSProperty("paused", true);
  // Change persisted input before mount; active page visibility handlers can save their own state.
  await page.evaluate(() =>
    sessionStorage.setItem("tamper-comparison-next-load", "1"),
  );
  await page.addInitScript(() => {
    if (sessionStorage.getItem("tamper-comparison-next-load") !== "1") return;
    const state = JSON.parse(
      localStorage.getItem("clubhall-comparison-v1")!,
    ) as { left: { fingerprint: string } };
    state.left.fingerprint = "0".repeat(64);
    localStorage.setItem("clubhall-comparison-v1", JSON.stringify(state));
    sessionStorage.removeItem("tamper-comparison-next-load");
  });
  await page.reload();
  await expect(page.locator(".comparison-panel [role=status]")).toContainText(
    "Sessão ou original indisponível",
  );
  await expect(page.getByTestId("compare-a")).toHaveCount(0);
  await page.getByLabel("Vídeo A", { exact: true }).selectOption("");
  await page
    .getByLabel("Vídeo A", { exact: true })
    .selectOption({ label: "source.mp4" });
  await expect(
    page.getByRole("button", { name: "Reproduzir comparação", exact: true }),
  ).toBeEnabled();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("clubhall-coach-v1", 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("media", "readwrite");
      tx.objectStore("media").clear();
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator(".comparison-panel [role=status]")).toContainText(
    "Reconecte o original",
  );
  await expect(
    page.getByRole("button", { name: "Reproduzir comparação", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("compare-a")).toHaveCount(0);
  expect(errors).toEqual([]);
});
