import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, request as httpRequest } from "node:http";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { api } from "./api";
import { renderReel } from "./reel";
const execute = promisify(execFile);
const server = createServer((req, res) => {
  if (req.url === "/test-upload-deadline") {
    void renderReel(req, res, AbortSignal.timeout(100)).catch(() => {
      if (!res.destroyed) res.destroy();
    });
    return;
  }
  void api(req, res, () => {
    res.writeHead(404);
    res.end();
  });
});
let origin: string, directory: string, red: Buffer, blue: Buffer;
const hash = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "replay-test-"));
  await execute(ffmpeg!, [
    "-f",
    "lavfi",
    "-i",
    "color=red:size=320x240:rate=30:duration=30",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    join(directory, "red.mp4"),
  ]);
  await execute(ffmpeg!, [
    "-f",
    "lavfi",
    "-i",
    "color=blue:size=640x360:rate=30:duration=40",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=40",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    join(directory, "blue.mp4"),
  ]);
  red = await readFile(join(directory, "red.mp4"));
  blue = await readFile(join(directory, "blue.mp4"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  origin = `http://127.0.0.1:${address.port}`;
}, 30_000);
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
function manifest() {
  return {
    reel: {
      version: "reel/v1",
      id: "fixture-reel",
      revision: 4,
      clips: [
        {
          id: "blue",
          sessionId: "b",
          fingerprint: hash(blue),
          label: "Synthetic blue with audio",
          startMs: 10_000,
          endMs: 40_000,
        },
        {
          id: "red",
          sessionId: "r",
          fingerprint: hash(red),
          label: "Synthetic red without audio",
          startMs: 0,
          endMs: 30_000,
        },
      ],
    },
    sources: [
      { fingerprint: hash(red), size: red.length },
      { fingerprint: hash(blue), size: blue.length },
    ],
  };
}
function send(
  body: Buffer,
  metadata: unknown,
  extra: Record<string, string> = {},
) {
  return fetch(`${origin}/api/coach/reel`, {
    method: "POST",
    headers: {
      "X-Replay-Manifest": encodeURIComponent(JSON.stringify(metadata)),
      ...extra,
    },
    body: new Uint8Array(body),
  });
}
describe("real multiasset FFmpeg render (synthetic media, not athlete validation)", () => {
  it("renders a 60-second reordered reel with video, original audio and silent-source audio", async () => {
    const unicode = manifest();
    unicode.reel.clips[0].label = "Treino 🎾 — João 50%";
    const response = await send(Buffer.concat([red, blue]), unicode);
    if (!response.ok) throw new Error(await response.text());
    expect(response.headers.get("x-replay-revision")).toBe("4");
    const output = join(directory, "reel.mp4");
    await writeFile(output, Buffer.from(await response.arrayBuffer()));
    const decoded = await execute(
      ffmpeg!,
      [
        "-hide_banner",
        "-i",
        output,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 1_000_000 },
    );
    expect(decoded.stderr).toMatch(/Video: h264/);
    expect(decoded.stderr).toMatch(/Audio: aac/);
    expect(decoded.stderr).toMatch(/Duration: 00:01:00\./);
    await mkdir("test-results/reel", { recursive: true });
    await copyFile(output, "test-results/reel/synthetic-60s.mp4");
    const rendered = await readFile(output);
    await writeFile(
      "test-results/reel/manifest.json",
      JSON.stringify(
        {
          ...manifest(),
          synthetic: true,
          outputSha256: hash(rendered),
          decode: decoded.stderr,
        },
        null,
        2,
      ),
    );
    const indexed = await fetch(`${origin}/api/coach/index`, {
      method: "POST",
      headers: { "X-Source-Fingerprint": hash(rendered) },
      body: rendered,
    });
    expect(indexed.status).toBe(200);
    const index = (await indexed.json()) as {
      version: string;
      coverageMs: number;
      candidates: Array<{ startMs: number }>;
    };
    expect(index.version).toBe("visual-change/v1");
    expect(index.coverageMs).toBeGreaterThanOrEqual(59_500);
    expect(
      index.candidates.some((c) => c.startMs >= 28_000 && c.startMs <= 30_000),
    ).toBe(true);
    for (const [second, color] of [
      [1, "blue"],
      [31, "red"],
    ] as const) {
      const frame = join(directory, `${color}.rgb`);
      await execute(ffmpeg!, [
        "-ss",
        String(second),
        "-i",
        output,
        "-frames:v",
        "1",
        "-vf",
        "crop=2:2:640:360",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        frame,
      ]);
      const pixel = await readFile(frame);
      expect(pixel[color === "blue" ? 2 : 0]).toBeGreaterThan(200);
      expect(pixel[color === "blue" ? 0 : 2]).toBeLessThan(30);
    }
  }, 120_000);
  it("fails closed for changed/missing originals, invalid intervals, origins and indirect media", async () => {
    expect(
      (
        await send(Buffer.concat([red, blue]), manifest(), {
          Origin: "https://foreign.example",
        })
      ).status,
    ).toBe(403);
    const altered = Buffer.from(red);
    altered[altered.length - 1] = altered.at(-1)! ^ 1;
    expect(
      (await send(Buffer.concat([altered, blue]), manifest())).status,
    ).toBe(400);
    expect((await send(red, manifest())).status).toBe(400);
    const outside = manifest();
    outside.reel.clips[0].startMs = 50_000;
    outside.reel.clips[0].endMs = 51_000;
    expect((await send(Buffer.concat([red, blue]), outside)).status).toBe(400);
    const playlist = Buffer.from("#EXTM3U\nfile:///etc/passwd\n");
    const indirect = manifest();
    indirect.reel.clips = [
      {
        ...indirect.reel.clips[0],
        fingerprint: hash(playlist),
        startMs: 0,
        endMs: 1000,
      },
    ];
    indirect.sources = [{ fingerprint: hash(playlist), size: playlist.length }];
    expect((await send(playlist, indirect)).status).toBe(400);
  }, 30_000);
  it("terminates a stalled upload on deadline without another incoming chunk", async () => {
    const before = new Set(
      (await readdir(tmpdir())).filter((n) => n.startsWith("replay-reel-")),
    );
    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(`${origin}/test-upload-deadline`, {
        method: "POST",
        headers: {
          "X-Replay-Manifest": encodeURIComponent(JSON.stringify(manifest())),
          "Content-Length": red.length + blue.length,
        },
      });
      const watchdog = setTimeout(() => {
        req.destroy();
        reject(new Error("Stalled upload did not stop"));
      }, 3000);
      req.on("error", () => {
        clearTimeout(watchdog);
        resolve();
      });
      req.write(red.subarray(0, 1));
      // Deliberately no end/next chunk: only the server budget can finish.
    });
    await expect
      .poll(
        async () =>
          (await readdir(tmpdir())).filter(
            (n) => n.startsWith("replay-reel-") && !before.has(n),
          ),
        { timeout: 3000 },
      )
      .toEqual([]);
  });
  it("cancels active rendering and removes temporary media", async () => {
    const before = new Set(
      (await readdir(tmpdir())).filter((n) => n.startsWith("replay-reel-")),
    );
    const controller = new AbortController();
    const request = fetch(`${origin}/api/coach/reel`, {
      method: "POST",
      headers: { "X-Replay-Manifest": JSON.stringify(manifest()) },
      body: Buffer.concat([red, blue]),
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    await expect(request).rejects.toThrow();
    await expect
      .poll(
        async () =>
          (await readdir(tmpdir())).filter(
            (n) => n.startsWith("replay-reel-") && !before.has(n),
          ),
        { timeout: 10_000 },
      )
      .toEqual([]);
  });
});
