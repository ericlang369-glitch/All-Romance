// End-to-end headless Chrome CDP verification of http://localhost:3000 (Screens 01-07 + transitions + modals + 390x664 check)
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

const holdAt = async (x, y, holdMs = 680) => {
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(holdMs);
  await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

const pressKey = async (key) => {
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key });
  await sleep(40);
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key });
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

  // 1) Passcode Lock Check: Tab/ArrowDown blocked + 1203 hint + 0825 unlock
  await pressKey("ArrowDown");
  await sleep(250);
  const lockedScroll = await ev("document.getElementById('scroller').scrollTop");
  if (lockedScroll !== 0) throw new Error("Gate failed: scrolled while locked: " + lockedScroll);

  await ev(`(() => { const inp = document.getElementById('passInput'); inp.focus(); })()`);
  for (const ch of "1203") await cdp("Input.insertText", { text: ch }), await sleep(60);
  await sleep(500);
  const day100Hint = await ev("document.getElementById('again')?.textContent?.trim()");
  if (day100Hint !== "这是第 100 天，往前想") throw new Error("Expected 1203 hint, got: " + day100Hint);
  await sleep(1450);

  await ev(`(() => { const inp = document.getElementById('passInput'); inp.focus(); })()`);
  for (const ch of "0825") await cdp("Input.insertText", { text: ch }), await sleep(60);
  await sleep(6300); // Allow unlock reveal + gust settle
  const isUnlocked = await ev("'unlocked' in document.documentElement.dataset");
  if (!isUnlocked) throw new Error("Expected 0825 to unlock");
  const hud01 = await ev("document.querySelector('#s-opening .hud')?.innerText");
  const shot01 = await shotPng();

  // Scroll helper (triggers native scrollTop + xiyu-scroll + wait for images/transitions)
  const gotoP = async (p, waitMs = 900) => {
    await ev(`(() => {
      const sc = document.getElementById('scroller');
      sc.scrollTo({ top: ${Math.round(p * 844)}, behavior: 'instant' });
      window.dispatchEvent(new Event('xiyu-scroll'));
    })()`);
    await sleep(waitMs);
  };

  // 2) Screen 02 Flower (wait 3.4s for butterfly + 02-C ink bloom, then tap butterfly at (261, 435))
  await gotoP(1, 3400);
  await tapAt(261, 435);
  await sleep(320);
  const shot02 = await shotPng();

  // 3) Screen 03 Letter
  await gotoP(2, 1400);
  const shot03 = await shotPng();

  // 4) Screen 04 Birds (R1 ribbon + 3-frame flock)
  await gotoP(3, 1100);
  const shot04 = await shotPng();

  // 4->5) Escort Mid-Flight across seam (p = 3.48; bypass snap-type temporarily during mid-flight inspection)
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
  await ev(`document.getElementById('scroller').style.scrollSnapType = ''`);

  // 5) Screen 05 Postcards + Lightbox
  await gotoP(4, 1100);
  const shot05 = await shotPng();
  await tapAt(140, 285); // Tap P1 card
  await sleep(380);
  const lightboxOpen = await ev("!!document.querySelector('[aria-label=\"明信片放大细读\"]')");
  if (!lightboxOpen) throw new Error("Postcard P1 lightbox did not open");
  const shot05Box = await shotPng();
  await pressKey("Escape");
  await sleep(300);

  // 6) Screen 06 Photos + 650ms Long Press Easter Egg
  await gotoP(5, 1100);
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

  // 7) Screen 07 Ending (Night -> Tap Bouquet at (195, 204) -> Starry A -> Dawn 定稿 3)
  await gotoP(6, 1200);
  const nightDays = await ev("document.querySelector('#ending')?.innerText");
  const shot07Night = await shotPng();
  await tapAt(195, 204);
  await sleep(1700);
  const dawnText = await ev("document.querySelector('#ending')?.innerText");
  if (!dawnText.includes("寸心如故") || !dawnText.includes("ELEGANCE")) {
    throw new Error("Ending dawn transition missing expected copy: " + dawnText);
  }
  const shot07Dawn = await shotPng();

  // Check broken images + loaded fonts
  const mediaAudit = await ev(`(() => {
    const imgs = [...document.images].filter(i => i.getAttribute('src') || i.getAttribute('data-src'));
    const loadedImgs = imgs.filter(i => i.src);
    const broken = loadedImgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
    const fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))];
    return { totalLoaded: loadedImgs.length, broken, fonts };
  })()`);

  // Short viewport check (390x664)
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 2, mobile: true, hasTouch: true });
  await gotoP(5, 500);
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
    <h1>Live Production E2E Verification — http://localhost:3000 (Screens 01-07)</h1>
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
  copyFileSync(outPng, join(ART_DIR, "live-site-01-to-07-verified.png"));

  console.log(JSON.stringify({
    hud01,
    day100Hint,
    midTransform,
    lightboxOpen,
    eggCaps,
    nightDaysChecked: nightDays.includes("100"),
    shortOverflow,
    mediaAudit,
    consoleErrors,
    failedRequests,
    outPng,
  }, null, 2));

  if (consoleErrors.length || failedRequests.length || mediaAudit.broken.length) {
    process.exitCode = 1;
  }
} finally {
  try { ws?.close(); } catch {}
  try { chromeProc.kill(); } catch {}
  await sleep(900);
  try { rmSync(profDir, { recursive: true, force: true }); } catch {}
}
