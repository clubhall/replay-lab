// Generated diagnostic media only. No athlete footage or licensed recordings.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(
  new URL("../apps/replay-coach/package.json", import.meta.url),
);
const ffmpeg = require("ffmpeg-static");
mkdirSync(new URL("../tests/coach/generated/", import.meta.url), {
  recursive: true,
});
const output = new URL("../tests/coach/generated/source.mp4", import.meta.url)
  .pathname;
const result = spawnSync(
  ffmpeg,
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30:duration=8",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=8",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    output,
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Generated tests/coach/generated/source.mp4 (synthetic video + 440 Hz audio).",
);
