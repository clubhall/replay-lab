import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(
  new URL("../../apps/replay-coach/package.json", import.meta.url),
);
const ffmpeg = require("ffmpeg-static") as string;
const execute = promisify(execFile);
const files = Array.from({ length: 8 }, (_, i) =>
  resolve(`tests/coach/generated/batch-${i}.mp4`),
);
test.beforeAll(async () => {
  for (const [i, file] of files.entries())
    await execute(ffmpeg, [
      "-y",
      "-i",
      resolve("tests/coach/generated/source.mp4"),
      "-c",
      "copy",
      "-metadata",
      `title=Synthetic source ${i}`,
      file,
    ]);
});
test("eight-file batch, editable day groups, persistent selection and playable multiasset reel", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "coach-desktop",
    "Physical media storage/Safari validation remains a separate gate.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByTestId("import-video").setInputFiles(files);
  await expect(page.locator(".collection button")).toHaveCount(8);
  await expect(page.getByText(/Lote processado: 8 disponíveis/)).toBeVisible();
  await page.getByLabel("Grupo / sessão", { exact: true }).fill("Treino A");
  await page.getByLabel("Dia da gravação", { exact: true }).fill("2026-10-28");
  await page.getByLabel("Início (s)", { exact: true }).fill("1");
  await page.getByLabel("Fim (s)", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Adicionar intervalo atual ao reel" })
    .click();
  await page
    .locator(".collection")
    .getByRole("button", { name: "batch-0.mp4", exact: true })
    .click();
  await page.getByLabel("Grupo / sessão", { exact: true }).fill("Treino B");
  await page.getByLabel("Dia da gravação", { exact: true }).fill("2026-10-29");
  await page.getByLabel("Fim (s)", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Adicionar intervalo atual ao reel" })
    .click();
  await page.getByRole("button", { name: "Mover corte 2 para cima" }).click();
  await expect(page.locator(".reel-editor li strong")).toHaveText([
    "batch-0.mp4",
    "batch-7.mp4",
  ]);
  await page.getByLabel("Fim do corte 1 (s)", { exact: true }).fill("3");
  await page.reload();
  await expect(page.locator(".reel-editor li strong")).toHaveText([
    "batch-0.mp4",
    "batch-7.mp4",
  ]);
  await page
    .locator(".collection")
    .getByRole("button", { name: "batch-0.mp4", exact: true })
    .click();
  await expect(page.getByLabel("Dia da gravação", { exact: true })).toHaveValue(
    "2026-10-29",
  );
  await page.getByTestId("import-video").setInputFiles(files);
  await expect(page.getByText(/Lote processado: 8 disponíveis/)).toBeVisible();
  await expect(page.locator(".collection button")).toHaveCount(8);
  await expect(page.getByLabel("Grupo / sessão", { exact: true })).toHaveValue(
    "Treino B",
  );
  await page.getByRole("button", { name: "Analisar lote disponível" }).click();
  await expect(page.getByText(/Lote analisado: 8\/8/)).toBeVisible({
    timeout: 60_000,
  });
  await page
    .getByRole("button", { name: "Preparar prévia MP4 do reel" })
    .click();
  await expect(page.getByTestId("reel-preview")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() =>
      page
        .getByTestId("reel-preview")
        .evaluate((v: HTMLVideoElement) => v.duration),
    )
    .toBeCloseTo(5, 0);
  await page
    .getByTestId("reel-preview")
    .evaluate((v: HTMLVideoElement) => v.play());
  await expect
    .poll(() =>
      page
        .getByTestId("reel-preview")
        .evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0.2);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar reel MP4" }).click();
  await (await downloading).saveAs(info.outputPath("multiasset-reel.mp4"));
  await page.screenshot({
    path: info.outputPath("batch-reel.png"),
    fullPage: true,
  });
  // Missing media must fail the entire render, preserving selection and both cuts.
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
  await page
    .getByRole("button", { name: "Preparar prévia MP4 do reel" })
    .click();
  await expect(page.locator(".reel-editor [role=status]")).toContainText(
    "Reconecte o original",
  );
  await expect(page.getByTestId("reel-preview")).toHaveCount(0);
  await expect(page.locator(".reel-editor li")).toHaveCount(2);
  expect(errors).toEqual([]);
});
