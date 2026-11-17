// Pure-JS ISO/IEC 18004 QR encoder + headless Chrome Canvas generator & Chromium BarcodeDetector verifier.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(SITE, "..");
const PREVIEW_DIR = join(WT, "preview");
const ART_DIR = "C:/Users/QL/.gemini/antigravity/brain/dd673c6e-c2ea-402c-b2ec-41e863043976";
const DESIGN_FONTS = join(WT, "design/fonts/_src");
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "https://ericlang369-glitch.github.io/All-Romance/";

mkdirSync(PREVIEW_DIR, { recursive: true });

// ============================================================================
// Pure-JS ISO/IEC 18004 QR Code Encoder (Versions 3 & 4, Byte Mode, EC M & Q)
// ============================================================================
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let v = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v;
    GF_EXP[i + 255] = v;
    GF_LOG[v] = i;
    v <<= 1;
    if (v & 0x100) v ^= 0x11d;
  }
}

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(dataBytes, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const buf = new Uint8Array(dataBytes.length + ecCount);
  buf.set(dataBytes, 0);
  for (let i = 0; i < dataBytes.length; i++) {
    const coef = buf[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        buf[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return buf.slice(dataBytes.length);
}

// ISO/IEC 18004 Table 7 & Table 9 specifications for Versions 3 & 4 (M / Q)
const QR_SPECS = {
  "3-M": { version: 3, ecLevel: "M", ecBits: 0b00, totalCW: 70, ecPerBlock: 26, blocks: [{ count: 1, dataCW: 44 }], align: [6, 22], remainder: 7 },
  "3-Q": { version: 3, ecLevel: "Q", ecBits: 0b11, totalCW: 70, ecPerBlock: 18, blocks: [{ count: 2, dataCW: 17 }], align: [6, 22], remainder: 7 },
  "4-M": { version: 4, ecLevel: "M", ecBits: 0b00, totalCW: 100, ecPerBlock: 18, blocks: [{ count: 2, dataCW: 32 }], align: [6, 26], remainder: 7 },
  "4-Q": { version: 4, ecLevel: "Q", ecBits: 0b11, totalCW: 100, ecPerBlock: 26, blocks: [{ count: 2, dataCW: 24 }], align: [6, 26], remainder: 7 },
};

function encodeByteCodewords(bytes, totalDataCW) {
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  // Mode 0100 (Byte), 8-bit character count (Versions 1..9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = totalDataCW * 8;
  if (bits.length > maxBits) {
    throw new Error(`Payload (${bits.length} bits) exceeds capacity (${maxBits} bits)`);
  }
  // Terminator (up to 4 zero bits)
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    cw.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (cw.length < totalDataCW) {
    cw.push(padBytes[padIdx % 2]);
    padIdx++;
  }
  return new Uint8Array(cw);
}

function buildFinalBitStream(text, specKey = "4-Q") {
  const spec = QR_SPECS[specKey];
  if (!spec) throw new Error(`Unsupported QR spec ${specKey}`);
  const payload = new TextEncoder().encode(text);
  const totalDataCW = spec.blocks.reduce((sum, g) => sum + g.count * g.dataCW, 0);
  const dataCW = encodeByteCodewords(payload, totalDataCW);

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const g of spec.blocks) {
    for (let b = 0; b < g.count; b++) {
      const slice = dataCW.slice(offset, offset + g.dataCW);
      offset += g.dataCW;
      dataBlocks.push(slice);
      ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
    }
  }

  const interleaved = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) if (i < blk.length) interleaved.push(blk[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const blk of ecBlocks) if (i < blk.length) interleaved.push(blk[i]);
  }

  const bits = [];
  for (const byte of interleaved) {
    for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
  }
  for (let i = 0; i < spec.remainder; i++) bits.push(0);
  return { spec, bits };
}

function formatInfoBits(ecBits, mask) {
  const data = (ecBits << 3) | mask;
  let rem = data << 10;
  for (let shift = 4; shift >= 0; shift--) {
    if ((rem >> (shift + 10)) & 1) {
      rem ^= 0x537 << shift;
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r, _c) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function evaluatePenalty(mat) {
  const N = mat.length;
  let score = 0;

  // Rule 1: 5+ consecutive same-color modules in rows & cols
  for (let r = 0; r < N; r++) {
    let runColor = mat[r][0], runLen = 1;
    for (let c = 1; c < N; c++) {
      if (mat[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = mat[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  for (let c = 0; c < N; c++) {
    let runColor = mat[0][c], runLen = 1;
    for (let r = 1; r < N; r++) {
      if (mat[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = mat[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 same-color blocks
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N - 1; c++) {
      const v = mat[r][c];
      if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3: 1:1:3:1:1 finder-like ratios with 4 light modules on either side
  const pA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c <= N - 11; c++) {
      let okA = true, okB = true;
      for (let k = 0; k < 11; k++) {
        if (mat[r][c + k] !== pA[k]) okA = false;
        if (mat[r][c + k] !== pB[k]) okB = false;
      }
      if (okA) score += 40;
      if (okB) score += 40;
    }
  }
  for (let c = 0; c < N; c++) {
    for (let r = 0; r <= N - 11; r++) {
      let okA = true, okB = true;
      for (let k = 0; k < 11; k++) {
        if (mat[r + k][c] !== pA[k]) okA = false;
        if (mat[r + k][c] !== pB[k]) okB = false;
      }
      if (okA) score += 40;
      if (okB) score += 40;
    }
  }

  // Rule 4: dark module balance around 50%
  let dark = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) dark += mat[r][c];
  const pct = (dark * 100) / (N * N);
  const steps = Math.floor(Math.abs(pct - 50) / 5);
  score += steps * 10;

  return score;
}

function encodeQR(text, specKey = "4-Q") {
  const { spec, bits } = buildFinalBitStream(text, specKey);
  const N = 17 + 4 * spec.version;
  const base = Array.from({ length: N }, () => new Uint8Array(N));
  const isFunc = Array.from({ length: N }, () => new Uint8Array(N));

  const setFunc = (r, c, val) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      base[r][c] = val ? 1 : 0;
      isFunc[r][c] = 1;
    }
  };

  // Finder patterns + 1px light separators
  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= N || c < 0 || c >= N) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist === 3 || dist <= 1;
        setFunc(r, c, dist === 4 ? 0 : dark ? 1 : 0);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // Alignment patterns
  for (const ar of spec.align) {
    for (const ac of spec.align) {
      let overlaps = false;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (isFunc[ar + dr][ac + dc]) overlaps = true;
        }
      }
      if (overlaps) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(ar + dr, ac + dc, dist === 2 || dist === 0 ? 1 : 0);
        }
      }
    }
  }

  // Timing strips
  for (let i = 8; i < N - 8; i++) {
    setFunc(6, i, i % 2 === 0 ? 1 : 0);
    setFunc(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Dark module
  setFunc(4 * spec.version + 9, 8, 1);

  // Reserve format info cells
  const reserveFormat = () => {
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) setFunc(8, i, 0);
      if (i !== 6) setFunc(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) setFunc(8, N - 1 - i, 0);
    for (let i = 0; i < 7; i++) setFunc(N - 1 - i, 8, 0);
  };
  reserveFormat();

  // Place data + EC + remainder bits in zigzag
  let bitIdx = 0;
  let dirUp = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < N; step++) {
      const r = dirUp ? N - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (!isFunc[r][c]) {
          base[r][c] = bitIdx < bits.length ? bits[bitIdx++] : 0;
        }
      }
    }
    dirUp = !dirUp;
  }
  if (bitIdx !== bits.length) {
    throw new Error(`Placed ${bitIdx} bits, expected ${bits.length}`);
  }

  const applyMaskAndFormat = (maskIdx) => {
    const mat = base.map((row) => new Uint8Array(row));
    const fn = MASK_FNS[maskIdx];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!isFunc[r][c] && fn(r, c)) mat[r][c] ^= 1;
      }
    }
    const fmt = formatInfoBits(spec.ecBits, maskIdx);
    const bitAt = (k) => (fmt >> k) & 1;

    // Copy 1 (around top-left)
    const tlCoords = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    ];
    for (let idx = 0; idx < 15; idx++) {
      const [r, c] = tlCoords[idx];
      mat[r][c] = bitAt(14 - idx);
    }

    // Copy 2 (bottom-left + top-right)
    for (let idx = 0; idx < 7; idx++) mat[N - 1 - idx][8] = bitAt(14 - idx);
    for (let idx = 0; idx < 8; idx++) mat[8][N - 8 + idx] = bitAt(7 - idx);

    return mat;
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = null;
  for (let m = 0; m < 8; m++) {
    const candidate = applyMaskAndFormat(m);
    const p = evaluatePenalty(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
      bestMatrix = candidate;
    }
  }

  return {
    version: spec.version,
    ecLevel: spec.ecLevel,
    size: N,
    mask: bestMask,
    penalty: bestPenalty,
    matrix: bestMatrix,
  };
}

