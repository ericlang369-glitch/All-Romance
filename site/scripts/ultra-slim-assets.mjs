// Ultra-slim public/assets/ and public/photos/ via headless Chrome CDP + Canvas 2D:
// 1. Bake 1-file Screen-01 instant preview (assets/tree-calm-preview.webp, 585x1266, ~55 KB).
// 2. Convert all 33 PNGs in assets/tree/ -> .webp (q=0.84) and remove old .png files.
// 3. Convert all 8 escort-*.png & wake-*.png in assets/birds/ -> .webp (q=0.88) and remove old .png files.
// 4. Downscale oversized @3x/@2x WebPs & tall JPGs in-place (preserving exact filenames) + slim remaining heavy WebPs.
// 5. Clean up temp Chrome profile folder and verify total assets + photos size < 1.5 MB.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(SITE, "public");
const ASSETS = join(PUBLIC, "assets");
const PHOTOS = join(PUBLIC, "photos");
const TREE_DIR = join(ASSETS, "tree");
const BIRDS_DIR = join(ASSETS, "birds");
const LAYOUT_JSON = join(SITE, "src", "data", "tree-layout.json");
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isValidWebp(buf) {
  return (
    buf.length >= 16 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function isValidJpeg(buf) {
  return (
    buf.length >= 4 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[buf.length - 2] === 0xff &&
    buf[buf.length - 1] === 0xd9
  );
}

// Strip redundant sRGB ICCP chunk from Chrome's WebP container (464 B per file) while updating RIFF size and VP8X flags
function stripWebpIccp(buf) {
  if (!isValidWebp(buf)) return buf;
  const out = [buf.subarray(0, 12)];
  let off = 12;
  let removed = false;
  while (off + 8 <= buf.length) {
    const tag = buf.subarray(off, off + 4).toString("ascii");
    const sz = buf.readUInt32LE(off + 4);
    const chunkLen = 8 + sz + (sz & 1);
    if (tag === "ICCP") {
      removed = true;
    } else {
      out.push(buf.subarray(off, off + chunkLen));
    }
    off += chunkLen;
  }
  if (!removed) return buf;
  const merged = Buffer.concat(out);
  merged.writeUInt32LE(merged.length - 8, 4);
  if (merged.subarray(12, 16).toString("ascii") === "VP8X") {
    merged[20] &= ~0x20;
  }
  return merged;
}

function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function getMime(rel) {
  if (/\.png$/i.test(rel)) return "image/png";
  if (/\.webp$/i.test(rel)) return "image/webp";
  if (/\.jpe?g$/i.test(rel)) return "image/jpeg";
  return "application/octet-stream";
}

// Measure current baseline
const initialFiles = [...walkFiles(ASSETS), ...walkFiles(PHOTOS)];
const initialTotalBytes = initialFiles.reduce((s, f) => s + statSync(f).size, 0);

// Load tree-layout.json and calm layers
const treeLayout = JSON.parse(readFileSync(LAYOUT_JSON, "utf8"));
const calmLayers = treeLayout.layers
  .filter((l) => l.set === "full" || l.set === "both")
  .sort((a, b) => a.z - b.z)
  .map((l) => {
    const pngFile = join(TREE_DIR, l.src);
    const webpFile = join(TREE_DIR, l.src.replace(/\.png$/i, ".webp"));
    const file = existsSync(pngFile) ? pngFile : webpFile;
    if (!existsSync(file)) throw new Error(`Missing calm tree layer: ${l.src}`);
    return {
      ...l,
      fileRel: relative(PUBLIC, file).replace(/\\/g, "/"),
    };
  });

// Collect tree PNGs (step 2)
const treePngFiles = existsSync(TREE_DIR)
  ? readdirSync(TREE_DIR)
      .filter((n) => /\.png$/i.test(n))
      .sort()
      .map((n) => join(TREE_DIR, n))
  : [];

// Collect birds escort-*.png & wake-*.png (step 3)
const birdPngFiles = existsSync(BIRDS_DIR)
  ? readdirSync(BIRDS_DIR)
      .filter((n) => /^(escort-|wake-).*\.png$/i.test(n))
      .sort()
      .map((n) => join(BIRDS_DIR, n))
  : [];

// Collect step 4 targets (exact filenames preserved)
const RESIZE_SPECS = [
  { rel: "assets/framed-bg@3x.webp", w: 860, h: 1147, mime: "image/webp", q: 0.84, alphaMode: "quant", step: 32, cutLow: 8, targetMaxKB: 75, reencodeIfLargerThanBytes: 75 * 1024 },
  { rel: "assets/framed-colored-real@3x.webp", w: 860, h: 1147, mime: "image/webp", q: 0.72, alphaMode: "quant", step: 48, cutLow: 12, targetMaxKB: 80, reencodeIfLargerThanBytes: 80 * 1024 },
  { rel: "assets/butterfly-colored-real@3x.webp", w: 540, h: 524, mime: "image/webp", q: 0.86, alphaMode: "quant", step: 24, cutLow: 6 },
  { rel: "assets/butterfly-wing-left@3x.webp", w: 540, h: 524, mime: "image/webp", q: 0.86, alphaMode: "quant", step: 24, cutLow: 6 },
  { rel: "assets/butterfly-wing-right@3x.webp", w: 540, h: 524, mime: "image/webp", q: 0.86, alphaMode: "quant", step: 24, cutLow: 6 },
  { rel: "assets/butterfly-body@3x.webp", w: 540, h: 524, mime: "image/webp", q: 0.86, alphaMode: "quant", step: 24, cutLow: 6 },
  { rel: "assets/bouquet-lines@3x.webp", w: 484, h: 620, mime: "image/webp", q: 0.85, alphaMode: "quant", step: 32, cutLow: 8 },
  { rel: "assets/bouquet-color-a@3x.webp", w: 484, h: 620, mime: "image/webp", q: 0.80, alphaMode: "err", step: 32, cutLow: 6 },
  { rel: "assets/bouquet-color-b@3x.webp", w: 484, h: 620, mime: "image/webp", q: 0.74, alphaMode: "err", step: 32, cutLow: 6 },
  { rel: "assets/birds/s04-r1-ribbon-bg@2x.webp", w: 780, h: 1688, mime: "image/webp", q: 0.78, alphaMode: "err", step: 24, cutLow: 3, targetMaxKB: 85, reencodeIfLargerThanBytes: 85 * 1024 },
  { rel: "assets/birds/s04-r1-flock-f1@2x.webp", w: 780, h: 1688, mime: "image/webp", q: 0.76, alphaMode: "quant", step: 48, cutLow: 12, reencodeIfLargerThanBytes: 60 * 1024 },
  { rel: "assets/birds/s04-r1-flock-f2@2x.webp", w: 780, h: 1688, mime: "image/webp", q: 0.76, alphaMode: "quant", step: 48, cutLow: 12, reencodeIfLargerThanBytes: 60 * 1024 },
  { rel: "assets/birds/s04-r1-flock-f3@2x.webp", w: 780, h: 1688, mime: "image/webp", q: 0.76, alphaMode: "quant", step: 48, cutLow: 12, reencodeIfLargerThanBytes: 60 * 1024 },
  { rel: "assets/flower-mask-02c.webp", w: 780, h: 1688, mime: "image/webp", q: 0.82, alphaMode: "quant", step: 32, cutLow: 8, reencodeIfLargerThanBytes: 24 * 1024 },
  { rel: "assets/envelope-back@2x.webp", w: 560, h: 604, mime: "image/webp", q: 0.76, alphaMode: "err", step: 20, cutLow: 4 },
  { rel: "assets/envelope-front@2x.webp", w: 560, h: 604, mime: "image/webp", q: 0.76, alphaMode: "none" },
  { rel: "photos/p1-beijing-restored.webp", w: 716, h: 478, mime: "image/webp", q: 0.86, alphaMode: "none", targetMaxKB: 75 },
  { rel: "photos/p2-shanghai19m-restored.webp", w: 716, h: 478, mime: "image/webp", q: 0.86, alphaMode: "none", targetMaxKB: 75 },
  { rel: "photos/polaroid-cat-remake.webp", w: 737, h: 499, mime: "image/webp", q: 0.76, alphaMode: "none", reencodeIfLargerThanBytes: 30 * 1024 },
  { rel: "photos/polaroid-gd-remake.webp", w: 767, h: 509, mime: "image/webp", q: 0.76, alphaMode: "none", reencodeIfLargerThanBytes: 30 * 1024 },
  { rel: "photos/pailepai-flights.jpg", maxH: 800, mime: "image/jpeg", q: 0.84 },
  { rel: "photos/polaroid-cat-full.jpg", maxH: 800, mime: "image/jpeg", q: 0.84 },
  { rel: "photos/polaroid-gd-full.jpg", maxH: 800, mime: "image/jpeg", q: 0.84 },
];

// Cache readable source files in memory for clean HTTP serving
const fileCache = new Map();
const cacheFile = (rel) => {
  const norm = rel.replace(/\\/g, "/");
  if (!fileCache.has(norm)) {
    const abs = join(PUBLIC, norm);
    if (!existsSync(abs)) throw new Error(`Missing file: ${norm}`);
    fileCache.set(norm, readFileSync(abs));
  }
  return fileCache.get(norm);
};

for (const l of calmLayers) cacheFile(l.fileRel);
for (const p of treePngFiles) cacheFile(relative(PUBLIC, p));
for (const p of birdPngFiles) cacheFile(relative(PUBLIC, p));
for (const s of RESIZE_SPECS) cacheFile(s.rel);

// Start ephemeral local HTTP server
const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><body></body></html>");
    return;
  }
  if (url.pathname === "/file") {
    const rel = url.searchParams.get("p") || "";
    const bytes = fileCache.get(rel);
    if (!bytes) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": getMime(rel), "Cache-Control": "no-store" });
    res.end(bytes);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const httpPort = server.address().port;

const profDir = join(SITE, `.tmp_ultra_slim_${Date.now()}`);
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
    throw new Error(
      res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        JSON.stringify(res.exceptionDetails),
    );
  }
  return res.result?.value;
};

