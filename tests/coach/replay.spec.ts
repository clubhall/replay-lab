import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const source = resolve("tests/coach/generated/source.mp4");
const ffmpeg = resolve("apps/replay-coach/node_modules/ffmpeg-static/ffmpeg");
const execute = promisify(execFile);
const videoTime = (page: Page) =>
  page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);

async function expectSaved(page: Page) {
  await expect(page.locator("footer [role=status]")).toHaveText(
    "Sessão salva neste navegador",
  );
}

async function storedMediaMetadata(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("clubhall-coach-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = (store: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = database
          .transaction(store, "readonly")
          .objectStore(store)
          .getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
    const [media, sessions] = await Promise.all([
      read("media"),
      read("sessions"),
    ]);
    database.close();
    const hashes = sessions.map(
      (s) => (s as { fingerprint?: string }).fingerprint,
    );
    return media.map((raw) => {
      const record = raw as {
        blob?: Blob;
        fingerprint?: string;
        opfsName?: string;
      };
      return {
        recordTag: Object.prototype.toString.call(record),
        hasFingerprint: typeof record.fingerprint === "string",
        hasOpfsName: typeof record.opfsName === "string",
        matchesSessionFingerprint: hashes.includes(record.fingerprint),
        blobTag: Object.prototype.toString.call(record.blob),
        constructor: record.blob?.constructor.name,
        isBlob: record.blob instanceof Blob,
        isFile: record.blob instanceof File,
        size: record.blob?.size,
        mimeType: record.blob?.type,
      };
    });
  });
}

async function needsExplicitRelink(page: Page, testInfo: TestInfo) {
  const missing =
    testInfo.project.name === "coach-mobile" &&
    (await storedMediaMetadata(page)).length === 0;
  if (missing) {
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "O navegador não guardou o vídeo" }),
    ).toBeVisible();
    testInfo.annotations.push({
      type: "runtime-limitation",
      description:
        "WebKit2248 emulation rejects IndexedDB Blob/File with UnknownError and OPFS getDirectory with UnknownError. Verified explicit relinking; durable media storage and physical Safari are not validated.",
    });
  }
  return missing;
}

async function restoreMedia(page: Page, explicitRelink: boolean) {
  if (explicitRelink) {
    await expect(
      page.getByRole("heading", { name: "Reconecte seu vídeo." }),
    ).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    await page
      .getByLabel("Reconectar original", { exact: true })
      .setInputFiles(source);
  }
  await expect(page.locator("video")).toBeVisible();
}

test("OPFS streaming fallback survives reload when IndexedDB Blob storage fails", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "coach-desktop",
    "This WebKit runtime rejects OPFS getDirectory; mobile explicit relinking is covered separately.",
  );
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (
        value &&
        typeof value === "object" &&
        "blob" in value &&
        value.blob instanceof Blob
      ) {
        throw new DOMException(
          "Test-injected Blob storage failure",
          "DataCloneError",
        );
      }
      return original.call(this, value, key);
    };
  });
  await page.goto("/");
  await page.getByTestId("import-video").setInputFiles(source);
  await expect(page.locator("video")).toBeVisible();
  await expectSaved(page);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "O navegador não guardou o vídeo" }),
  ).toHaveCount(0);
  expect(await storedMediaMetadata(page)).toEqual([
    expect.objectContaining({
      hasOpfsName: true,
      hasFingerprint: true,
      matchesSessionFingerprint: true,
      isBlob: false,
    }),
  ]);
  await page.reload();
  await page
    .locator(".collection")
    .getByRole("button", { name: "source.mp4", exact: true })
    .click();
  await restoreMedia(page, false);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.duration),
    )
    .toBeCloseTo(8, 0);
});

