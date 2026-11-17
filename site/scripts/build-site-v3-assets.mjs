// Pre-bakes Screen 04 R1 transparent ribbon/flock sprites, Screen 04->05 Escort Bird 3-frame sprites & wakes,
// Screen 05 echo birds, and Screen 06 cropped Polaroid remakes into public/.
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const ART_DIR = "C:/Users/QL/.gemini/antigravity/brain/dd673c6e-c2ea-402c-b2ec-41e863043976";
const UP_DIR = `${ART_DIR}/.user_uploaded`;
const BIRDS_DIR = join(SITE, "public/assets/birds");
const PHOTOS_DIR = join(SITE, "public/photos");
const R1_SRC = `${ART_DIR}/scratch/redesign_04_06/build-s04-r1-ribbon.mjs`;

mkdirSync(BIRDS_DIR, { recursive: true });
mkdirSync(PHOTOS_DIR, { recursive: true });

// Copy full comparison photos for Screen 06 Easter Egg
copyFileSync(`${UP_DIR}/media_1794898306009_49ba1019.jpg`, join(PHOTOS_DIR, "polaroid-cat-full.jpg"));
copyFileSync(`${UP_DIR}/media_1794898306011_9da8986a.jpg`, join(PHOTOS_DIR, "polaroid-gd-full.jpg"));