const stagedWrites = [];
const stagedDeletes = [];
const report = {
  dryRun: DRY_RUN,
  initialTotalBytes,
  initialTotalMB: Number((initialTotalBytes / (1024 * 1024)).toFixed(3)),
  step1_preview: null,
  step2_tree: [],
  step3_birds: [],
  step4_resizes: [],
};

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
  await sleep(250);

  await ev(`(() => {
    window.__hasAlpha = (ctx, w, h) => {
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let k = 3; k < d.length; k += 4) {
        if (d[k] < 255) return true;
      }
      return false;
    };

    window.__quantAlpha = (ctx, w, h, step, cutLow) => {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        let a = d[i + 3];
        if (a <= cutLow) a = 0;
        else if (a >= 255 - cutLow) a = 255;
        else if (step > 1) a = Math.min(255, Math.round(a / step) * step);
        d[i + 3] = a;
      }
      ctx.putImageData(id, 0, 0);
    };

    window.__errDiffAlpha = (ctx, w, h, step, cutLow, carry = 0.68) => {
      const id = ctx.getImageData(0, 0, w, h);
      const d = id.data;
      for (let y = 0; y < h; y++) {
        let err = (((y * 0.6180339887) % 1) - 0.5) * step;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = d[i + 3];
          if (a <= cutLow) { d[i + 3] = 0; continue; }
          if (a >= 255 - cutLow) { d[i + 3] = 255; continue; }
          const v = a + err;
          const q = Math.max(0, Math.min(255, Math.round(v / step) * step));
          err = (v - q) * carry;
          d[i + 3] = q;
        }
      }
      ctx.putImageData(id, 0, 0);
    };

    window.__encodeCanvas = async (canvas, mime, quality, expectAlpha) => {
      const dataUrl = canvas.toDataURL(mime, quality);
      if (!dataUrl.startsWith("data:" + mime + ";base64,")) {
        throw new Error("toDataURL did not produce " + mime);
      }
      const check = new Image();
      check.src = dataUrl;
      await check.decode();
      if (check.naturalWidth !== canvas.width || check.naturalHeight !== canvas.height) {
        throw new Error(\`Dimension mismatch after encode: \${check.naturalWidth}x\${check.naturalHeight} vs \${canvas.width}x\${canvas.height}\`);
      }
      let dstHasAlpha = false;
      if (expectAlpha) {
        const c2 = document.createElement("canvas");
        c2.width = canvas.width;
        c2.height = canvas.height;
        const ctx2 = c2.getContext("2d");
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = "high";
        ctx2.drawImage(check, 0, 0);
        dstHasAlpha = window.__hasAlpha(ctx2, c2.width, c2.height);
        if (!dstHasAlpha) throw new Error("Alpha channel lost in encoded output");
      }
      return {
        w: check.naturalWidth,
        h: check.naturalHeight,
        dstHasAlpha,
        b64: dataUrl.slice(("data:" + mime + ";base64,").length),
      };
    };

    window.__bakeTreePreview = async (layers) => {
      const imgs = await Promise.all(layers.map(async (l) => {
        const im = new Image();
        im.src = "/file?p=" + encodeURIComponent(l.fileRel);
        await im.decode();
        return { l, im };
      }));
      const c = document.createElement("canvas");
      c.width = 585;
      c.height = 1266;
      const ctx = c.getContext("2d");
      ctx.scale(1.5, 1.5);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      for (const { l, im } of imgs) {
        ctx.drawImage(im, l.x, l.y, l.w, l.h);
      }
      // Clean 3-tone palette + 3 alpha levels for crisp ~55 KB VP8L instant placeholder
      const id = ctx.getImageData(0, 0, 585, 1266);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a <= 46) {
          d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
          continue;
        }
        d[i + 3] = a < 126 ? 96 : a < 206 ? 184 : 255;
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lum < 95) { d[i] = 6; d[i + 1] = 16; d[i + 2] = 85; }
        else if (lum < 205) { d[i] = 195; d[i + 1] = 206; d[i + 2] = 255; }
        else { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; }
      }
      ctx.putImageData(id, 0, 0);
      return await window.__encodeCanvas(c, "image/webp", 1.0, true);
    };

    window.__processImage = async (rel, opts) => {
      const im = new Image();
      im.src = "/file?p=" + encodeURIComponent(rel);
      await im.decode();
      const nw = im.naturalWidth, nh = im.naturalHeight;
      if (!nw || !nh) throw new Error("Invalid natural dimensions for " + rel);

      let tw = nw, th = nh;
      if (opts.w && opts.h) {
        if (nw === opts.w && nh === opts.h && (!opts.reencodeIfLargerThanBytes || opts.currentBytes <= opts.reencodeIfLargerThanBytes)) {
          return { skipped: true, reason: "already " + nw + "x" + nh, nw, nh };
        }
        tw = opts.w;
        th = opts.h;
      } else if (opts.maxH) {
        if (nh <= opts.maxH) {
          return { skipped: true, reason: "naturalHeight <= " + opts.maxH, nw, nh };
        }
        th = opts.maxH;
        tw = Math.round((nw * opts.maxH) / nh);
      }

      let srcHasAlpha = false;
      if (opts.mime === "image/webp") {
        const sc = document.createElement("canvas");
        sc.width = nw;
        sc.height = nh;
        const sctx = sc.getContext("2d");
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(im, 0, 0);
        srcHasAlpha = window.__hasAlpha(sctx, nw, nh);
      }

      const c = document.createElement("canvas");
      c.width = tw;
      c.height = th;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (opts.mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tw, th);
      } else {
        ctx.clearRect(0, 0, tw, th);
      }
      ctx.drawImage(im, 0, 0, nw, nh, 0, 0, tw, th);

      if (opts.mime === "image/webp" && srcHasAlpha) {
        if (opts.snapWhite) {
          const id = ctx.getImageData(0, 0, tw, th);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a <= 20) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; }
            else {
              d[i] = d[i + 1] = d[i + 2] = 255;
              d[i + 3] = a < 75 ? 64 : a < 145 ? 128 : a < 210 ? 192 : 255;
            }
          }
          ctx.putImageData(id, 0, 0);
        } else if (opts.alphaMode === "err") {
          window.__errDiffAlpha(ctx, tw, th, opts.step || 24, opts.cutLow ?? 4, opts.carry ?? 0.68);
        } else if (opts.alphaMode === "quant") {
          window.__quantAlpha(ctx, tw, th, opts.step || 32, opts.cutLow ?? 8);
        }
      }

      const enc = await window.__encodeCanvas(c, opts.mime, opts.q, srcHasAlpha);
      return { skipped: false, nw, nh, tw, th, srcHasAlpha, ...enc };
    };
  })()`);

  // --- Step 1: Bake 1-file Screen-01 instant preview ---
  {
    const res = await ev(`window.__bakeTreePreview(${JSON.stringify(calmLayers)})`);
    const buf = stripWebpIccp(Buffer.from(res.b64, "base64"));
    if (!isValidWebp(buf) || buf.length === 0) {
      throw new Error("Invalid RIFF/WEBP output for assets/tree-calm-preview.webp");
    }
    const rel = "assets/tree-calm-preview.webp";
    stagedWrites.push({ absPath: join(PUBLIC, rel), rel, buf });
    report.step1_preview = {
      file: rel,
      dimensions: `${res.w}x${res.h}`,
      alpha: res.dstHasAlpha,
      bytes: buf.length,
      kb: Number((buf.length / 1024).toFixed(2)),
    };
  }

  // --- Step 2: Convert ALL 33 PNGs in public/assets/tree/*.png -> .webp (q=0.84) ---
  for (const absPng of treePngFiles) {
    const relPng = relative(PUBLIC, absPng).replace(/\\/g, "/");
    const relWebp = relPng.replace(/\.png$/i, ".webp");
    const beforeBytes = fileCache.get(relPng).length;
    const isFardots = /fardots/i.test(relPng);
    const opts = isFardots
      ? { mime: "image/webp", q: relPng.includes("wind") ? 1.0 : 0.84, snapWhite: true }
      : { mime: "image/webp", q: 0.84, alphaMode: "quant", step: 52, cutLow: 14 };
    const res = await ev(`window.__processImage(${JSON.stringify(relPng)}, ${JSON.stringify(opts)})`);
    const buf = stripWebpIccp(Buffer.from(res.b64, "base64"));
    if (!isValidWebp(buf) || buf.length === 0) {
      throw new Error(`Invalid RIFF/WEBP output for ${relWebp}`);
    }
    stagedWrites.push({ absPath: join(PUBLIC, relWebp), rel: relWebp, buf });
    stagedDeletes.push({ absPath: absPng, rel: relPng, oldBytes: beforeBytes });
    report.step2_tree.push({
      file: relWebp,
      dimensions: `${res.w}x${res.h}`,
      alpha: res.srcHasAlpha,
      beforeBytes,
      afterBytes: buf.length,
    });
  }

  // --- Step 3: Convert ALL 8 escort-*.png & wake-*.png in public/assets/birds/*.png -> .webp (q=0.88) ---
  for (const absPng of birdPngFiles) {
    const relPng = relative(PUBLIC, absPng).replace(/\\/g, "/");
    const relWebp = relPng.replace(/\.png$/i, ".webp");
    const beforeBytes = fileCache.get(relPng).length;
    const res = await ev(
      `window.__processImage(${JSON.stringify(relPng)}, { mime: "image/webp", q: 0.88, alphaMode: "quant", step: 24, cutLow: 6 })`,
    );
    const buf = stripWebpIccp(Buffer.from(res.b64, "base64"));
    if (!isValidWebp(buf) || buf.length === 0) {
      throw new Error(`Invalid RIFF/WEBP output for ${relWebp}`);
    }
    stagedWrites.push({ absPath: join(PUBLIC, relWebp), rel: relWebp, buf });
    stagedDeletes.push({ absPath: absPng, rel: relPng, oldBytes: beforeBytes });
    report.step3_birds.push({
      file: relWebp,
      dimensions: `${res.w}x${res.h}`,
      alpha: res.srcHasAlpha,
      beforeBytes,
      afterBytes: buf.length,
    });
  }

  // --- Step 4: Downscale oversized @3x/@2x WebPs and tall JPGs in-place ---
  for (const spec of RESIZE_SPECS) {
    const beforeBytes = fileCache.get(spec.rel).length;
    const res = await ev(`window.__processImage(${JSON.stringify(spec.rel)}, ${JSON.stringify({ ...spec, currentBytes: beforeBytes })})`);
    if (res.skipped) {
      report.step4_resizes.push({
        file: spec.rel,
        skipped: true,
        reason: res.reason,
        dimensions: `${res.nw}x${res.nh}`,
        beforeBytes,
        afterBytes: beforeBytes,
      });
      continue;
    }
    let buf = Buffer.from(res.b64, "base64");
    if (spec.mime === "image/webp") {
      buf = stripWebpIccp(buf);
      if (!isValidWebp(buf) || buf.length === 0) {
        throw new Error(`Invalid RIFF/WEBP output for ${spec.rel}`);
      }
    } else if (spec.mime === "image/jpeg") {
      if (!isValidJpeg(buf) || buf.length === 0) {
        throw new Error(`Invalid JPEG output for ${spec.rel}`);
      }
    }
    stagedWrites.push({ absPath: join(PUBLIC, spec.rel), rel: spec.rel, buf });
    report.step4_resizes.push({
      file: spec.rel,
      fromDimensions: `${res.nw}x${res.nh}`,
      dimensions: `${res.w}x${res.h}`,
      alpha: res.srcHasAlpha,
      beforeBytes,
      afterBytes: buf.length,
      targetMaxKB: spec.targetMaxKB ?? null,
    });
  }

  // Simulate final totals before touching disk
  const finalSizeMap = new Map();
  for (const abs of initialFiles) {
    finalSizeMap.set(relative(PUBLIC, abs).replace(/\\/g, "/"), statSync(abs).size);
  }
  for (const d of stagedDeletes) finalSizeMap.delete(d.rel);
  for (const w of stagedWrites) finalSizeMap.set(w.rel, w.buf.length);

  let projectedTotal = 0;
  let projectedAssets = 0;
  let projectedPhotos = 0;
  const finalFilesList = [];
  for (const [rel, size] of [...finalSizeMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    projectedTotal += size;
    if (rel.startsWith("assets/")) projectedAssets += size;
    else if (rel.startsWith("photos/")) projectedPhotos += size;
    finalFilesList.push({ file: rel, bytes: size });
  }

  report.projectedAssetsBytes = projectedAssets;
  report.projectedPhotosBytes = projectedPhotos;
  report.projectedTotalBytes = projectedTotal;
  report.projectedTotalMB = Number((projectedTotal / (1024 * 1024)).toFixed(3));
  report.under1_5MB = projectedTotal < 1.5 * 1024 * 1024;

  if (projectedTotal >= 1.5 * 1024 * 1024) {
    throw new Error(`Projected total size ${projectedTotal} B exceeds 1.5 MB budget!`);
  }

  if (!DRY_RUN) {
    for (const w of stagedWrites) {
      writeFileSync(w.absPath, w.buf);
      const diskSize = statSync(w.absPath).size;
      if (diskSize !== w.buf.length || diskSize === 0) {
        throw new Error(`Disk size verification failed for ${w.rel}`);
      }
    }
    for (const d of stagedDeletes) {
      unlinkSync(d.absPath);
    }

    const diskAssets = walkFiles(ASSETS);
    const diskPhotos = walkFiles(PHOTOS);
    const actualAssetsBytes = diskAssets.reduce((s, f) => s + statSync(f).size, 0);
    const actualPhotosBytes = diskPhotos.reduce((s, f) => s + statSync(f).size, 0);
    const actualTotalBytes = actualAssetsBytes + actualPhotosBytes;

    report.actualAssetsBytes = actualAssetsBytes;
    report.actualPhotosBytes = actualPhotosBytes;
    report.actualTotalBytes = actualTotalBytes;
    report.actualTotalMB = Number((actualTotalBytes / (1024 * 1024)).toFixed(3));
    report.actualFileCount = diskAssets.length + diskPhotos.length;
  }

  report.allFinalFiles = finalFilesList;
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    await cdp("Browser.close");
  } catch {}
  try {
    ws?.close();
  } catch {}
  try {
    chromeProc.kill();
  } catch {}
  try {
    server.close();
  } catch {}
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(250);
    try {
      rmSync(profDir, { recursive: true, force: true });
      if (!existsSync(profDir)) break;
    } catch {}
  }
}
