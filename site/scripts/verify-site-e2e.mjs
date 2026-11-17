// End-to-end headless Chrome CDP verification (Screens 01-07 + unlock timing + double-insurance page turns + native scroll + modals + 390x720/390x664 checks)
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
  const id = idSeq++; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method: m, params: p }));
});
const ev = async (expr) => {
  const res = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
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

const holdAt = async (x, y, holdMs = 700) => {
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
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  })()`);
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Missing or empty tap target: ${selector} -> ${JSON.stringify(rect)}`);
  }
  await tapAt(rect.x, rect.y);
  return rect;
};

const waitForScreen = async (idx, timeoutMs = 2600) => {
  const target = idx * 844;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const st = await ev("document.getElementById('scroller').scrollTop");
    if (Math.abs(st - target) <= 2) return st;
    await sleep(60);
  }
  const finalTop = await ev("document.getElementById('scroller').scrollTop");
  throw new Error(`Timed out waiting for screen ${idx} (target=${target}, got=${finalTop})`);
};

try {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (msg) => {
    const m = JSON.parse(msg.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
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
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, hasTouch: true });

  await cdp("Page.navigate", { url: BASE_URL });
  await sleep(1600);
  await ev("document.fonts.ready");

  // 1) Passcode Lock Check: ArrowDown + wheel blocked while locked + 1203 hint + 0825 fast unlock
  await pressKey("ArrowDown");
  await wheelAt(195, 422, 400);
  await sleep(250);
  const lockedCheck = await ev(`(() => {
    const sc = document.getElementById('scroller');
    return { scrollTop: sc.scrollTop, overflowY: sc.style.overflowY, touchAction: sc.style.touchAction };
  })()`);
  if (lockedCheck.scrollTop !== 0) throw new Error("Gate failed: scrolled while locked: " + JSON.stringify(lockedCheck));

  await ev(`(() => { document.getElementById('passInput').focus(); })()`);
  for (const ch of "1203") await cdp("Input.insertText", { text: ch }), await sleep(50);
  await sleep(500);
  const day100Hint = await ev("document.getElementById('again')?.textContent?.trim()");
  if (day100Hint !== "这是第 100 天，往前想") throw new Error("Expected 1203 hint, got: " + day100Hint);
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
  if (unlockMs < 0 || unlockMs > 1750) {
    throw new Error(`Expected 0825 unlock within ~1.6s, got unlockMs=${unlockMs}`);
  }

  // Wait briefly for hintIn fade & gust burst petals, then audit animations, #gust pixels, and #hintTxt clearance
  await sleep(500);
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
    const hintRect = document.getElementById('hintTxt').getBoundingClientRect();
    const tapRect = document.querySelector('#s-opening .hintTap').getBoundingClientRect();
    return {
      hasDataRm: h.hasAttribute('data-rm'),
      tier: Number(h.dataset.tier),
      scrollerOverflowY: sc.style.overflowY,
      scrollerTouchAction: sc.style.touchAction,
      gustWidth: cv.width,
      gustHeight: cv.height,
      nonEmptyPixels,
      hintRect: { top: Math.round(hintRect.top), bottom: Math.round(hintRect.bottom) },
      tapRect: { top: Math.round(tapRect.top), bottom: Math.round(tapRect.bottom) },
    };
  })()`);
  if (openingAudit.hasDataRm || openingAudit.tier === 0) {
    throw new Error("Animations were killed into tier 0 / data-rm: " + JSON.stringify(openingAudit));
  }
  if (openingAudit.nonEmptyPixels <= 20) {
    throw new Error("#gust canvas did not render falling petals: " + JSON.stringify(openingAudit));
  }
  if (openingAudit.hintRect.bottom >= 795) {
    throw new Error(`#hintTxt bottom (${openingAudit.hintRect.bottom}) should sit above y=795`);
  }

  // Check #hintTxt in WeChat-cropped 390x720 viewport (toolbar resize delta = 124px)
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 720, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await sleep(220);
  const wechatHint720 = await ev(`(() => {
    const r = document.getElementById('hintTxt').getBoundingClientRect();
    const tap = document.querySelector('#s-opening .hintTap').getBoundingClientRect();
    return { hintTop: Math.round(r.top), hintBottom: Math.round(r.bottom), tapBottom: Math.round(tap.bottom), cssH: document.documentElement.style.getPropertyValue('--H') };
  })()`);
  if (wechatHint720.hintBottom >= 795 || wechatHint720.hintBottom > 720) {
    throw new Error("WeChat 390x720 #hintTxt clipped or below y=795: " + JSON.stringify(wechatHint720));
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await sleep(220);

  const hud01 = await ev("document.querySelector('#s-opening .hud')?.innerText");
  const shot01 = await shotPng();

  // 2) Tap Screen 01 bottom prompt (.hintTap) -> Screen 02 Flower
  const tapTurns = [];
  await tapElement("#s-opening .hintTap");
  await waitForScreen(1);
  tapTurns.push("01->02");
  await sleep(3400); // Allow butterfly flight + 02-C ink diffusion bloom
  await tapAt(261, 435);
  await sleep(320);
  const flowerRipples = await ev("document.querySelectorAll('#s-flower .ep-ripple').length");
  if (flowerRipples < 1) throw new Error("Screen 02 butterfly tap did not trigger ripples");
  const shot02 = await shotPng();

  // 3) Tap Screen 02 bottom note -> Screen 03 Letter
  await tapElement('#s-flower [aria-label="继续前往下一页"]');
  await waitForScreen(2);
  tapTurns.push("02->03");
  await sleep(1400);
  const shot03 = await shotPng();

  // 4) Tap Screen 03 bottom whisper -> Screen 04 Birds
  await tapElement('#letter [aria-label="继续前往下一页"]');
  await waitForScreen(3);
  tapTurns.push("03->04");
  await sleep(1100);
  const shot04 = await shotPng();

  // 4->5) Escort Mid-Flight across seam (p = 3.48; temporarily disable snap during inspection, then return to Screen 04)
  await ev(`(() => {
    const sc = document.getElementById('scroller');
    sc.style.scrollSnapType = 'none';
    sc.scrollTop = Math.round(3.48 * 844);
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
    throw new Error("Escort mid-flight check failed: " + JSON.stringify(midTransform));
  }
  await ev(`(() => {
    const sc = document.getElementById('scroller');
    sc.scrollTop = ${3 * 844};
    sc.style.scrollSnapType = '';
    sc.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('xiyu-scroll'));
  })()`);
  await sleep(180);

  // 5) Tap Screen 04 bottom whisper -> Screen 05 Postcards + Lightbox
  await tapElement('#birds [aria-label="继续前往下一页"]');
  await waitForScreen(4);
  tapTurns.push("04->05");
  await sleep(1100);
  const shot05 = await shotPng();
  await tapAt(140, 285); // Tap P1 card
  await sleep(380);
  const lightboxOpen = await ev("!!document.querySelector('[aria-label=\"明信片放大细读\"]')");
  if (!lightboxOpen) throw new Error("Postcard P1 lightbox did not open");
  const shot05Box = await shotPng();
  await pressKey("Escape");
  await sleep(300);

  // 6) Tap Screen 05 bottom whisper -> Screen 06 Photos + 700ms Long Press Easter Egg
  await tapElement('#postcards [aria-label="继续前往下一页"]');
  await waitForScreen(5);
  tapTurns.push("05->06");
  await sleep(1100);
  const hasAxis = await ev("!!document.querySelector('#photos .axis, #photos .rail, #photos .timeline-line')");
  if (hasAxis) throw new Error("Screen 06 should not render a left rail axis");
  const shot06 = await shotPng();
  await holdAt(285, 290, 700); // Long-press Card 2 (Cat Remake)
  await sleep(380);
  const eggCaps = await ev("[...document.querySelectorAll('.ee-cap')].map(e => e.textContent.trim())");
  if (!eggCaps.includes("小嘴抹了蜜ono") || !eggCaps.includes("霸道黑老大守护我～")) {
    throw new Error("Easter egg captions mismatch: " + JSON.stringify(eggCaps));
  }
  const shot06Egg = await shotPng();
  await pressKey("Escape");
  await sleep(300);

  // 7) Tap Screen 06 bottom couplet -> Screen 07 Ending (Night -> Tap Bouquet -> Dawn)
  await tapElement('#photos [aria-label="继续前往下一页"]');
  await waitForScreen(6);
  tapTurns.push("06->07");
  await sleep(1200);
  const nightDays = await ev("document.querySelector('#ending')?.innerText");
  const shot07Night = await shotPng();
  await tapAt(195, 204);
  await sleep(1700);
  const dawnAudit = await ev(`(() => {
    const ending = document.querySelector('#ending');
    const bo = document.querySelector('#ending .bo-rm');
    return {
      text: ending?.innerText || '',
      boText: bo?.textContent?.trim(),
      boFontFamily: bo ? getComputedStyle(bo).fontFamily : '',
    };
  })()`);
  if (!dawnAudit.text.includes("寸心如故") || !dawnAudit.text.includes("ELEGANCE") || !dawnAudit.boFontFamily.includes("Bodoni Moda")) {
    throw new Error("Ending dawn transition missing expected copy/Bodoni Moda: " + JSON.stringify(dawnAudit));
  }
  const shot07Dawn = await shotPng();

  // 8) Native vertical scrolling check (real mouseWheel up from Screen 07 -> Screen 06, then wheel back down -> Screen 07)
  const wheelBefore = await ev("document.getElementById('scroller').scrollTop");
  await wheelAt(195, 422, -450);
  await sleep(900);
  const wheelAfterUp = await ev("document.getElementById('scroller').scrollTop");
  if (wheelAfterUp >= wheelBefore) {
    throw new Error(`Native vertical mouseWheel up failed: before=${wheelBefore}, afterUp=${wheelAfterUp}`);
  }
  await wheelAt(195, 422, 450);
  await sleep(900);
  const wheelAfterDown = await ev("document.getElementById('scroller').scrollTop");
  if (wheelAfterDown <= wheelAfterUp) {
    throw new Error(`Native vertical mouseWheel down failed: afterUp=${wheelAfterUp}, afterDown=${wheelAfterDown}`);
  }
  const nativeWheelScroll = { before: wheelBefore, afterUp: wheelAfterUp, afterDown: wheelAfterDown };

  // Check broken images + loaded fonts
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
    throw new Error("Missing or errored fonts: " + JSON.stringify({ missingFonts, erroredFonts: mediaAudit.erroredFonts, loaded: mediaAudit.fonts }));
  }

  // Short viewport check (390x720 -> 390x664 so toolbar delta triggers cleanly)
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 720, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await sleep(160);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await ev(`(() => {
    const sc = document.getElementById('scroller');
    sc.scrollTo({ top: ${5 * 664}, behavior: 'instant' });
    window.dispatchEvent(new Event('xiyu-scroll'));
  })()`);
  await sleep(400);
  const shortOverflow = await ev("document.documentElement.scrollWidth > 390");

  // Compose 2x6 contact sheet into preview/mockups & artifact dir
  const frames = [
    { label: "01 Opening (Unlocked)", src: shot01 },
    { label: "02 Flower (02-C Diffusion)", src: shot02 },
    { label: "03 Letter (E1 + Sakura)", src: shot03 },
    { label: "04 Birds (R1 Organza)", src: shot04 },
    { label: "04->05 Escort Mid-Flight", src: shotMid },
    { label: "05 Postcards (p1/p2)", src: shot05 },
    { label: "05 Lightbox Active", src: shot05Box },
    { label: "06 Photos (Z-Collage)", src: shot06 },
    { label: "06 Easter Egg Overlay", src: shot06Egg },
    { label: "07 Ending (Night 100d)", src: shot07Night },
    { label: "07 Ending (Dawn Bloomed)", src: shot07Dawn },
  ];

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1740, height: 1580, deviceScaleFactor: 1, mobile: false });
  const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #0A1026; color: #E8EEFF; font-family: system-ui, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 14px; font-weight: 600; letter-spacing: 0.04em; }
    .grid { display: grid; grid-template-columns: repeat(6, 260px); gap: 18px; }
    .cell { background: #121A3D; border-radius: 8px; padding: 8px; border: 1px solid rgba(255,255,255,0.12); }
    .cell img { width: 244px; height: 528px; object-fit: cover; border-radius: 4px; display: block; }
    .lbl { font-size: 12px; margin-top: 8px; text-align: center; color: #F0C288; font-weight: 600; }
  </style></head><body>
    <h1>Live Production E2E Verification — ${BASE_URL} (Screens 01-07)</h1>
    <div class="grid">
      ${frames.map((f) => `<div class="cell"><img src="${f.src}" /><div class="lbl">${f.label}</div></div>`).join("")}
    </div>
  </body></html>`;
  const sheetPath = join(profDir, "sheet.html");
  writeFileSync(sheetPath, sheetHtml, "utf8");
  await cdp("Page.navigate", { url: "file:///" + sheetPath.replace(/\\/g, "/") });
  await sleep(900);
  const sheetShot = await cdp("Page.captureScreenshot", { format: "png", fullPage: true });
  const outPng = join(MOCKUP_OUT, "live-site-01-to-07-verified.png");
  writeFileSync(outPng, Buffer.from(sheetShot.data, "base64"));
  if (existsSync(ART_DIR)) {
    copyFileSync(outPng, join(ART_DIR, "live-site-01-to-07-verified.png"));
  }

  console.log(JSON.stringify({
    url: BASE_URL,
    hud01,
    day100Hint,
    unlockMs,
    openingAudit,
    wechatHint720,
    tapTurns,
    flowerRipples,
    midTransform,
    lightboxOpen,
    eggCaps,
    nightDaysChecked: nightDays.includes("100"),
    dawnChecked: dawnAudit.text.includes("寸心如故") && dawnAudit.text.includes("ELEGANCE"),
    boFontFamily: dawnAudit.boFontFamily,
    nativeWheelScroll,
    shortOverflow,
    mediaAudit,
    consoleErrors,
    failedRequests,
    outPng,
  }, null, 2));

  if (consoleErrors.length || failedRequests.length || mediaAudit.broken.length || shortOverflow) {
    process.exitCode = 1;
  }
} finally {
  try { ws?.close(); } catch {}
  try { chromeProc.kill(); } catch {}
  await sleep(900);
  try { rmSync(profDir, { recursive: true, force: true }); } catch {}
}