// Extract ENGINE_JS cleanly from the approved build-s04-r1-ribbon.mjs source
const r1File = readFileSync(R1_SRC, "utf8");
const engineMatch = r1File.match(/const ENGINE_JS = `([\s\S]*?)`;\r?\n\r?\n\/\* =+/);
if (!engineMatch) throw new Error("Failed to locate ENGINE_JS in build-s04-r1-ribbon.mjs");
const ENGINE_JS = engineMatch[1].replace(/\\`/g, "`").replace(/\\\$/g, "$");

const durl = (p, mime = "image/jpeg") => `data:${mime};base64,` + readFileSync(p).toString("base64");
const CAT_B64 = durl(`${UP_DIR}/media_1794898306009_49ba1019.jpg`);
const GD_B64 = durl(`${UP_DIR}/media_1794898306011_9da8986a.jpg`);

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profDir = join(SITE, `.tmp_bake_${Date.now()}`);
mkdirSync(profDir, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>${ENGINE_JS}</script>
<script>
const R1 = window.R1;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Re-use transparent ribbon renderer without solid paintNightSky background fill
const origPaint = R1.paintNightSky;
function renderTransparentRibbon(ctx, W, H, opts) {
  const origFillRect = ctx.fillRect.bind(ctx);
  let skip = 2;
  ctx.fillRect = function(x, y, w, h) {
    if (skip > 0) { skip--; return; }
    return origFillRect(x, y, w, h);
  };
  try {
    R1.renderWindOrganzaRibbon(ctx, W, H, opts);
  } finally {
    ctx.fillRect = origFillRect;
  }
}

window.__bakeAll = async function() {
  const out = {};

  // 1) s04-r1-ribbon-bg@2x.png (780 x 1688, transparent)
  {
    const c = makeCanvas(780, 1688);
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    renderTransparentRibbon(ctx, 390, 844, {
      segA: [[-24, 742], [118, 724], [156, 586], [188, 492]],
      segB: [[188, 492], [230, 368], [296, 218], [406, 186]],
      tailHW: 68, midHW: 118, tipHW: 74,
      ySafeTop: 146, ySafeBottom: 806,
      topFadeStart: 0.88, topFadeEnd: 1.06, botFadeSoft: 44, rippleAmp: 15,
    });
    const rng = R1.mulberry32(20261124);
    const backBirds = [
      [72,  634, 42, 7, -26, 'hatch',   0.52],
      [134, 608, 46, 0, -24, 'stipple', 0.62],
      [94,  562, 46, 3, -24, 'hatch',   0.64],
      [176, 546, 52, 8, -22, 'stipple', 0.68],
      [124, 502, 48, 4, -24, 'hatch',   0.66],
      [218, 492, 54, 0, -24, 'stipple', 0.72],
      [158, 442, 50, 7, -22, 'hatch',   0.68],
      [244, 426, 50, 3, -24, 'stipple', 0.68],
      [184, 376, 48, 5, -24, 'hatch',   0.66],
      [270, 356, 48, 8, -22, 'stipple', 0.64],
      [222, 306, 46, 0, -24, 'hatch',   0.62],
      [294, 294, 44, 4, -22, 'stipple', 0.58],
      [274, 244, 42, 7, -26, 'hatch',   0.52],
      [350, 204, 34, 3, -26, 'stipple', 0.34],
    ];
    for (const [bx, by, sz, ps, rt, st, op] of backBirds) {
      R1.drawBaseOrganzaBird(ctx, { x: bx, y: by, size: sz, pose: ps, rot: rt, style: st, op }, rng, false);
    }
    out['s04-r1-ribbon-bg@2x.png'] = c.toDataURL('image/png');
  }

  // 2) s04-r1-flock-f1/f2/f3@2x.png (12 ascending foreground birds on ribbon, 3-frame wingbeat loop)
  // Note: the 2 lower lead birds (leadAmber, leadBlue) are rendered by the cross-screen Escort Bird Pair
  const baseAscBirds = [
    { x: 118, y: 576, size: 64, pose: 5, rot: -26, recipe: 3 },
    { x: 204, y: 558, size: 66, pose: 7, rot: -22, recipe: 1 },
    { x: 154, y: 492, size: 68, pose: 8, rot: -24, recipe: 0 },
    { x: 242, y: 472, size: 60, pose: 2, rot: -18, recipe: 2, flip: true },
    { x: 184, y: 412, size: 66, pose: 4, rot: -22, recipe: 1 },
    { x: 266, y: 400, size: 62, pose: 3, rot: -22, recipe: 0 },
    { x: 204, y: 336, size: 64, pose: 7, rot: -26, recipe: 0 },
    { x: 280, y: 330, size: 58, pose: 8, rot: -22, recipe: 1 },
    { x: 244, y: 270, size: 54, pose: 6, rot: -22, recipe: 2 },
    { x: 304, y: 268, size: 52, pose: 0, rot: -26, recipe: 0 },
    { x: 286, y: 222, size: 46, pose: 4, rot: -24, recipe: 3 },
    { x: 342, y: 228, size: 46, pose: 7, rot: -26, recipe: 1 },
  ];
  const poseCycles = {
    0: [0, 4, 8],
    2: [2, 6, 3],
    3: [3, 0, 5],
    4: [4, 7, 0],
    5: [5, 0, 4],
    6: [6, 8, 7],
    7: [7, 4, 0],
    8: [8, 0, 4],
  };
  for (let f = 0; f < 3; f++) {
    const c = makeCanvas(780, 1688);
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    const rng = R1.mulberry32(20261200 + f * 97);
    for (let i = 0; i < baseAscBirds.length; i++) {
      const sp = baseAscBirds[i];
      const cyc = poseCycles[sp.pose] || [sp.pose, 4, 0];
      const framePose = f === 0 ? sp.pose : cyc[(f + (i % 2)) % 3];
      const dy = f === 1 ? -1.4 : f === 2 ? 1.0 : 0;
      const dr = f === 1 ? -1.5 : f === 2 ? 1.2 : 0;
      R1.drawRealBeadedBird(ctx, { ...sp, pose: framePose, y: sp.y + dy, rot: sp.rot + dr }, rng);
    }
    out[\`s04-r1-flock-f\${f + 1}@2x.png\`] = c.toDataURL('image/png');
  }

  // 3) Escort Bird 3-frame sprites (420 x 420 @ 3x = 140x140 CSS box centered at 70,70)
  const bluePoses = [8, 4, 0];
  const amberPoses = [4, 0, 7];
  for (let f = 0; f < 3; f++) {
    const cb = makeCanvas(420, 420);
    const ctxb = cb.getContext('2d');
    ctxb.scale(3, 3);
    R1.drawRealBeadedBird(ctxb, {
      x: 70, y: 70, size: 62, pose: bluePoses[f], rot: 0, recipe: 0,
      calmOnBlue: true, boostVal: 0.10,
    }, R1.mulberry32(8801 + f * 31));
    out[\`escort-blue-f\${f + 1}@3x.png\`] = cb.toDataURL('image/png');

    const ca = makeCanvas(420, 420);
    const ctxa = ca.getContext('2d');
    ctxa.scale(3, 3);
    R1.drawRealBeadedBird(ctxa, {
      x: 70, y: 70, size: 62, pose: amberPoses[f], rot: 0, recipe: 1,
      calmOnBlue: true, boostVal: 0.12,
    }, R1.mulberry32(9901 + f * 31));
    out[\`escort-amber-f\${f + 1}@3x.png\`] = ca.toDataURL('image/png');
  }

  // 4) Short running-stitch + seed-bead trailing wakes (300 x 180 @ 3x = 100x60 CSS)
  for (const kind of ['blue', 'amber']) {
    const cw = makeCanvas(300, 180);
    const ctxw = cw.getContext('2d');
    ctxw.scale(3, 3);
    R1.drawStitchBeadWake(ctxw, 86, 30, Math.PI, kind === 'blue' ? 'peacock' : 'amber', 42, 0.96, true);
    out[\`wake-\${kind}@3x.png\`] = cw.toDataURL('image/png');
  }

  // 5) Screen 05 subtle mist-silver echo birds (240 x 240 @ 2x = 120x120 CSS)
  {
    const ce = makeCanvas(240, 240);
    const ctxe = ce.getContext('2d');
    ctxe.scale(2, 2);
    const rng = R1.mulberry32(20261205);
    R1.drawBaseOrganzaBird(ctxe, { x: 42, y: 44, size: 54, pose: 7, rot: -26, style: 'hatch', op: 0.36 }, rng, true);
    R1.drawBaseOrganzaBird(ctxe, { x: 74, y: 74, size: 38, pose: 3, rot: -18, style: 'stipple', op: 0.28 }, rng, true);
    out['s05-echo-birds@2x.png'] = ce.toDataURL('image/png');
  }

  // 6) Screen 06 clean bottom-half Polaroid remake crops
  async function sliceBottomHalf(srcDataUrl, fallbackRatio) {
    const im = new Image();
    im.src = srcDataUrl;
    await im.decode();
    const w = im.naturalWidth, h = im.naturalHeight;
    const sc = makeCanvas(w, h);
    const sctx = sc.getContext('2d');
    sctx.drawImage(im, 0, 0);
    const data = sctx.getImageData(0, 0, w, h).data;
    const yStart = Math.round(h * 0.44);
    const yEnd = Math.round(h * 0.56);
    let bestY = Math.round(h * fallbackRatio), bestDiff = -1;
    for (let y = yStart; y < yEnd; y++) {
      let sum = 0;
      for (let x = 0; x < w; x += 2) {
        const i0 = (y * w + x) * 4, i1 = ((y + 1) * w + x) * 4;
        sum += Math.abs(data[i0] - data[i1]) + Math.abs(data[i0 + 1] - data[i1 + 1]) + Math.abs(data[i0 + 2] - data[i1 + 2]);
      }
      if (sum > bestDiff) { bestDiff = sum; bestY = y; }
    }
    const sy = bestY + 4, sh = h - sy;
    const cc = makeCanvas(w, sh);
    cc.getContext('2d').drawImage(im, 0, sy, w, sh, 0, 0, w, sh);
    return cc.toDataURL('image/png');
  }

  out['__catRemake'] = await sliceBottomHalf(${JSON.stringify(CAT_B64)}, 0.50);
  out['__gdRemake'] = await sliceBottomHalf(${JSON.stringify(GD_B64)}, 0.50);
  return out;
};
</script></body></html>`;

const htmlPath = join(profDir, "bake.html");
writeFileSync(htmlPath, html, "utf8");

const chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--remote-debugging-port=0", `--user-data-dir=${profDir}`, "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Chrome startup timeout")), 15000);
  chromeProc.stderr.on("data", (d) => {
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(d.toString());
    if (m) { clearTimeout(timer); resolve(Number(m[1])); }
  });
});

let ws, idSeq = 1;
const pending = new Map();
const cdp = (m, p = {}) => new Promise((resolve, reject) => {
  const id = idSeq++; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});

try {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
      if (m.error) reject(m.error); else resolve(m.result);
    }
  });
  await cdp("Page.enable");
  await cdp("Page.navigate", { url: "file:///" + htmlPath.replace(/\\/g, "/") });
  await new Promise((r) => setTimeout(r, 800));

  const res = await cdp("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: "window.__bakeAll()",
  });
  const data = res.result.value;
  for (const [k, durlStr] of Object.entries(data)) {
    const b64 = durlStr.replace(/^data:image\/png;base64,/, "");
    const targetPath = k === "__catRemake"
      ? join(PHOTOS_DIR, "polaroid-cat-remake.png")
      : k === "__gdRemake"
        ? join(PHOTOS_DIR, "polaroid-gd-remake.png")
        : join(BIRDS_DIR, k);
    writeFileSync(targetPath, Buffer.from(b64, "base64"));
  }
  console.log("Pre-baked assets:", Object.keys(data).length);
} finally {
  try { ws?.close(); } catch {}
  try { chromeProc.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 900));
  try { rmSync(profDir, { recursive: true, force: true }); } catch {}
}
