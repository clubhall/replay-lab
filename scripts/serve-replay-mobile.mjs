import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("apps/replay-mobile/dist");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".json": "application/json",
};
http
  .createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + pathname);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    )
      file = path.join(root, "index.html");
    if (!fs.existsSync(file)) {
      response.writeHead(503);
      response.end("Run pnpm build:ios-preview first.");
      return;
    }
    response.setHeader(
      "Content-Type",
      types[path.extname(file)] ?? "application/octet-stream",
    );
    const size = fs.statSync(file).size;
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = Math.min(Number(range[2]) || size - 1, size - 1);
      if (start > end || start >= size) {
        response.writeHead(416, { "Content-Range": `bytes */${size}` });
        response.end();
        return;
      }
      response.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(response);
    } else {
      response.setHeader("Content-Length", size);
      fs.createReadStream(file).pipe(response);
    }
  })
  .listen(Number(process.env.PORT ?? 5201), "127.0.0.1");