// ============================================================================
// Headless Chrome Canvas Rendering & BarcodeDetector Verification
// ============================================================================
const qr = encodeQR(TARGET_URL, "4-M");
const matrixJson = JSON.stringify(qr.matrix.map((row) => Array.from(row)));

const profDir = join(SITE, `.tmp_qr_${Date.now()}`);
mkdirSync(profDir, { recursive: true });

const chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--remote-debugging-port=0", `--user-data-dir=${profDir}`, "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

let ws;
const pending = new Map();
let idSeq = 1;

const cdp = (m, p = {}) => new Promise((resolve, reject) => {
  const id = idSeq++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});
const ev = async (expr) => {
  const res = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
  return res.result?.value;
};

try {
  const port = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Chrome startup timeout")), 15000);
    chromeProc.stderr.on("data", (d) => {
      const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(d.toString());
      if (m) { clearTimeout(t); resolve(Number(m[1])); }
    });
  });

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (msg) => {
    const m = JSON.parse(msg.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(m.error); else resolve(m.result);
    }
  });

  await cdp("Page.enable");
  await cdp("Runtime.enable");

  const fontFileUrl = (p) => "file:///" + p.replace(/\\/g, "/");
  const htmlPath = join(profDir, "qr-render.html");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
@font-face { font-family: "CardMontserrat"; src: url("${fontFileUrl(join(DESIGN_FONTS, "Montserrat[wght].ttf"))}") format("truetype"); font-weight: 400 800; }
@font-face { font-family: "CardSourceSerif"; src: url("${fontFileUrl(join(DESIGN_FONTS, "SourceSerif4-Italic[opsz,wght].ttf"))}") format("truetype"); font-weight: 400 800; font-style: italic; }
@font-face { font-family: "CardSourceSerifReg"; src: url("${fontFileUrl(join(DESIGN_FONTS, "SourceSerif4[opsz,wght].ttf"))}") format("truetype"); font-weight: 400 800; font-style: normal; }
@font-face { font-family: "CardNotoSerif"; src: url("file:///C:/Windows/Fonts/NotoSerifSC-VF.ttf") format("truetype"); font-weight: 400 900; }
@font-face { font-family: "CardNotoSans"; src: url("file:///C:/Windows/Fonts/NotoSansSC-VF.ttf") format("truetype"); font-weight: 400 900; }
body { margin: 0; background: #000; }
</style>
</head>
<body>
<script>
window.renderAll = async (matrix) => {
  await document.fonts.ready;
  const N = matrix.length;

  // 1) Pure 1024x1024 QR (cell = 24px -> 792px code + 116px quiet zone = 4.83 modules on every side)
  const pureCanvas = document.createElement("canvas");
  pureCanvas.width = 1024;
  pureCanvas.height = 1024;
  const pCtx = pureCanvas.getContext("2d");
  pCtx.imageSmoothingEnabled = false;
  pCtx.fillStyle = "#FFFFFF";
  pCtx.fillRect(0, 0, 1024, 1024);

  const pCell = 24;
  const pOffset = Math.floor((1024 - N * pCell) / 2); // 116px
  pCtx.fillStyle = "#0D1538";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        pCtx.fillRect(pOffset + c * pCell, pOffset + r * pCell, pCell, pCell);
      }
    }
  }

  // 2) 900x1200 Klein Blue x Warm Champagne Memorial Card
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = 900;
  cardCanvas.height = 1200;
  const ctx = cardCanvas.getContext("2d");

  // Klein Blue atmospheric gradient
  const bgGrad = ctx.createRadialGradient(450, 510, 60, 450, 560, 780);
  bgGrad.addColorStop(0, "#1C3CE0");
  bgGrad.addColorStop(0.55, "#1430C4");
  bgGrad.addColorStop(1, "#0B1E8C");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 900, 1200);

  // Warm Champagne dawn aura behind the QR card
  const aura = ctx.createRadialGradient(450, 610, 40, 450, 610, 420);
  aura.addColorStop(0, "rgba(246, 222, 194, 0.22)");
  aura.addColorStop(0.65, "rgba(246, 222, 194, 0.06)");
  aura.addColorStop(1, "rgba(246, 222, 194, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 900, 1200);

  // Subtle champagne double hairline frame
  ctx.strokeStyle = "rgba(246, 222, 194, 0.30)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, 828, 1128);
  ctx.strokeStyle = "rgba(246, 222, 194, 0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, 804, 1104);

  // Minimal corner stars
  const drawStar = (cx, cy, r, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.fill();
    ctx.restore();
  };
  drawStar(154, 134, 6, "rgba(246, 222, 194, 0.72)");
  drawStar(746, 134, 6, "rgba(246, 222, 194, 0.72)");
  drawStar(450, 98, 8, "rgba(246, 222, 194, 0.85)");

  // Top date badge: 0825 — 1203
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F6DEC2";
  ctx.font = "600 24px CardMontserrat, sans-serif";
  const drawSpacedText = (text, cx, cy, tracking) => {
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
    let x = cx - totalW / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x + widths[i] / 2, cy);
      x += widths[i] + tracking;
    }
  };
  drawSpacedText("0825 — 1203", 450, 144, 6.5);

  // Subtle decorative horizontal hairlines flanking date
  ctx.strokeStyle = "rgba(246, 222, 194, 0.36)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(190, 144); ctx.lineTo(286, 144);
  ctx.moveTo(614, 144); ctx.lineTo(710, 144);
  ctx.stroke();

  // Dear ERIS · 陈玺羽
  ctx.fillStyle = "#FFFDF9";
  ctx.font = "italic 600 48px CardSourceSerif, Georgia, serif";
  const dearW = ctx.measureText("Dear ").width;
  ctx.font = "700 46px CardSourceSerifReg, Georgia, serif";
  const erisW = ctx.measureText("ERIS").width;
  ctx.font = "600 42px CardNotoSerif, serif";
  const midW = ctx.measureText(" · ").width;
  const cnW = ctx.measureText("陈玺羽").width;
  const titleTotal = dearW + erisW + midW + cnW;
  let tx = 450 - titleTotal / 2;
  ctx.textAlign = "left";
  ctx.font = "italic 600 48px CardSourceSerif, Georgia, serif";
  ctx.fillStyle = "#F6DEC2";
  ctx.fillText("Dear ", tx, 226); tx += dearW;
  ctx.font = "700 46px CardSourceSerifReg, Georgia, serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("ERIS", tx, 226); tx += erisW;
  ctx.font = "600 42px CardNotoSerif, serif";
  ctx.fillStyle = "rgba(246, 222, 194, 0.85)";
  ctx.fillText(" · ", tx, 226); tx += midW;
  ctx.fillStyle = "#FFFDF9";
  ctx.fillText("陈玺羽", tx, 224);

  // Subtitle line
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(246, 222, 194, 0.78)";
  ctx.font = "500 18px CardMontserrat, CardNotoSans, sans-serif";
  drawSpacedText("ONE HUNDRED DAYS · ALL-ROMANCE", 450, 280, 4.2);

  // Crisp White Matte Frame around QR (600x600 at (150, 332)) — spotless pure #FFFFFF quiet zone
  const cardX = 150, cardY = 332, cardW = 600, cardH = 600;
  ctx.save();
  ctx.shadowColor = "rgba(5, 15, 80, 0.45)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 12);
  ctx.fill();
  ctx.restore();

  // Integer-snapped QR inside white card: cell = 14px -> 33*14 = 462px, 69px quiet zone (~4.93 modules) on every side!
  const cCell = 14;
  const cSide = N * cCell; // 462
  const cOffsetX = cardX + Math.floor((cardW - cSide) / 2); // 150 + 69 = 219
  const cOffsetY = cardY + Math.floor((cardH - cSide) / 2); // 332 + 69 = 401
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0D1538";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(cOffsetX + c * cCell, cOffsetY + r * cCell, cCell, cCell);
      }
    }
  }

  // Bottom prompt: 微信扫一扫 · 开启第 100 天纪念页
  ctx.textAlign = "center";
  ctx.fillStyle = "#F6DEC2";
  ctx.font = "600 28px CardNotoSans, CardMontserrat, sans-serif";
  drawSpacedText("微信扫一扫 · 开启第 100 天纪念页", 450, 1020, 2.2);

  // Subtle URL footer
  ctx.fillStyle = "rgba(246, 222, 194, 0.62)";
  ctx.font = "500 17px CardMontserrat, sans-serif";
  drawSpacedText("ERICLANG369-GLITCH.GITHUB.IO/ALL-ROMANCE", 450, 1076, 2.0);

  return {
    pureDataUrl: pureCanvas.toDataURL("image/png"),
    cardDataUrl: cardCanvas.toDataURL("image/png"),
    geometry: {
      N,
      pure: { offset: pOffset, cell: pCell, quietModules: +(pOffset / pCell).toFixed(2) },
      card: { offsetX: cOffsetX, offsetY: cOffsetY, cell: cCell, quietModules: +((cOffsetX - cardX) / cCell).toFixed(2) },
    },
  };
};

