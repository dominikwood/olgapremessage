const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in deployment files: ${file}`);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function main() {
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Use Node.js 24.x, matching the Vercel runtime.");
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  if (config.framework !== null || config.outputDirectory !== "public") throw new Error("Expected the static public directory and Other framework preset.");
  if (typeof require("../api/apply.js") !== "function") throw new Error("The /api/apply handler must export a function.");

  const files = walk(publicDir);
  const publicPaths = new Set(files.map(file => "/" + path.relative(publicDir, file).split(path.sep).join("/")));
  for (const file of files) {
    if (/(^|[\\/])\.env(?:\.|$)|\.(?:pem|key|log)$/i.test(file)) throw new Error(`Private file in public: ${file}`);
    const relative = "/" + path.relative(publicDir, file).split(path.sep).join("/");
    if (![".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"].includes(path.extname(file))) continue;
    const content = fs.readFileSync(file, "utf8");
    if (/\b\d{6,15}:[A-Za-z0-9_-]{30,}\b|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)) throw new Error(`Possible credential in public: ${relative}`);
    const references = path.extname(file) === ".html"
      ? [...content.matchAll(/\b(?:src|href|data-video-src)\s*=\s*["']([^"']+)["']/g)].map(match => match[1])
      : path.extname(file) === ".css"
        ? [...content.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map(match => match[1])
        : [];
    for (const reference of references) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
      const url = new URL(reference, `https://olgraprem.org.ua${relative}`);
      const target = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      // Exact case matters on Vercel/Linux even when building from Windows.
      if (!publicPaths.has(target)) throw new Error(`Missing file or wrong filename case: ${reference} in ${relative}`);
    }
  }
  for (const directory of ["api", "lib", "scripts"]) {
    for (const file of walk(path.join(root, directory)).filter(file => /\.(?:js|cjs|mjs)$/.test(file))) {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    }
  }
  for (const file of files.filter(file => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  execFileSync(process.execPath, ["--check", path.join(root, "server.js")], { stdio: "pipe" });

  if (process.env.VERCEL_ENV === "production") {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "";
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token) || !/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/.test(chatId)) {
      throw new Error("Set valid TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel Production Environment Variables, then redeploy. Values are never printed.");
    }
  }
  const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  console.log(`Deployment checks passed: ${files.length} public files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. Static assets and the Telegram API are separate.`);
}

try { main(); } catch (error) {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
}
