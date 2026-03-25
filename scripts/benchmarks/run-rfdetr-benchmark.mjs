import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const fixturesDir = path.join(repoRoot, "fixtures");
const outputDir = path.join(fixturesDir, "output");
const manifestPath = path.join(fixturesDir, "manifest.json");
const serviceUrl = (process.env.CLUBHALL_RFDETR_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

await mkdir(outputDir, { recursive: true });

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const health = await fetchJson(`${serviceUrl}/api/v1/health`);
const summary = {
  version: manifest.version,
  generatedAt: new Date().toISOString(),
  serviceUrl,
  runtime: health.runtime,
  runnerReadiness: health.runtime.mode,
  clips: []
};

for (const clip of manifest.clips) {
  const assetPath = path.resolve(repoRoot, clip.assetPath);
  if (!(await fileExists(assetPath))) {
    summary.clips.push({
      id: clip.id,
      status: "skipped",
      reason: `Missing asset at ${assetPath}`
    });
    continue;
  }

  const buffer = await readFile(assetPath);
  const uploadForm = new FormData();
  uploadForm.append("file", new Blob([buffer], { type: "video/mp4" }), path.basename(assetPath));
  const asset = await fetchJson(`${serviceUrl}/api/v1/assets`, {
    method: "POST",
    body: uploadForm
  });

  const created = await fetchJson(`${serviceUrl}/api/v1/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "v1",
      engineId: "rfdetr",
      sessionId: `benchmark_${clip.id}`,
      assetId: asset.id,
      timeRangeMs: [clip.startMs, clip.endMs],
      options: {
        mode: process.env.CLUBHALL_RFDETR_REQUEST_MODE ?? "auto",
        classes: clip.expectations.classes,
        exclusionZones: clip.exclusionZones ?? [],
        benchmarkClipId: clip.id
      }
    })
  });

  const completed = await pollRun(created.run.id);
  const outputPath = path.join(outputDir, `${clip.id}.engine-output.json`);
  await writeFile(outputPath, JSON.stringify(completed.output ?? {}, null, 2));

  summary.clips.push({
    id: clip.id,
    status: completed.run.status,
    outputPath: path.relative(repoRoot, outputPath),
    requestedMode: process.env.CLUBHALL_RFDETR_REQUEST_MODE ?? "auto",
    actualMode: completed.run.diagnostics?.runtimeMode ?? "skipped",
    runtimeLabel: completed.output?.raw?.runtimeLabel ?? completed.run.engineVersion ?? health.runtime.label,
    runnerReadiness: health.runtime.mode,
    fixtureFallbackUsed: completed.run.diagnostics?.runtimeMode === "fixture-fallback",
    diagnostics: completed.run.diagnostics ?? {},
    warnings: completed.run.diagnostics?.warnings ?? [],
    trackCount: completed.output?.tracks?.length ?? 0,
    insightCount: completed.output?.insights?.length ?? 0,
    detectionCount: completed.run.diagnostics?.detectionCount ?? 0
  });
}

const summaryPath = path.join(outputDir, "benchmark-summary.json");
await writeFile(summaryPath, JSON.stringify(summary, null, 2));
console.log(`Wrote benchmark summary to ${summaryPath}`);

async function pollRun(runId) {
  while (true) {
    const response = await fetchJson(`${serviceUrl}/api/v1/runs/${runId}`);
    if (response.run.status === "completed" || response.run.status === "failed") {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return response.json();
}

async function fileExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}
