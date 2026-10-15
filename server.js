const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { handleLead } = require("./lib/lead-handler.js");

loadEnv();

const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/apply") {
    await handleLead(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  serveStatic(url.pathname, request, response);
});

server.listen(port, () => {
  console.log(`Olga Prem site is running on http://localhost:${port}`);
});

function serveStatic(rawPathname, request, response) {
  let pathname;
  try { pathname = decodeURIComponent(rawPathname); } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  const relativePath = path.relative(publicDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || pathname.includes("\0")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (path.extname(filePath).toLowerCase() === ".mp4") {
    serveVideo(filePath, request, response);
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const isCodeAsset = type.startsWith("text/html") || type.startsWith("text/css") || type.startsWith("application/javascript");

    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": isCodeAsset ? "no-cache" : "public, max-age=3600"
    });
    response.end(data);
  });
}

function serveVideo(filePath, request, response) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const size = stat.size;
    let start = 0;
    let end = size - 1;
    const range = request.headers.range;
    // Byte ranges let browsers seek without downloading the entire MP4 again.
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.writeHead(416, { "Content-Range": `bytes */${size}` });
        response.end();
        return;
      }
      if (!match[1]) {
        const suffix = Number(match[2]);
        start = Math.max(0, size - suffix);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) start = size;
      } else {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
        response.writeHead(416, { "Content-Range": `bytes */${size}` });
        response.end();
        return;
      }
    }
    const headers = {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Cache-Control": "public, max-age=3600"
    };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === "HEAD" || size === 0) {
      response.end();
      return;
    }
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
