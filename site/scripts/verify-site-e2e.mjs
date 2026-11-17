// End-to-end headless Chrome CDP verification:
// Primary WeChat iPhone 393x704 @3x pass (11-frame wechat-704p-01-to-07-verified.png)
// + Reference 390x844 @2x pass (live-site-01-to-07-verified.png) + 390x664 short-viewport check.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(SITE, "..");
const MOCKUP_OUT = join(WT, "preview/mockups");
const ART_DIR = "C:/Users/QL/.gemini/antigravity/brain/dd673c6e-c2ea-402c-b2ec-41e863043976";
mkdirSync(MOCKUP_OUT, { recursive: true });

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_URL || "http://localhost:3000/All-Romance/?now=2026-12-03T00%3A00%3A00%2B08%3A00";
const profDir = join(SITE, `.tmp_e2e_${Date.now()}`);
mkdirSync(profDir, { recursive: true });

const chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu",
  "--remote-debugging-port=0", `--user-data-dir=${profDir}`, "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const port = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("Chrome startup timeout")), 15000);
  chromeProc.stderr.on("data", (d) => {
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(d.toString());
    if (m) { clearTimeout(t); resolve(Number(m[1])); }
  });
});

let ws, idSeq = 1;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];

const cdp = (m, p = {}) => new Promise((resolve, reject) => {
  const id = idSeq++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});
const ev = async (expr) => {
  const res = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shotPng = async () => {
  const res = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  return "data:image/png;base64," + res.data;
};

const tapAt = async (x, y) => {
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(60);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

const holdAt = async (x, y, holdMs = 720) => {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(holdMs);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

const wheelAt = async (x, y, deltaY) => {
  await cdp("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
};

const pressKey = async (key) => {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key });
  await sleep(40);
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key });
};

const tapElement = async (selector) => {
  const rect = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  })()`);
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Missing or empty tap target: ${selector} -> ${JSON.stringify(rect)}`);
  }
  await tapAt(rect.x, rect.y);
  return rect;
};

const holdElement = async (selector, holdMs = 720) => {
  const rect = await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
  })()`);
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Missing or empty hold target: ${selector} -> ${JSON.stringify(rect)}`);
  }
  await holdAt(rect.x, rect.y, holdMs);
  return rect;
};

const waitForScreen = async (idx, timeoutMs = 3000) => {
  const H = await ev("document.getElementById('scroller').clientHeight || window.innerHeight");
  const target = idx * H;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await ev("document.getElementById('scroller').scrollTop");
    if (Math.abs(st - target) <= 2) return { scrollTop: st, H };
    await sleep(60);
  }
  const finalTop = await ev("document.getElementById('scroller').scrollTop");
  throw new Error(`Timed out waiting for screen ${idx} (target=${target}, got=${finalTop}, H=${H})`);
};

