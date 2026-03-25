import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const fixturesDir = path.join(repoRoot, "fixtures");
const outputDir = path.join(fixturesDir, "output");

await mkdir(outputDir, { recursive: true });

const manifest = JSON.parse(await readFile(path.join(fixturesDir, "manifest.json"), "utf8"));
const summary = JSON.parse(await readFile(path.join(outputDir, "benchmark-summary.json"), "utf8"));
const goldenExport = JSON.parse(await readFile(path.join(fixturesDir, "golden-path", "session-export.fixture.json"), "utf8"));

const lines = [
  "# Benchmark Report",
  "",
  `Generated: ${summary.generatedAt}`,
  `Runtime: ${summary.runtime.label}`,
  ""
];

for (const clip of manifest.clips) {
  const run = summary.clips.find((entry) => entry.id === clip.id);
  if (!run || run.status === "skipped") {
    lines.push(`## ${clip.id}`, "", `Skipped: ${run?.reason ?? "no summary entry"}`, "");
    continue;
  }

  const output = JSON.parse(await readFile(path.join(repoRoot, run.outputPath), "utf8"));
  const trackCount = output.tracks?.length ?? 0;
  const classes = [...new Set((output.tracks ?? []).map((track) => track.className))];
  const smoothingApplied = Boolean(run.diagnostics?.smoothingApplied);
  const expectationFailures = [];

  if (trackCount < clip.expectations.minTracks) {
    expectationFailures.push(`expected at least ${clip.expectations.minTracks} tracks, got ${trackCount}`);
  }
  for (const expectedClass of clip.expectations.classes) {
    if (!classes.includes(expectedClass)) {
      expectationFailures.push(`missing class ${expectedClass}`);
    }
  }
  if (clip.expectations.smoothingRequired && !smoothingApplied) {
    expectationFailures.push("smoothing was expected but not reported");
  }

  lines.push(`## ${clip.id}`);
  lines.push("");
  lines.push(`- Status: ${run.status}`);
  lines.push(`- Tracks: ${trackCount}`);
  lines.push(`- Classes: ${classes.join(", ") || "none"}`);
  lines.push(`- Runtime mode: ${run.diagnostics?.runtimeMode ?? "unknown"}`);
  lines.push(`- Exclusion zones: ${run.diagnostics?.exclusionZoneCount ?? 0}`);
  if (clip.id === "side-baseline-rally") {
    lines.push(`- Golden track count delta: ${trackCount - (goldenExport.tracks?.length ?? 0)}`);
  }
  lines.push(`- Result: ${expectationFailures.length === 0 ? "pass" : `fail (${expectationFailures.join("; ")})`}`);
  lines.push("");
}

const reportPath = path.join(outputDir, "benchmark-report.md");
await writeFile(reportPath, `${lines.join("\n")}\n`);
console.log(`Wrote benchmark report to ${reportPath}`);
