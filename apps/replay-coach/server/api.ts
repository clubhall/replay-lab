import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { spawn } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { compose } from "./decision";
const MAX_BYTES = 1024 * 1024 * 1024;
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
export async function api(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/coach/")) return next();
  // Local-only processing. Reject cross-origin callers and DNS rebinding.
  const host = req.headers.host ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    return json(res, 403, { error: "Localhost only" });
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== host)
      return json(res, 403, { error: "Origin denied" });
  } catch {
    return json(res, 403, { error: "Origin denied" });
  }
  if (req.method !== "POST") return json(res, 405, { error: "POST required" });
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.on("aborted", abort);
  res.on("close", () => {
    if (!res.writableEnded) abort();
  });
  let directory: string | undefined;
  try {
    if (url.pathname === "/api/coach/decision") {
      let body = "";
      for await (const chunk of req) {
        body += String(chunk);
        if (body.length > 16_384) throw new Error("Request too large");
      }
      const raw: unknown = JSON.parse(body);
      return json(
        res,
        200,
        await compose(raw, {
          key: process.env.TYPESAFE_API_KEY,
          signal: controller.signal,
        }),
      );
    }
    if (url.pathname !== "/api/coach/export")
      return json(res, 404, { error: "Not found" });
    const start = Number(url.searchParams.get("start"));
    const end = Number(url.searchParams.get("end"));
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      end - start > 120
    )
      throw new Error("Selecione um corte de até 120 segundos.");
    if (!ffmpeg) throw new Error("FFmpeg indisponível neste sistema.");
    if (Number(req.headers["content-length"]) > MAX_BYTES)
      throw new Error("Exportação local limitada a arquivos de 1 GB.");
    const binary = ffmpeg;
    directory = await mkdtemp(join(tmpdir(), "replay-coach-"));
    const input = join(directory, "source");
    const output = join(directory, "clip.mp4");
    let bytes = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(
          bytes > MAX_BYTES ? new Error("Arquivo excede 1 GB.") : null,
          chunk,
        );
      },
    });
    await pipeline(req, limit, createWriteStream(input), {
      signal: controller.signal,
    });
    await new Promise<void>((resolve, reject) => {
      const process = spawn(
        binary,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-progress",
          "pipe:1",
          "-nostdin",
          "-protocol_whitelist",
          "file",
          "-format_whitelist",
          "mov,matroska,webm,avi,mpegts",
          "-i",
          input,
          "-ss",
          String(start),
          "-t",
          String(end - start),
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
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
          "-movflags",
          "+faststart",
          output,
        ],
        { stdio: ["ignore", "pipe", "ignore"], signal: controller.signal },
      );
      let progress = "";
      process.stdout.on("data", (chunk: Buffer) => {
        progress += chunk.toString();
        if (progress.length > 32768) progress = progress.slice(-16384);
      });
      const timeout = setTimeout(() => {
        process.kill("SIGKILL");
        reject(new Error("Export timeout"));
      }, 120_000);
      process.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      process.once("exit", (code) => {
        clearTimeout(timeout);
        const frames = [...progress.matchAll(/^frame=(\d+)/gm)].at(-1)?.[1];
        const duration = [...progress.matchAll(/^out_time_us=(\d+)/gm)].at(
          -1,
        )?.[1];
        if (
          code === 0 &&
          Number(frames) > 0 &&
          Number(duration) / 1e6 >= end - start - 0.15
        )
          resolve();
        else
          reject(
            new Error("Não foi possível decodificar/exportar este vídeo."),
          );
      });
    });
    const info = await stat(output);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": info.size,
      "Content-Disposition": 'attachment; filename="replay-coach.mp4"',
      "Cache-Control": "no-store",
    });
    await pipeline(createReadStream(output), res, {
      signal: controller.signal,
    });
  } catch (error) {
    if (!res.headersSent && !res.destroyed)
      json(res, 400, {
        error:
          error instanceof Error
            ? error.message
            : "Falha no processamento local",
      });
  } finally {
    req.off("aborted", abort);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
