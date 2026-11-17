// Convert heavy PNG assets to WebP (quality 0.90, preserving exact dimensions & alpha) via headless Chrome CDP.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(SITE, "public");
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DEAD_FILES = [
  "assets/bouquet-champagne-blue@3x.png",
  "assets/bouquet-champagne-dark@3x.png",
  "assets/envelope-closed@2x.png",
];

const TARGET_PNGS = [
  // public/photos/
  "photos/p1-beijing-restored.png",
  "photos/p2-shanghai19m-restored.png",
  "photos/polaroid-cat-remake.png",
  "photos/polaroid-gd-remake.png",
  // public/assets/
  "assets/framed-bg@3x.png",
  "assets/framed-colored-real@3x.png",
  "assets/butterfly-colored-real@3x.png",
  "assets/flower-mask-02c.png",
  "assets/envelope-back@2x.png",
  "assets/envelope-front@2x.png",
  "assets/bouquet-lines@3x.png",
  "assets/bouquet-color-a@3x.png",
  "assets/bouquet-color-b@3x.png",
  "assets/butterfly-wing-left@3x.png",
  "assets/butterfly-wing-right@3x.png",
  "assets/butterfly-body@3x.png",
  // public/assets/birds/
  "assets/birds/s04-r1-ribbon-bg@2x.png",
  "assets/birds/s04-r1-flock-f1@2x.png",
  "assets/birds/s04-r1-flock-f2@2x.png",
  "assets/birds/s04-r1-flock-f3@2x.png",
  "assets/birds/s05-echo-birds@2x.png",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Delete unused dead PNGs first
const deletedDead = [];
for (const rel of DEAD_FILES) {
  const full = join(PUBLIC, rel);
  if (existsSync(full)) {
    const size = statSync(full).size;
    unlinkSync(full);
    deletedDead.push({ rel, size });
  }
}

// 2. Collect PNGs to convert
const jobs = [];
for (const rel of TARGET_PNGS) {
  const pngPath = join(PUBLIC, rel);
  const webpRel = rel.replace(/\.png$/i, ".webp");
  const webpPath = join(PUBLIC, webpRel);
  if (existsSync(pngPath)) {
    jobs.push({ rel, pngPath, webpRel, webpPath, bytes: readFileSync(pngPath) });
  } else if (existsSync(webpPath)) {
    console.log(`[skip] already converted: ${webpRel} (${statSync(webpPath).size} B)`);
  } else {
    throw new Error(`Missing source PNG and target WebP: ${rel}`);
  }
}

if (jobs.length === 0) {
  console.log("Nothing to convert. Dead files deleted:", deletedDead);
  process.exit(0);
}

// 3. Start ephemeral local HTTP server to serve source PNGs cleanly to headless Chrome
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body></body></html>");
    return;
  }
  if (url.pathname === "/png") {
    const idx = Number(url.searchParams.get("i"));
    const job = jobs[idx];
    if (!job) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    res.end(job.bytes);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const httpPort = server.address().port;

const profDir = join(SITE, `.tmp_slim_img_${Date.now()}`);
mkdirSync(profDir, { recursive: true });

const chromeProc = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${profDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let ws;
let idSeq = 1;
const pending = new Map();

const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = idSeq++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const ev = async (expression) => {
  const res = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
};

const results = [];
let totalBefore = deletedDead.reduce((a, b) => a + b.size, 0);
let totalAfter = 0;

try {
  const cdpPort = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Chrome startup timeout")), 15000);
    chromeProc.stderr.on("data", (d) => {
      const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(d.toString());
      if (m) {
        clearTimeout(t);
        resolve(Number(m[1]));
      }
    });
  });

  const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (msg) => {
    const m = JSON.parse(msg.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(m.error);
      else resolve(m.result);
    }
  });

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Page.navigate", { url: `http://127.0.0.1:${httpPort}/` });
  await sleep(300);

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const conv = await ev(`(async () => {
      const img = new Image();
      img.src = "/png?i=${i}";
      await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) throw new Error("Invalid natural dimensions");

      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);

      const srcData = ctx.getImageData(0, 0, w, h).data;
      let srcHasAlpha = false;
      for (let k = 3; k < srcData.length; k += 4) {
        if (srcData[k] < 255) { srcHasAlpha = true; break; }
      }

      const dataUrl = c.toDataURL("image/webp", 0.90);
      if (!dataUrl.startsWith("data:image/webp;base64,")) {
        throw new Error("toDataURL did not produce image/webp");
      }

      const check = new Image();
      check.src = dataUrl;
      await check.decode();
      if (check.naturalWidth !== w || check.naturalHeight !== h) {
        throw new Error(\`Dimension mismatch: \${check.naturalWidth}x\${check.naturalHeight} vs \${w}x\${h}\`);
      }

      let dstHasAlpha = false;
      if (srcHasAlpha) {
        const c2 = document.createElement("canvas");
        c2.width = w;
        c2.height = h;
        const ctx2 = c2.getContext("2d");
        ctx2.drawImage(check, 0, 0);
        const dstData = ctx2.getImageData(0, 0, w, h).data;
        for (let k = 3; k < dstData.length; k += 4) {
          if (dstData[k] < 255) { dstHasAlpha = true; break; }
        }
        if (!dstHasAlpha) {
          throw new Error("Alpha channel lost in WebP output");
        }
      }

      return { w, h, srcHasAlpha, dstHasAlpha, b64: dataUrl.slice("data:image/webp;base64,".length) };
    })()`);

    const outBuf = Buffer.from(conv.b64, "base64");
    if (
      outBuf.length < 16 ||
      outBuf.subarray(0, 4).toString("ascii") !== "RIFF" ||
      outBuf.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      throw new Error(`Invalid WebP header/buffer for ${job.rel}`);
    }

    writeFileSync(job.webpPath, outBuf);
    const writtenSize = statSync(job.webpPath).size;
    if (writtenSize !== outBuf.length || writtenSize === 0) {
      throw new Error(`Failed verifying written WebP on disk: ${job.webpRel}`);
    }

    unlinkSync(job.pngPath);
    const beforeSize = job.bytes.length;
    totalBefore += beforeSize;
    totalAfter += writtenSize;
    results.push({
      file: job.webpRel,
      dimensions: `${conv.w}x${conv.h}`,
      alpha: conv.srcHasAlpha,
      beforeBytes: beforeSize,
      afterBytes: writtenSize,
      savedPct: Number((((beforeSize - writtenSize) / beforeSize) * 100).toFixed(1)),
    });
  }

  console.log(
    JSON.stringify(
      {
        deletedDead,
        convertedCount: results.length,
        totalBeforeBytes: totalBefore,
        totalAfterBytes: totalAfter,
        totalBeforeMB: Number((totalBefore / (1024 * 1024)).toFixed(2)),
        totalAfterMB: Number((totalAfter / (1024 * 1024)).toFixed(2)),
        results,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    ws?.close();
  } catch {}
  try {
    chromeProc.kill();
  } catch {}
  try {
    server.close();
  } catch {}
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(350);
    try {
      rmSync(profDir, { recursive: true, force: true });
      if (!existsSync(profDir)) break;
    } catch {}
  }
}
