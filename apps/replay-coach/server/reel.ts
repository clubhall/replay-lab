import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import ffmpeg from "ffmpeg-static";
import { RenderSchema, reelDuration } from "../src/reel";

async function run(
  binary: string,
  args: string[],
  signal: AbortSignal,
  probe = false,
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, ["-hide_banner", "-nostdin", ...args], {
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-32768);
      });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Render timeout"));
    }, 120_000);
    const abort = () => child.kill("SIGKILL");
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(new Error("Render cancelled"));
      else if (code === 0 || probe) resolve(output);
      else
        reject(new Error("Não foi possível decodificar/exportar uma fonte."));
    });
  });
}
function verifyProgress(progress: string, durationMs: number) {
  const frames = Number([...progress.matchAll(/^frame=(\d+)/gm)].at(-1)?.[1]);
  const duration =
    Number([...progress.matchAll(/^out_time_us=(\d+)/gm)].at(-1)?.[1]) / 1000;
  if (
    !frames ||
    !Number.isFinite(duration) ||
    Math.abs(duration - durationMs) > 150
  )
    throw new Error(
      `Corte incompleto: esperado ${durationMs} ms; recebido ${duration} ms / ${frames} frames.`,
    );
}

// Body = original bytes in manifest order. Stream to disk, never buffer a video.
// Every byte is fingerprint-checked before FFmpeg is allowed to open any source.
export async function renderReel(
  req: IncomingMessage,
  res: ServerResponse,
  requestSignal: AbortSignal,
) {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(120_000)]);
  const header = req.headers["x-replay-manifest"];
  if (typeof header !== "string" || header.length > 12_000)
    throw new Error("Missing/oversize reel manifest");
  const request = RenderSchema.parse(JSON.parse(decodeURIComponent(header)));
  if (!ffmpeg) throw new Error("FFmpeg unavailable");
  const directory = await mkdtemp(join(tmpdir(), "replay-reel-"));
  let file: Awaited<ReturnType<typeof open>> | undefined;
  // The async iterator otherwise waits forever if the peer stops sending bytes.
  const abortUpload = () => {
    if (!req.complete) req.destroy(new Error("Upload cancelled or timed out"));
  };
  signal.addEventListener("abort", abortUpload, { once: true });
  try {
    signal.throwIfAborted();
    const paths = request.sources.map((_, i) => join(directory, `source-${i}`));
    let index = 0,
      bytes = 0;
    let hash = createHash("sha256");
    file = await open(paths[0], "wx");
    for await (const raw of req.iterator({ destroyOnReturn: false })) {
      signal.throwIfAborted();
      const chunk = Buffer.from(raw as Buffer);
      let offset = 0;
      while (offset < chunk.length) {
        const source = request.sources[index];
        if (!source || !file) throw new Error("Unexpected source bytes");
        const count = Math.min(source.size - bytes, chunk.length - offset);
        const part = chunk.subarray(offset, offset + count);
        await file.writeFile(part);
        hash.update(part);
        bytes += count;
        offset += count;
        if (bytes === source.size) {
          await file.close();
          file = undefined;
          if (hash.digest("hex") !== source.fingerprint)
            throw new Error("Original fingerprint mismatch");
          index++;
          bytes = 0;
          hash = createHash("sha256");
          if (index < paths.length) file = await open(paths[index], "wx");
        }
      }
    }
    if (index !== request.sources.length)
      throw new Error("Missing original bytes");
    const normalized: string[] = [];
    const safeInput = [
      "-protocol_whitelist",
      "file",
      "-format_whitelist",
      "mov,matroska,webm,avi,mpegts",
    ];
    const audio = new Map<string, boolean>();
    for (const [i, clip] of request.reel.clips.entries()) {
      signal.throwIfAborted();
      const source =
        paths[
          request.sources.findIndex((s) => s.fingerprint === clip.fingerprint)
        ];
      if (!audio.has(source)) {
        const probe = await run(
          ffmpeg,
          [...safeInput, "-i", source],
          signal,
          true,
        );
        if (!/Video:/.test(probe))
          throw new Error("Original contains no decodable video");
        audio.set(source, /Audio:/.test(probe));
      }
      const output = join(directory, `clip-${i}.mp4`);
      const duration = clip.endMs - clip.startMs;
      const progress = await run(
        ffmpeg,
        [
          "-loglevel",
          "error",
          "-progress",
          "pipe:1",
          ...safeInput,
          "-i",
          source,
          ...(!audio.get(source)
            ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            : []),
          "-ss",
          String(clip.startMs / 1000),
          "-t",
          String(duration / 1000),
          "-map",
          "0:v:0",
          "-map",
          audio.get(source) ? "0:a:0" : "1:a:0",
          "-vf",
          "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-af",
          "apad",
          "-movflags",
          "+faststart",
          output,
        ],
        signal,
      );
      verifyProgress(progress, duration);
      normalized.push(`file 'clip-${i}.mp4'\nduration ${duration / 1000}`);
    }
    await writeFile(join(directory, "concat.txt"), normalized.join("\n"));
    const output = join(directory, "reel.mp4");
    await run(
      ffmpeg,
      [
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "1",
        "-protocol_whitelist",
        "file",
        "-i",
        join(directory, "concat.txt"),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        output,
      ],
      signal,
    );
    const progress = await run(
      ffmpeg,
      [
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
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
      signal,
    );
    verifyProgress(progress, reelDuration(request.reel));
    const info = await stat(output);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": info.size,
      "Content-Disposition": 'attachment; filename="replay-reel.mp4"',
      "Cache-Control": "no-store",
      "X-Replay-Revision": String(request.reel.revision),
    });
    await pipeline(createReadStream(output), res, { signal });
  } finally {
    signal.removeEventListener("abort", abortUpload);
    if (!req.complete) req.resume();
    await file?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