test("project import binds media to fingerprint and rejects wrong relinking", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByTestId("import-video").setInputFiles(source);
  await expect(page.locator("video")).toBeVisible();
  await expectSaved(page);
  const explicitRelink = await needsExplicitRelink(page, testInfo);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Salvar projeto JSON", exact: true })
    .click();
  const projectPath = testInfo.outputPath("original-project.json");
  await (await downloadPromise).saveAs(projectPath);
  const original = JSON.parse(await readFile(projectPath, "utf8")) as {
    id: string;
    fingerprint: string;
  };
  const before = await storedMediaMetadata(page);
  await page.reload();
  await page
    .locator(".collection")
    .getByRole("button", { name: "source.mp4", exact: true })
    .click();
  const after = await storedMediaMetadata(page);
  console.log(
    `${testInfo.project.name} IndexedDB metadata`,
    JSON.stringify({ before, after }),
  );
  await testInfo.attach("media-storage-metadata", {
    body: Buffer.from(JSON.stringify({ before, after }, null, 2)),
    contentType: "application/json",
  });

  await page.getByLabel("Importar projeto", { exact: true }).setInputFiles({
    name: "mismatched-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...original,
        name: "Mismatched fixture project",
        fingerprint: "0".repeat(64),
      }),
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Reconecte seu vídeo." }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(
    page
      .locator(".collection")
      .getByRole("button", { name: "Mismatched fixture project", exact: true }),
  ).toHaveClass(/selected/);
  await page
    .getByLabel("Reconectar original", { exact: true })
    .setInputFiles(source);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Este arquivo não corresponde ao original." }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);

  await page.getByLabel("Importar projeto", { exact: true }).setInputFiles({
    name: "restored-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(
    page
      .locator(".collection")
      .getByRole("button", { name: "source.mp4", exact: true }),
  ).toHaveClass(/selected/);
  await expect
    .poll(() =>
      page.evaluate(async (expected) => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("clubhall-coach-v1", 1);
          r.onsuccess = () => resolve(r.result);
        });
        const hashes = await new Promise<string[]>((resolve) => {
          const r = db
            .transaction("sessions", "readonly")
            .objectStore("sessions")
            .getAll();
          r.onsuccess = () =>
            resolve(
              (r.result as Array<{ fingerprint: string }>).map(
                (s) => s.fingerprint,
              ),
            );
        });
        db.close();
        return hashes.includes(expected);
      }, original.fingerprint),
    )
    .toBe(true);
  await restoreMedia(page, explicitRelink);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.duration),
    )
    .toBeCloseTo(8, 0);
});

