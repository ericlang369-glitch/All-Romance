// 本地预览：把 out/（pnpm build 的静态导出）用 Node 自带 http 模块放到 http://localhost:3000
// 用法：pnpm start        （端口可用 PORT=xxxx pnpm start 改）
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../out/", import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url || "/", "http://x").pathname);
  if (p === "/All-Romance" || p === "/All-Romance/") p = "/";
  else if (p.startsWith("/All-Romance/")) p = p.slice("/All-Romance".length);
  p = normalize(p).replace(/^(\.\.[/\\])+/, "");
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f) && existsSync(f + ".html")) f += ".html";
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  const long = /\/(_next\/static|fonts|assets)\//.test(p);
  res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream", "Cache-Control": long ? "public, max-age=31536000, immutable" : "no-cache" });
  createReadStream(f).pipe(res);
}).listen(PORT, "0.0.0.0", () => console.log(`预览：http://localhost:${PORT}`));