async function runFullPass({ width, height, dpr, label, outFileName }) {
  consoleErrors.length = 0;
  failedRequests.length = 0;

  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: true, hasTouch: true });
  await cdp("Page.navigate", { url: BASE_URL });
  await sleep(1600);
  await ev("document.fonts.ready");

  // 1) Passcode Gate + 01 Opening Checks
  await pressKey("ArrowDown");
  await wheelAt(Math.round(width / 2), Math.round(height / 2), 400);
  await sleep(250);
  const lockedCheck = await ev(`(() => {
    const sc = document.getElementById('scroller');
    return { scrollTop: sc.scrollTop, overflowY: sc.style.overflowY, touchAction: sc.style.touchAction };
  })()`);
  if (lockedCheck.scrollTop !== 0) throw new Error(`[${label}] Gate failed: scrolled while locked: ` + JSON.stringify(lockedCheck));

  await ev(`(() => { document.getElementById('passInput').focus(); })()`);
  for (const ch of "1203") await cdp("Input.insertText", { text: ch }), await sleep(50);
  await sleep(500);
  const day100Hint = await ev("document.getElementById('again')?.textContent?.trim()");
  if (day100Hint !== "这是第 100 天，往前想") throw new Error(`[${label}] Expected 1203 hint, got: ` + day100Hint);
  await sleep(1450);

  await ev(`(() => { document.getElementById('passInput').focus(); })()`);
  for (const ch of "0825") await cdp("Input.insertText", { text: ch }), await sleep(40);
  const tUnlock0 = Date.now();
  let unlockMs = -1;
  while (Date.now() - tUnlock0 < 2400) {
    const ok = await ev("'unlocked' in document.documentElement.dataset");
    if (ok) {
      unlockMs = Date.now() - tUnlock0;
      break;
    }
    await sleep(40);
  }
  if (unlockMs < 0 || unlockMs >= 1800) {
    throw new Error(`[${label}] Expected 0825 unlock < 1800ms, got unlockMs=${unlockMs}`);
  }

  // Wait ~1100ms after unlock so titleIn, hintIn, gust burst, and placeCalm("title") settle
  await sleep(1100);
  const openingAudit = await ev(`(() => {
    const h = document.documentElement;
    const sc = document.getElementById('scroller');
    const cv = document.getElementById('gust');
    const ctx = cv.getContext('2d');
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let nonEmptyPixels = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) nonEmptyPixels++;
    }
    const titleEl = document.querySelector('#title .grp');
    const titleRect = titleEl.getBoundingClientRect();
    const hintRect = document.getElementById('hintTxt').getBoundingClientRect();
    const hintLineRect = document.getElementById('hintLine').getBoundingClientRect();
    const ringEls = [...document.querySelectorAll('#calm .ring, #calm .cflower')];
    const ringBoxes = ringEls.map(el => el.getBoundingClientRect());
    const ringsUnion = ringBoxes.length ? {
      left: Math.round(Math.min(...ringBoxes.map(r => r.left))),
      right: Math.round(Math.max(...ringBoxes.map(r => r.right))),
      top: Math.round(Math.min(...ringBoxes.map(r => r.top))),
      bottom: Math.round(Math.max(...ringBoxes.map(r => r.bottom))),
    } : null;

    const rectsOverlap = (a, b) => a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const titleBox = { left: Math.round(titleRect.left), right: Math.round(titleRect.right), top: Math.round(titleRect.top), bottom: Math.round(titleRect.bottom) };
    const hintBox = { left: Math.round(hintRect.left), right: Math.round(hintRect.right), top: Math.round(hintRect.top), bottom: Math.round(hintRect.bottom) };

    const treeImgs = [...document.querySelectorAll('#tree img[src]')];
    const brokenTreeImgs = treeImgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
    const treeWebpCount = treeImgs.filter(i => i.src.includes('.webp')).length;
    const previewRes = performance.getEntriesByType('resource').filter(r => r.name.includes('tree-calm-preview.webp'));

    return {
      hasDataRm: h.hasAttribute('data-rm'),
      tier: Number(h.dataset.tier),
      ss: getComputedStyle(h).getPropertyValue('--ss').trim(),
      scrollerOverflowY: sc.style.overflowY,
      gustWidth: cv.width,
      gustHeight: cv.height,
      nonEmptyPixels,
      titleBox,
      ringsUnion,
      hintBox,
      hintLineBottom: Math.round(hintLineRect.bottom),
      titleIntersectsRings: rectsOverlap(titleBox, ringsUnion),
      titleIntersectsHint: rectsOverlap(titleBox, hintBox),
      treeImgCount: treeImgs.length,
      treeWebpCount,
      brokenTreeImgs,
      previewLoaded: previewRes.length > 0 && (previewRes[0].responseStatus === undefined || previewRes[0].responseStatus < 400),
    };
  })()`);

  if (openingAudit.hasDataRm || openingAudit.tier === 0) {
    throw new Error(`[${label}] Animations degraded into tier 0 / data-rm: ` + JSON.stringify(openingAudit));
  }
  if (!openingAudit.previewLoaded) {
    throw new Error(`[${label}] tree-calm-preview.webp did not load: ` + JSON.stringify(openingAudit));
  }
  if (openingAudit.treeWebpCount < 10 || openingAudit.brokenTreeImgs.length > 0) {
    throw new Error(`[${label}] Tree .webp layers failed: ` + JSON.stringify(openingAudit));
  }
  if (openingAudit.nonEmptyPixels <= 20) {
    throw new Error(`[${label}] #gust canvas empty: ` + JSON.stringify(openingAudit));
  }
  if (openingAudit.titleIntersectsRings || openingAudit.titleIntersectsHint) {
    throw new Error(`[${label}] Screen 01 #title overlap detected: ` + JSON.stringify(openingAudit));
  }
  if (openingAudit.hintLineBottom > height) {
    throw new Error(`[${label}] Screen 01 #hintLine clipped below ${height}px: ` + JSON.stringify(openingAudit));
  }

  const hud01 = await ev("document.querySelector('#s-opening .hud')?.innerText");
  const shot01 = await shotPng();

  // 2) Screen 02 Flower (wait 4.5s+ for 3.8s slow watercolor spread; also ensure mask reaches >= 500px)
  const tapTurns = [];
  await tapElement("#s-opening .hintTap");
  await waitForScreen(1);
  tapTurns.push("01->02");
  await sleep(4500);
  // Wait up to 2.5s more if the 3.8s diffusion (after 2150ms butterfly flight) is still blooming
  for (let i = 0; i < 12; i++) {
    const radDone = await ev(`(() => {
      return [...document.querySelectorAll('#s-flower div')].some(d => /540(\\.0)?px/.test(d.style.webkitMaskImage || d.style.maskImage || ''));
    })()`);
    if (radDone) break;
    await sleep(250);
  }
  const flowerAudit = await ev(`(() => {
    const imgs = [...document.querySelectorAll('#s-flower img')];
    const bg = imgs.find(i => i.src.includes('framed-bg@3x.webp'));
    const col = imgs.find(i => i.src.includes('framed-colored-real@3x.webp'));
    const frameRect = bg?.getBoundingClientRect();
    const noteRect = document.querySelector('#s-flower [aria-label="继续前往下一页"]')?.getBoundingClientRect();
    return {
      bgNaturalWidth: bg?.naturalWidth || 0,
      colNaturalWidth: col?.naturalWidth || 0,
      frameBottom: frameRect ? Math.round(frameRect.bottom * 10) / 10 : -1,
      noteTop: noteRect ? Math.round(noteRect.top * 10) / 10 : -1,
      gapPx: frameRect && noteRect ? Math.round((noteRect.top - frameRect.bottom) * 10) / 10 : -999,
    };
  })()`);
  if (flowerAudit.bgNaturalWidth !== 860 || flowerAudit.colNaturalWidth !== 860) {
    throw new Error(`[${label}] Screen 02 frame images expected naturalWidth===860: ` + JSON.stringify(flowerAudit));
  }
  if (!(flowerAudit.noteTop > flowerAudit.frameBottom + 4)) {
    throw new Error(`[${label}] Screen 02 bottom note overlaps frame/mist: ` + JSON.stringify(flowerAudit));
  }
  await tapElement('#s-flower [aria-label="轻触青凤蝶泛起微澜"]');
  await sleep(320);
  const flowerRipples = await ev("document.querySelectorAll('#s-flower .ep-ripple').length");
  if (flowerRipples < 1) throw new Error(`[${label}] Screen 02 butterfly tap did not trigger ripples`);
  const shot02 = await shotPng();

  // 3) Screen 03 Letter
  await tapElement('#s-flower [aria-label="继续前往下一页"]');
  await waitForScreen(2);
  tapTurns.push("02->03");
  await sleep(1450);
  const letterAudit = await ev(`(() => {
    const envRect = document.querySelector('#letter [aria-label="轻触展开你的信"]')?.getBoundingClientRect();
    const coupEl = [...document.querySelectorAll('#letter .ep-ang')].find(el => el.textContent?.includes('谨付寸心'));
    const coupRect = coupEl?.getBoundingClientRect();
    return {
      envelopeBottom: envRect ? Math.round(envRect.bottom * 10) / 10 : -1,
      coupletTop: coupRect ? Math.round(coupRect.top * 10) / 10 : -1,
      gapPx: envRect && coupRect ? Math.round((coupRect.top - envRect.bottom) * 10) / 10 : -999,
    };
  })()`);
  if (!(letterAudit.coupletTop > letterAudit.envelopeBottom + 4)) {
    throw new Error(`[${label}] Screen 03 couplet overlaps envelope: ` + JSON.stringify(letterAudit));
  }
  const shot03 = await shotPng();

  // 4) Screen 04 Birds + 04->05 Escort Mid-Flight
  await tapElement('#letter [aria-label="继续前往下一页"]');
  const { H } = await waitForScreen(3);
  tapTurns.push("03->04");
  await sleep(1100);
  const shot04 = await shotPng();

  await ev(`(() => {
    const sc = document.getElementById('scroller');
    sc.style.scrollSnapType = 'none';
    sc.scrollTop = Math.round(3.48 * ${H});
    sc.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('xiyu-scroll'));
  })()`);
  await sleep(350);
  const shotMid = await shotPng();
  const midTransform = await ev(`(() => {
    const u = document.querySelectorAll('.escort-pair-unit');
    return { count: u.length, flap0: u[0]?.dataset?.flapping, t0: u[0]?.style?.transform, vis: document.querySelector('.escort-layer')?.style?.visibility };
  })()`);
  if (midTransform.count !== 2 || midTransform.flap0 !== "1" || midTransform.vis !== "visible") {
    throw new Error(`[${label}] Escort mid-flight check failed: ` + JSON.stringify(midTransform));
  }
  await ev(`(() => {
    const sc = document.getElementById('scroller');
    sc.scrollTop = ${3 * H};
    sc.style.scrollSnapType = '';
    sc.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('xiyu-scroll'));
  })()`);
  await sleep(180);

  // 5) Screen 05 Postcards + Escort Bird Ink-Bounds Overlap Check + Lightbox
  await tapElement('#birds [aria-label="继续前往下一页"]');
  await waitForScreen(4);
  tapTurns.push("04->05");
  await sleep(1100);
  const escortAudit = await ev(`(async () => {
    const p1 = document.querySelector('#postcards [aria-label="放大查看北京南锣鼓巷明信片"]').getBoundingClientRect();
    const p2 = document.querySelector('#postcards [aria-label="放大查看上海19M明信片"]').getBoundingClientRect();
    const units = [...document.querySelectorAll('.escort-pair-unit')];

    const getInkRect = async (unit) => {
      const im = unit.querySelector('img.bird-f1');
      if (!im || !im.complete || im.naturalWidth === 0) return unit.getBoundingClientRect();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const ur = im.getBoundingClientRect();
      const fx0 = minX / c.width, fx1 = (maxX + 1) / c.width;
      const fy0 = minY / c.height, fy1 = (maxY + 1) / c.height;
      return {
        left: ur.left + ur.width * fx0,
        right: ur.left + ur.width * fx1,
        top: ur.top + ur.height * fy0,
        bottom: ur.top + ur.height * fy1,
      };
    };

    const blueInk = await getInkRect(units[0]);
    const amberInk = await getInkRect(units[1]);
    const overlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const roundBox = (r) => ({ left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    return {
      p1: roundBox(p1),
      p2: roundBox(p2),
      blueInk: roundBox(blueInk),
      amberInk: roundBox(amberInk),
      blueOverlapsP1: overlap(blueInk, p1),
      blueOverlapsP2: overlap(blueInk, p2),
      amberOverlapsP1: overlap(amberInk, p1),
      amberOverlapsP2: overlap(amberInk, p2),
    };
  })()`);
  if (escortAudit.blueOverlapsP1 || escortAudit.blueOverlapsP2 || escortAudit.amberOverlapsP1 || escortAudit.amberOverlapsP2) {
    throw new Error(`[${label}] Screen 05 Escort birds overlap P1 or P2: ` + JSON.stringify(escortAudit));
  }
  const shot05 = await shotPng();

  await tapElement('#postcards [aria-label="放大查看北京南锣鼓巷明信片"]');
  await sleep(380);
  const lightboxOpen = await ev("!!document.querySelector('[aria-label=\"明信片放大细读\"]')");
  if (!lightboxOpen) throw new Error(`[${label}] Postcard P1 lightbox did not open`);
  const shot05Box = await shotPng();
  await pressKey("Escape");
  await sleep(300);

  // 6) Screen 06 Photos + Couplet Clearance + 700ms Long Press Easter Egg
  await tapElement('#postcards [aria-label="继续前往下一页"]');
  await waitForScreen(5);
  tapTurns.push("05->06");
  await sleep(1100);
  const photosAudit = await ev(`(() => {
    const hasAxis = !!document.querySelector('#photos .axis, #photos .rail, #photos .timeline-line');
    const c3 = document.querySelector('#photos [aria-label="长按开启霸道黑老大守护我对照彩蛋"]')?.getBoundingClientRect();
    const coup = document.querySelector('#photos [aria-label="继续前往下一页"]')?.getBoundingClientRect();
    return {
      hasAxis,
      card3Bottom: c3 ? Math.round(c3.bottom * 10) / 10 : -1,
      coupletTop: coup ? Math.round(coup.top * 10) / 10 : -1,
      gapPx: c3 && coup ? Math.round((coup.top - c3.bottom) * 10) / 10 : -999,
    };
  })()`);
  if (photosAudit.hasAxis) throw new Error(`[${label}] Screen 06 should not render a left rail axis`);
  if (!(photosAudit.coupletTop > photosAudit.card3Bottom + 4)) {
    throw new Error(`[${label}] Screen 06 couplet overlaps Card 3: ` + JSON.stringify(photosAudit));
  }
  const shot06 = await shotPng();
  await holdElement('#photos [aria-label="长按开启小嘴抹了蜜对照彩蛋"]', 720);
  await sleep(380);
  const eggCaps = await ev("[...document.querySelectorAll('.ee-cap')].map(e => e.textContent.trim())");
  if (!eggCaps.includes("小嘴抹了蜜ono") || !eggCaps.includes("霸道黑老大守护我～")) {
    throw new Error(`[${label}] Easter egg captions mismatch: ` + JSON.stringify(eggCaps));
  }
  const shot06Egg = await shotPng();
  await pressKey("Escape");
  await sleep(300);

  // 7) Screen 07 Ending (Night -> Tap Bouquet dynamically -> Wait 4.8s -> Dawn + Zero Clipping + Zero Blue Borders)
  await tapElement('#photos [aria-label="继续前往下一页"]');
  await waitForScreen(6);
  tapTurns.push("06->07");
  await sleep(1200);
  const nightDays = await ev("document.querySelector('#ending')?.innerText");
  const shot07Night = await shotPng();

  await tapElement('#ending [aria-label="轻触花束迎来破晓"]');
  await sleep(4800);

  const dawnAudit = await ev(`(() => {
    const ending = document.querySelector('#ending');
    const bo = document.querySelector('#ending .bo-rm');
    const iHold = [...document.querySelectorAll('#ending span')].find(s => s.textContent?.trim() === 'I HOLD');
    const dawnDate = [...document.querySelectorAll('#ending p')].filter(p => p.textContent?.includes('自 ')).at(-1);
    const iHoldRect = iHold?.getBoundingClientRect();
    const dawnDateRect = dawnDate?.getBoundingClientRect();
    return {
      text: ending?.innerText || '',
      boText: bo?.textContent?.trim(),
      boFontFamily: bo ? getComputedStyle(bo).fontFamily : '',
      iHoldBottom: iHoldRect ? Math.round(iHoldRect.bottom * 10) / 10 : -1,
      dawnDateBottom: dawnDateRect ? Math.round(dawnDateRect.bottom * 10) / 10 : -1,
      dawnDateText: dawnDate?.textContent?.trim() || '',
    };
  })()`);
  if (!dawnAudit.text.includes("寸心如故") || !dawnAudit.text.includes("ELEGANCE") || !dawnAudit.boFontFamily.includes("Bodoni Moda")) {
    throw new Error(`[${label}] Ending dawn transition missing expected copy/Bodoni Moda: ` + JSON.stringify(dawnAudit));
  }
  if (height <= 710 && (dawnAudit.iHoldBottom > 700 || dawnAudit.dawnDateBottom > 700)) {
    throw new Error(`[${label}] Ending dawn text clipped at ${height}px: ` + JSON.stringify(dawnAudit));
  }

  const shot07Dawn = await shotPng();

  // Sample exact edge pixels (2, 350) & (width - 2, 350) from the captured screenshot to prove ZERO #1430C4 side borders
  const sidePixels = await ev(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(shot07Dawn)};
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const sx = img.naturalWidth / ${width};
    const sy = img.naturalHeight / ${height};
    const sample = (cx, cy) => {
      const px = Math.min(c.width - 1, Math.max(0, Math.round(cx * sx)));
      const py = Math.min(c.height - 1, Math.max(0, Math.round(cy * sy)));
      const d = ctx.getImageData(px, py, 1, 1).data;
      return { cssX: cx, cssY: cy, px, py, r: d[0], g: d[1], b: d[2] };
    };
    return {
      leftEdge: sample(2, 350),
      rightEdge: sample(${width - 2}, 350),
      shotWidth: img.naturalWidth,
      shotHeight: img.naturalHeight,
    };
  })()`);
  if (
    sidePixels.leftEdge.r <= 225 || sidePixels.leftEdge.g <= 215 ||
    sidePixels.rightEdge.r <= 225 || sidePixels.rightEdge.g <= 215
  ) {
    throw new Error(`[${label}] Dawn full-bleed failed (blue side border detected!): ` + JSON.stringify(sidePixels));
  }

  // 8) Native vertical scrolling check
  const wheelBefore = await ev("document.getElementById('scroller').scrollTop");
  await wheelAt(Math.round(width / 2), Math.round(height / 2), -450);
  await sleep(900);
  const wheelAfterUp = await ev("document.getElementById('scroller').scrollTop");
  if (wheelAfterUp >= wheelBefore) {
    throw new Error(`[${label}] Native vertical mouseWheel up failed: before=${wheelBefore}, afterUp=${wheelAfterUp}`);
  }
  await wheelAt(Math.round(width / 2), Math.round(height / 2), 450);
  await sleep(900);
  const wheelAfterDown = await ev("document.getElementById('scroller').scrollTop");
  if (wheelAfterDown <= wheelAfterUp) {
    throw new Error(`[${label}] Native vertical mouseWheel down failed: afterUp=${wheelAfterUp}, afterDown=${wheelAfterDown}`);
  }
  const nativeWheelScroll = { before: wheelBefore, afterUp: wheelAfterUp, afterDown: wheelAfterDown };

  // 9) Media + Fonts Audit
  const mediaAudit = await ev(`(() => {
    const imgs = [...document.images].filter(i => i.getAttribute('src') || i.getAttribute('data-src'));
    const loadedImgs = imgs.filter(i => i.src);
    const broken = loadedImgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
    const fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, '')))];
    const erroredFonts = [...document.fonts].filter(f => f.status === 'error').map(f => f.family);
    const woff2Count = performance.getEntriesByType('resource').filter(r => r.name.includes('.woff2')).length;
    const webpCount = performance.getEntriesByType('resource').filter(r => r.name.includes('.webp')).length;
    return { totalImgs: imgs.length, totalLoaded: loadedImgs.length, broken, fonts, erroredFonts, woff2Count, webpCount };
  })()`);

  const requiredFontGroups = [
    ["Noto Serif SC", "Noto Serif SC VF"],
    ["Noto Sans SC", "Noto Sans SC VF"],
    ["Montserrat", "Montserrat Full"],
    ["Source Serif 4"],
    ["Zhi Mang Xing"],
    ["Playfair Display"],
    ["Bodoni Moda"],
  ];
  const missingFonts = requiredFontGroups.filter((grp) => !grp.some((name) => mediaAudit.fonts.includes(name)));
  if (missingFonts.length || mediaAudit.erroredFonts.length) {
    throw new Error(`[${label}] Missing or errored fonts: ` + JSON.stringify({ missingFonts, erroredFonts: mediaAudit.erroredFonts, loaded: mediaAudit.fonts }));
  }

  const horizontalOverflow = await ev(`document.documentElement.scrollWidth > ${width}`);

  // Also test short viewport toolbar delta right before leaving the live page
  let shortOverflow = false;
  if (width === 390 && height === 844) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 720, deviceScaleFactor: 2, mobile: true, hasTouch: true });
    await sleep(160);
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 2, mobile: true, hasTouch: true });
    await ev(`(() => {
      const sc = document.getElementById('scroller');
      sc.scrollTo({ top: ${5 * 664}, behavior: 'instant' });
      window.dispatchEvent(new Event('xiyu-scroll'));
    })()`);
    await sleep(300);
    shortOverflow = await ev("document.documentElement.scrollWidth > 390");
  }

  // 10) Compose 11-frame contact sheet
  const frames = [
    { label: "01 Opening (Unlocked)", src: shot01 },
    { label: "02 Flower (3.8s Seep)", src: shot02 },
    { label: "03 Letter (E1 + Sakura)", src: shot03 },
    { label: "04 Birds (R1 Organza)", src: shot04 },
    { label: "04->05 Escort Mid-Flight", src: shotMid },
    { label: "05 Postcards (p1/p2)", src: shot05 },
    { label: "05 Lightbox Active", src: shot05Box },
    { label: "06 Photos (Z-Collage)", src: shot06 },
    { label: "06 Easter Egg Overlay", src: shot06Egg },
    { label: "07 Ending (Night 100d)", src: shot07Night },
    { label: "07 Ending (Dawn 4.4s)", src: shot07Dawn },
  ];

  const cellImgH = Math.round(244 * (height / width));
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1740, height: 1580, deviceScaleFactor: 1, mobile: false });
  const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #0A1026; color: #E8EEFF; font-family: system-ui, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 14px; font-weight: 600; letter-spacing: 0.04em; }
    .grid { display: grid; grid-template-columns: repeat(6, 260px); gap: 18px; }
    .cell { background: #121A3D; border-radius: 8px; padding: 8px; border: 1px solid rgba(255,255,255,0.12); }
    .cell img { width: 244px; height: ${cellImgH}px; object-fit: cover; border-radius: 4px; display: block; }
    .lbl { font-size: 12px; margin-top: 8px; text-align: center; color: #F0C288; font-weight: 600; }
  </style></head><body>
    <h1>${label} E2E Verification — ${BASE_URL} (${width}x${height} @${dpr}x)</h1>
    <div class="grid">
      ${frames.map((f) => `<div class="cell"><img src="${f.src}" /><div class="lbl">${f.label}</div></div>`).join("")}
    </div>
  </body></html>`;
  const sheetPath = join(profDir, `sheet-${width}x${height}.html`);
  writeFileSync(sheetPath, sheetHtml, "utf8");
  await cdp("Page.navigate", { url: "file:///" + sheetPath.replace(/\\/g, "/") });
  await sleep(900);
  const sheetShot = await cdp("Page.captureScreenshot", { format: "png", fullPage: true });
  const outPng = join(MOCKUP_OUT, outFileName);
  writeFileSync(outPng, Buffer.from(sheetShot.data, "base64"));
  if (existsSync(ART_DIR)) {
    copyFileSync(outPng, join(ART_DIR, outFileName));
  }

  return {
    viewport: `${width}x${height}@${dpr}x`,
    hud01,
    day100Hint,
    unlockMs,
    openingAudit,
    flowerAudit,
    flowerRipples,
    letterAudit,
    tapTurns,
    midTransform,
    escortAudit,
    lightboxOpen,
    photosAudit,
    eggCaps,
    nightDaysChecked: nightDays.includes("100"),
    dawnAudit: {
      boText: dawnAudit.boText,
      boFontFamily: dawnAudit.boFontFamily,
      iHoldBottom: dawnAudit.iHoldBottom,
      dawnDateBottom: dawnAudit.dawnDateBottom,
      dawnDateText: dawnAudit.dawnDateText,
      sidePixels,
    },
    nativeWheelScroll,
    horizontalOverflow,
    shortOverflow,
    mediaAudit,
    consoleErrors: [...consoleErrors],
    failedRequests: [...failedRequests],
    outPng,
  };
}