window.verifyImage = async (dataUrl, matrix, expectedUrl) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { width: W, height: H } = c;
  const imgData = ctx.getImageData(0, 0, W, H).data;

  const isDarkPx = (x, y) => {
    const i = (y * W + x) * 4;
    const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
    return lum < 95 && imgData[i + 2] < 110;
  };
  const isWhitePx = (x, y) => {
    const i = (y * W + x) * 4;
    return imgData[i] > 235 && imgData[i + 1] > 235 && imgData[i + 2] > 235;
  };

  // 1) Blindly locate top-left finder pattern via 1:1:3:1:1 horizontal run scan
  let tlFinder = null;
  outer: for (let y = 0; y < Math.floor(H * 0.6); y += 2) {
    const runs = [];
    let cur = isDarkPx(0, y), len = 0, startX = 0;
    for (let x = 0; x < W; x++) {
      const d = isDarkPx(x, y);
      if (d === cur) {
        len++;
      } else {
        runs.push({ dark: cur, start: startX, len });
        cur = d; startX = x; len = 1;
      }
    }
    runs.push({ dark: cur, start: startX, len });
    for (let i = 0; i <= runs.length - 5; i++) {
      if (!runs[i].dark || runs[i + 1].dark || !runs[i + 2].dark || runs[i + 3].dark || !runs[i + 4].dark) continue;
      const w0 = runs[i].len, w1 = runs[i + 1].len, w2 = runs[i + 2].len, w3 = runs[i + 3].len, w4 = runs[i + 4].len;
      const unit = (w0 + w1 + w2 + w3 + w4) / 7;
      if (unit < 4) continue;
      const tol = unit * 0.35;
      if (Math.abs(w0 - unit) < tol && Math.abs(w1 - unit) < tol && Math.abs(w2 - 3 * unit) < 2 * tol && Math.abs(w3 - unit) < tol && Math.abs(w4 - unit) < tol) {
        // Verify full vertical 1:1:3:1:1 through center of finder (cx)
        const cx = Math.floor(runs[i + 2].start + w2 / 2);
        let topY = y, botY = y;
        while (topY > 0 && isDarkPx(cx, topY - 1)) topY--;
        while (botY < H - 1 && isDarkPx(cx, botY + 1)) botY++;
        const centerH = botY - topY + 1;
        if (Math.abs(centerH - 3 * unit) < 2 * tol) {
          // Walk up: 1u white gap, then 1u top dark bar, then white quiet zone
          let k = topY - 1;
          while (k > 0 && !isDarkPx(cx, k)) k--;
          const gapTop = topY - 1 - k;
          if (k <= 0 || Math.abs(gapTop - unit) >= tol) continue;
          const barTopEnd = k;
          while (k > 0 && isDarkPx(cx, k)) k--;
          const barTop = barTopEnd - k;
          if (Math.abs(barTop - unit) >= tol || !isWhitePx(cx, k)) continue;
          const finderTop = k + 1;

          // Walk down: 1u white gap, then 1u bottom dark bar, then white quiet zone
          let m = botY + 1;
          while (m < H - 1 && !isDarkPx(cx, m)) m++;
          const gapBot = m - (botY + 1);
          if (m >= H - 1 || Math.abs(gapBot - unit) >= tol) continue;
          const barBotStart = m;
          while (m < H - 1 && isDarkPx(cx, m)) m++;
          const barBot = m - barBotStart;
          if (Math.abs(barBot - unit) >= tol || !isWhitePx(cx, m)) continue;

          const finderLeft = runs[i].start;
          if (!isWhitePx(finderLeft - 1, finderTop + Math.floor(unit * 0.5))) continue;
          const cell = Math.round((w0 + w1 + w2 + w3 + w4) / 7);
          tlFinder = { left: finderLeft, top: finderTop, cell };
          break outer;
        }
      }
    }
  }
  if (!tlFinder) throw new Error("Finder pattern detection failed in PNG pixels");

  const { left: ox, top: oy, cell } = tlFinder;
  // Detect right edge of top-right finder via 1:1:3:1:1 along finder center row (ignoring outer card border)
  const centerY = oy + Math.floor(cell * 3.5);
  const centerRuns = [];
  {
    let cur = isDarkPx(0, centerY), len = 0, startX = 0;
    for (let x = 0; x < W; x++) {
      const d = isDarkPx(x, centerY);
      if (d === cur) len++;
      else { centerRuns.push({ dark: cur, start: startX, len }); cur = d; startX = x; len = 1; }
    }
    centerRuns.push({ dark: cur, start: startX, len });
  }
  let trEnd = -1;
  for (let i = 0; i <= centerRuns.length - 5; i++) {
    if (!centerRuns[i].dark || centerRuns[i + 1].dark || !centerRuns[i + 2].dark || centerRuns[i + 3].dark || !centerRuns[i + 4].dark) continue;
    const w0 = centerRuns[i].len, w1 = centerRuns[i + 1].len, w2 = centerRuns[i + 2].len, w3 = centerRuns[i + 3].len, w4 = centerRuns[i + 4].len;
    const tol = cell * 0.4;
    if (Math.abs(w0 - cell) < tol && Math.abs(w1 - cell) < tol && Math.abs(w2 - 3 * cell) < 2 * tol && Math.abs(w3 - cell) < tol && Math.abs(w4 - cell) < tol) {
      if (centerRuns[i].start > ox + 10 * cell) {
        trEnd = centerRuns[i + 4].start + w4;
      }
    }
  }
  if (trEnd < 0) throw new Error("Top-right finder detection failed: " + JSON.stringify({ tlFinder, centerY, centerRuns: centerRuns.slice(-12) }));
  const N = Math.round((trEnd - ox) / cell);

  // Check >= 4-module white quiet zone around all 4 sides
  const qzPx = 4 * cell;
  let quietViolations = 0;
  for (let y = oy - qzPx; y < oy + N * cell + qzPx; y += 2) {
    for (let x = ox - qzPx; x < ox + N * cell + qzPx; x += 2) {
      const inCode = x >= ox && x < ox + N * cell && y >= oy && y < oy + N * cell;
      if (!inCode && !isWhitePx(x, y)) quietViolations++;
    }
  }

  // Sample N x N grid blindly from image pixels
  const sampled = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, col) => (isDarkPx(ox + col * cell + Math.floor(cell / 2), oy + r * cell + Math.floor(cell / 2)) ? 1 : 0))
  );

  // Cross-check sampled matrix against expected matrix too
  let mismatches = 0;
  if (N !== matrix.length) mismatches = 9999;
  else {
    for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) if (sampled[r][col] !== matrix[r][col]) mismatches++;
  }

  // Full ISO/IEC 18004 pixel-to-URL decode (blindly from sampled pixels)
  const readFmt = (coords) => {
    let v = 0;
    for (const [r, col] of coords) v = (v << 1) | sampled[r][col];
    return v;
  };
  const fmt1 = readFmt([
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]);
  const fmt2Coords = [
    [N - 1, 8], [N - 2, 8], [N - 3, 8], [N - 4, 8], [N - 5, 8], [N - 6, 8], [N - 7, 8],
    [8, N - 8], [8, N - 7], [8, N - 6], [8, N - 5], [8, N - 4], [8, N - 3], [8, N - 2], [8, N - 1],
  ];
  const fmt2 = readFmt(fmt2Coords);
  if (fmt1 !== fmt2) throw new Error("Format info copies differ: " + fmt1 + " vs " + fmt2);

  const rawFmt = fmt1 ^ 0x5412;
  let bchRem = rawFmt;
  for (let shift = 4; shift >= 0; shift--) {
    if ((bchRem >> (shift + 10)) & 1) bchRem ^= 0x537 << shift;
  }
  if (bchRem !== 0) throw new Error("Format info BCH(15,5) check failed: rem=" + bchRem);
  const fmtData = rawFmt >> 10;
  const ecBits = (fmtData >> 3) & 0b11;
  const maskId = fmtData & 0b111;

  // Build function mask independently for N=33 (V4)
  const isFunc = Array.from({ length: N }, () => new Uint8Array(N));
  const markRect = (r0, c0, h, w) => {
    for (let r = Math.max(0, r0); r < Math.min(N, r0 + h); r++) {
      for (let col = Math.max(0, c0); col < Math.min(N, c0 + w); col++) isFunc[r][col] = 1;
    }
  };
  markRect(0, 0, 9, 9);
  markRect(0, N - 8, 9, 8);
  markRect(N - 8, 0, 8, 9);
  markRect(24, 24, 5, 5); // V4 alignment (26,26)
  for (let i = 0; i < N; i++) { isFunc[6][i] = 1; isFunc[i][6] = 1; }

  const maskFns = [
    (r, col) => (r + col) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, col) => col % 3 === 0,
    (r, col) => (r + col) % 3 === 0,
    (r, col) => (Math.floor(r / 2) + Math.floor(col / 3)) % 2 === 0,
    (r, col) => ((r * col) % 2) + ((r * col) % 3) === 0,
    (r, col) => (((r * col) % 2) + ((r * col) % 3)) % 2 === 0,
    (r, col) => (((r + col) % 2) + ((r * col) % 3)) % 2 === 0,
  ];
  const mfn = maskFns[maskId];
  const bits = [];
  let dirUp = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < N; step++) {
      const r = dirUp ? N - 1 - step : step;
      for (const cc of [col, col - 1]) {
        if (!isFunc[r][cc]) {
          bits.push(sampled[r][cc] ^ (mfn(r, cc) ? 1 : 0));
        }
      }
    }
    dirUp = !dirUp;
  }

  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }

  // De-interleave V4-M (ecBits === 0b00): 2 blocks * (32 data + 18 EC)
  if (ecBits !== 0b00 || cw.length !== 100) {
    throw new Error("Unexpected ecBits=" + ecBits + ", cw.length=" + cw.length);
  }
  const blkData = [[], []], blkEc = [[], []];
  for (let i = 0; i < 64; i++) blkData[i % 2].push(cw[i]);
  for (let i = 64; i < 100; i++) blkEc[(i - 64) % 2].push(cw[i]);

  // Verify Reed-Solomon syndromes over GF(256) 0x11D for both blocks
  const exp = new Uint8Array(512), log = new Uint8Array(256);
  for (let i = 0, v = 1; i < 255; i++) {
    exp[i] = v; exp[i + 255] = v; log[v] = i;
    v <<= 1; if (v & 0x100) v ^= 0x11d;
  }
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);
  const maxSyndromes = [];
  for (let b = 0; b < 2; b++) {
    const full = [...blkData[b], ...blkEc[b]];
    for (let s = 0; s < 18; s++) {
      let acc = 0;
      const root = exp[s];
      for (const coef of full) acc = mul(acc, root) ^ coef;
      if (acc !== 0) throw new Error("RS syndrome non-zero on block " + b + ", s=" + s + ": " + acc);
      maxSyndromes.push(acc);
    }
  }

  // Decode Byte mode stream from interleaved data blocks
  const dataBits = [];
  for (const byte of [...blkData[0], ...blkData[1]]) {
    for (let k = 7; k >= 0; k--) dataBits.push((byte >> k) & 1);
  }
  const readN = (pos, n) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | dataBits[pos + i];
    return v;
  };
  const mode = readN(0, 4);
  const len = readN(4, 8);
  if (mode !== 0b0100) throw new Error("Expected Byte mode (4), got " + mode);
  const outBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) outBytes[i] = readN(12 + i * 8, 8);
  const decodedUrl = new TextDecoder().decode(outBytes);
  if (decodedUrl !== expectedUrl) {
    throw new Error("Decoded URL mismatch: " + decodedUrl + " !== " + expectedUrl);
  }

  let barcodeDetectorSupported = typeof window.BarcodeDetector === "function";
  let detected = [];
  if (barcodeDetectorSupported) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const bd = new window.BarcodeDetector({ formats: ["qr_code"] });
        const bmp = await createImageBitmap(img);
        const res = await bd.detect(bmp);
        detected = res.map((r) => ({ rawValue: r.rawValue, format: r.format }));
        bmp.close();
      } else {
        barcodeDetectorSupported = false;
      }
    } catch (e) {
      detected = [{ error: String(e) }];
    }
  }

  return {
    width: W,
    height: H,
    detectedOrigin: { ox, oy, cell, N },
    mismatches,
    quietViolations,
    formatDecoded: { ecLevel: "M", maskId, bchRem },
    rsSyndromesAllZero: maxSyndromes.every((x) => x === 0),
    decodedUrl,
    barcodeDetectorSupported,
    detected,
  };
};
</script>
</body>
</html>`;
  writeFileSync(htmlPath, html, "utf8");
  await cdp("Page.navigate", { url: "file:///" + htmlPath.replace(/\\/g, "/") });
  await new Promise((r) => setTimeout(r, 500));

  const rendered = await ev(`window.renderAll(${matrixJson})`);
  const purePath = join(PREVIEW_DIR, "qr-all-romance-pure.png");
  const cardPath = join(PREVIEW_DIR, "qr-all-romance-card.png");

  const writeDataUrl = (outPath, dataUrl) => {
    const b64 = dataUrl.split(",")[1];
    writeFileSync(outPath, Buffer.from(b64, "base64"));
  };
  writeDataUrl(purePath, rendered.pureDataUrl);
  writeDataUrl(cardPath, rendered.cardDataUrl);

  const g = rendered.geometry;
  const verifyPure = await ev(`window.verifyImage(${JSON.stringify(rendered.pureDataUrl)}, ${matrixJson}, ${JSON.stringify(TARGET_URL)})`);
  const verifyCard = await ev(`window.verifyImage(${JSON.stringify(rendered.cardDataUrl)}, ${matrixJson}, ${JSON.stringify(TARGET_URL)})`);

  if (verifyPure.mismatches !== 0 || verifyPure.quietViolations !== 0) {
    throw new Error("Pure QR matrix/quiet-zone check failed: " + JSON.stringify(verifyPure));
  }
  if (verifyCard.mismatches !== 0 || verifyCard.quietViolations !== 0) {
    throw new Error("Card QR matrix/quiet-zone check failed: " + JSON.stringify(verifyCard));
  }
  if (verifyPure.barcodeDetectorSupported) {
    if (!verifyPure.detected.some((d) => d.rawValue === TARGET_URL)) {
      throw new Error("BarcodeDetector failed on pure QR: " + JSON.stringify(verifyPure));
    }
  }
  if (verifyCard.barcodeDetectorSupported) {
    if (!verifyCard.detected.some((d) => d.rawValue === TARGET_URL)) {
      throw new Error("BarcodeDetector failed on card QR: " + JSON.stringify(verifyCard));
    }
  }

  if (existsSync(ART_DIR)) {
    copyFileSync(purePath, join(ART_DIR, "qr-all-romance-pure.png"));
    copyFileSync(cardPath, join(ART_DIR, "qr-all-romance-card.png"));
  }

  console.log(JSON.stringify({
    targetUrl: TARGET_URL,
    qrSpec: { version: qr.version, ecLevel: qr.ecLevel, size: qr.size, mask: qr.mask, penalty: qr.penalty },
    geometry: rendered.geometry,
    verifyPure,
    verifyCard,
    outputs: [purePath, cardPath],
  }, null, 2));
} finally {
  try { ws?.close(); } catch {}
  try { chromeProc.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try { rmSync(profDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 }); } catch {}
}
