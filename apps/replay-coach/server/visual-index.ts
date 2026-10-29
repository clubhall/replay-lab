import type { IncomingMessage } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { indexFrames } from "../src/visual-index";
export async function analyzeVisualChanges(
  req: IncomingMessage,
  parentSignal: AbortSignal,
) {
  const fingerprint = req.headers["x-source-fingerprint"];
  if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint))
    throw new Error("Missing source fingerprint");
  if (!ffmpeg) throw new Error("FFmpeg unavailable");
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(120_000)]);
  const directory = await mkdtemp(join(tmpdir(), "replay-index-"));
  try {
    const source = join(directory, "source");
    let bytes = 0;
    const hash = createHash("sha256");
    await pipeline(
      req,
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          hash.update(chunk);
          callback(
            bytes > 1024 ** 3 ? new Error("Source exceeds 1 GiB") : null,
            chunk,
          );
        },
      }),
      createWriteStream(source),
      { signal },
    );
    if (hash.digest("hex") !== fingerprint)
      throw new Error("Original fingerprint mismatch");
    const frames = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(
        ffmpeg!,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-protocol_whitelist",
          "file",
          "-format_whitelist",
          "mov,matroska,webm,avi,mpegts",
          "-i",
          source,
          "-t",
          "120",
          "-vf",
          "fps=2,scale=32:18",
          "-an",
          "-f",
          "rawvideo",
          "-pix_fmt",
          "gray",
          "pipe:1",
        ],
        { signal, stdio: ["ignore", "pipe", "ignore"] },
      );
      const chunks: Buffer[] = [];
      let total = 0;
      const abort = () => child.kill("SIGKILL");
      signal.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > 32 * 18 * 241) {
          child.kill("SIGKILL");
          reject(new Error("Analysis output limit"));
        } else chunks.push(chunk);
      });
      child.once("error", reject);
      child.once("close", (code) => {
        signal.removeEventListener("abort", abort);
        if (code === 0 && total >= 32 * 18 && !signal.aborted)
          resolve(Buffer.concat(chunks));
        else
          reject(new Error("Análise interrompida ou vídeo não decodificado."));
      });
    });
    return indexFrames(frames, fingerprint, randomUUID());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