try {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (msg) => {
    const m = JSON.parse(msg.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(m.error); else resolve(m.result);
    } else if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") {
      consoleErrors.push(m.params.args?.map((a) => a.value ?? a.description).join(" "));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push(m.params.exceptionDetails?.text || "Runtime exception");
    } else if (m.method === "Network.responseReceived" && m.params?.response?.status >= 400) {
      failedRequests.push(`${m.params.response.status} ${m.params.response.url}`);
    }
  });

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");

  const wechat704 = await runFullPass({
    width: 393,
    height: 704,
    dpr: 3,
    label: "WeChat iPhone 704p",
    outFileName: "wechat-704p-01-to-07-verified.png",
  });

  const iphone844 = await runFullPass({
    width: 390,
    height: 844,
    dpr: 2,
    label: "iPhone 844p",
    outFileName: "live-site-01-to-07-verified.png",
  });

  const shortOverflow = iphone844.shortOverflow;

  console.log(JSON.stringify({ url: BASE_URL, wechat704, iphone844, shortOverflow }, null, 2));

  const bad =
    wechat704.consoleErrors.length || wechat704.failedRequests.length || wechat704.mediaAudit.broken.length || wechat704.horizontalOverflow ||
    iphone844.consoleErrors.length || iphone844.failedRequests.length || iphone844.mediaAudit.broken.length || iphone844.horizontalOverflow ||
    shortOverflow;
  if (bad) process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  try { chromeProc.kill(); } catch {}
  await sleep(900);
  try { rmSync(profDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 }); } catch {}
}