test("real media replay, confirmed points, stable XP, persistence and playable export", async ({
  page,
  browser,
}, testInfo) => {
  await testInfo.attach("browser-runtime", {
    body: Buffer.from(
      JSON.stringify(
        {
          project: testInfo.project.name,
          browserVersion: browser.version(),
          executableOverride:
            testInfo.project.name === "coach-mobile"
              ? (process.env.COACH_WEBKIT_PATH ?? null)
              : (process.env.COACH_CHROMIUM_PATH ?? null),
          physicalDevice: false,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByTestId("import-video").setInputFiles(source);
  await expect(page.locator("video")).toBeVisible();
  const explicitRelink = await needsExplicitRelink(page, testInfo);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.duration),
    )
    .toBeCloseTo(8, 0);
  await page
    .getByPlaceholder("Ex.: Arthur, camiseta branca")
    .fill("Arthur · synthetic test fixture");
  await page
    .getByRole("checkbox", { name: "Estou anotando todos os pontos desde 0–0" })
    .check();
  await page.getByLabel("Contatos no rally (se conferidos)").fill("8");
  await page.getByRole("button", { name: "Eu ganhei o ponto" }).click();
  const xp = page
    .locator(".stat")
    .filter({ hasText: "XP confirmado nesta sessão" })
    .locator("strong");
  await expect(xp).toHaveText("40");
  await expect(page.locator(".score-row strong")).toHaveText(["15", "0"]);
  // Reconfirming the same interval cannot produce another point or reward.
  await page.getByRole("button", { name: "Eu ganhei o ponto" }).click();
  await expect(page.locator(".moment")).toHaveCount(1);
  await expect(xp).toHaveText("40");
  // A separately confirmed point without rally evidence must not invent a reward.
  await page.getByLabel("Fim (s)", { exact: true }).fill("7");
  await page.getByLabel("Início (s)", { exact: true }).fill("5");
  await page.getByLabel("Contatos no rally (se conferidos)").fill("");
  await page
    .getByRole("button", { name: "Ponto do adversário", exact: true })
    .click();
  await expect(page.locator(".score-row strong")).toHaveText(["15", "15"]);
  await expect(page.locator(".moment")).toHaveCount(2);
  await expect(xp).toHaveText("40");
  // Human correction revokes the old reward; restoring evidence grants it once.
  await page.getByLabel("Contatos do ponto 1", { exact: true }).fill("3");
  await page.getByLabel("Contatos do ponto 1", { exact: true }).blur();
  await expect(xp).toHaveText("0");
  await page.getByLabel("Contatos do ponto 1", { exact: true }).fill("8");
  await page.getByLabel("Contatos do ponto 1", { exact: true }).blur();
  await expect(xp).toHaveText("40");

  const scrubber = page.getByRole("slider", { name: "Posição do vídeo" });
  await scrubber.focus();
  await scrubber.press("End");
  await expect.poll(() => videoTime(page)).toBeGreaterThan(7.5);
  await page
    .locator(".moment")
    .first()
    .getByRole("button", { name: /PONTO 01/ })
    .click();
  await expect.poll(() => videoTime(page)).toBeLessThan(0.1);
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.playbackRate),
    )
    .toBe(0.5);
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.getByLabel("Início (s)", { exact: true }).fill("1");
  await page.getByLabel("Fim (s)", { exact: true }).fill("3");
  await page.getByRole("button", { name: "↻ Loop", exact: true }).click();
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect
    .poll(() => videoTime(page), { intervals: [100] })
    .toBeGreaterThan(2.5);
  await expect
    .poll(() => videoTime(page), { intervals: [100] })
    .toBeLessThan(1.5);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.getByRole("button", { name: "↻ Loop", exact: true }).click();
  await expect(xp).toHaveText("40");

  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar evidências", exact: true })
    .click();
  await expect(page.locator(".coach-note")).toContainText(
    "Ainda não há evidência corporal real",
  );
  await expect(page.locator(".pose-layer line")).toHaveCount(0);
  await page.getByRole("button", { name: "Momento", exact: true }).click();
  await expectSaved(page);

  await page.reload();
  await page
    .locator(".collection")
    .getByRole("button", { name: "source.mp4", exact: true })
    .click();
  await restoreMedia(page, explicitRelink);
  await expect(
    page.getByPlaceholder("Ex.: Arthur, camiseta branca"),
  ).toHaveValue("Arthur · synthetic test fixture");
  await expect(page.locator(".moment")).toHaveCount(2);
  await expect(page.locator(".score-row strong")).toHaveText(["15", "15"]);
  await expect(xp).toHaveText("40");
  await expect(page.getByLabel("Início (s)", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Fim (s)", { exact: true })).toHaveValue("3");

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar corte MP4" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("replay-1000-3000.mp4");
  const clip = testInfo.outputPath("exported.mp4");
  await download.saveAs(clip);
  expect(await download.failure()).toBeNull();

  // Decode the exported streams independently, including the generated sine audio.
  const decoded = await execute(
    ffmpeg,
    [
      "-hide_banner",
      "-i",
      clip,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-f",
      "null",
      "-",
    ],
    { timeout: 20_000 },
  );
  expect(decoded.stderr).toMatch(/Video: h264/);
  expect(decoded.stderr).toMatch(/Audio: aac/);
  expect(decoded.stderr).toMatch(/Duration: 00:00:02\./);

  // Re-import the actual downloaded file so browser decode/playback is exercised too.
  await page.getByTestId("import-video").setInputFiles(clip);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.duration),
    )
    .toBeCloseTo(2, 0);
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect.poll(() => videoTime(page)).toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  // Return to the evidence-bearing session for the review artifact.
  await page
    .locator(".collection")
    .getByRole("button", { name: "source.mp4", exact: true })
    .click();
  await restoreMedia(page, explicitRelink);
  await page.getByRole("button", { name: "Momento", exact: true }).click();
  await expect(xp).toHaveText("40");
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect.poll(() => videoTime(page)).toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  const closeNotice = page.getByRole("button", { name: "Fechar aviso" });
  if (await closeNotice.count()) await closeNotice.click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await mkdir(resolve("test-results"), { recursive: true });
  await page.screenshot({
    path: resolve(`test-results/${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("local export rejects malformed origins, out-of-range cuts and playlist indirection", async ({
  request,
}) => {
  const video = await readFile(source);
  const outside = await request.post("/api/coach/export?start=20&end=21", {
    headers: { "Content-Type": "video/mp4" },
    data: video,
  });
  expect(outside.status()).toBe(400);
  expect(outside.headers()["content-type"]).toContain("application/json");
  for (const origin of ["null", "not a URL", "https://untrusted.example"]) {
    const denied = await request.post("/api/coach/export?start=0&end=1", {
      headers: { Origin: origin },
      data: "not media",
    });
    expect(denied.status()).toBe(403);
  }
  const playlist = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:8",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXTINF:8.0,",
    pathToFileURL(source).href,
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
  const indirect = await request.post("/api/coach/export?start=0&end=1", {
    headers: { "Content-Type": "application/vnd.apple.mpegurl" },
    data: playlist,
  });
  expect(indirect.status()).toBe(400);
  expect(indirect.headers()["content-type"]).toContain("application/json");
  // Rejections leave the server available for subsequent work.
  expect((await request.get("/")).status()).toBe(200);
});
