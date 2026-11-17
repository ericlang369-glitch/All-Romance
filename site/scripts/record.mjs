// 自动走一遍全流程，出每屏截图、完整录屏和「效果图 vs 实现」对比图。
// 先 pnpm build 并开着预览（pnpm start），再：  pnpm shoot            （截图 + 录屏 + 对比图）
//                                             pnpm shoot --no-video （只截图 + 对比图，快）
// 做法：页面带 ?rec 打开，网站时钟改由本脚本逐帧推进（window.__step），每帧截一张图再用 ffmpeg 合成 60 帧 H.264。
// 所以录屏是逐帧渲染的「理想 60 帧」，不受这台机器渲染速度影响，也不代表真机帧率。
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("..", import.meta.url));
const WT = join(SITE, "..");
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const OUT = join(WT, arg("out", "preview/v2"));
const VP = arg("vp", "390x844"), [VW, VH] = VP.split("x").map(Number);
const TIER = arg("tier", ""), FLOW = arg("flow", "full");
const VIDEO_NAME = arg("video", FLOW === "minute" ? "minute-roll.mp4" : `full-run${TIER ? `-tier${TIER}` : ""}.mp4`);
const SHOTS = join(OUT, "screens", VP + (TIER ? `-tier${TIER}` : ""));
const FRAMES = `/tmp/xiyu-frames-${process.pid}`;
const URL0 = process.env.URL || "http://localhost:3000/";
const VIDEO = !process.argv.includes("--no-video");
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const DESKTOP = VW > 430;
// 计数器按「12 月 3 日 0 点（第 100 天）」模拟，和效果图 06 对得上；整分钟那段从 00:00:00 往前 40 秒开始
const NOW = FLOW === "minute" ? "2026-12-02T23:59:20+08:00" : "2026-12-03T00:00:00+08:00";
const FPS = 60, DT = 1000 / FPS;

mkdirSync(SHOTS, { recursive: true });
rmSync(FRAMES, { recursive: true, force: true });
if (VIDEO) mkdirSync(FRAMES, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"] });
const page = await browser.newPage();
await page.emulate({
  viewport: { width: VW, height: VH, deviceScaleFactor: DESKTOP ? 1 : 2, isMobile: !DESKTOP, hasTouch: true },
  userAgent: DESKTOP ? (await browser.userAgent()) : "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text() + " " + (m.location()?.url || "")));
page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
const cdp = await page.createCDPSession();
await page.goto(`${URL0}?rec${TIER ? `&tier=${TIER}` : ""}&now=${encodeURIComponent(NOW)}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.documentElement.dataset.ready !== undefined && [...document.images].every((i) => !i.getAttribute("src") || i.complete));
const screens = await page.evaluate(() => window.__screens);
let capturing = VIDEO;

/* ---------- 录屏辅助：触点（只画在录屏里，网站本身没有） ---------- */
await page.evaluate(() => {
  const d = document.createElement("div");
  d.id = "__touch";
  d.style.cssText = "position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid rgba(255,255,255,.75);background:rgba(255,255,255,.2);pointer-events:none;z-index:9999;opacity:0";
  document.body.appendChild(d);
  window.__touch = (x, y, o, s = 1) => { d.style.transform = `translate(${x}px,${y}px) scale(${s})`; d.style.opacity = o; };
});
const touch = (x, y, o, s) => page.evaluate((a) => window.__touch(...a), [x, y, o, s]);

let t = 0, frame = 0;
async function snapFrame() {
  if (!capturing) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
  writeFileSync(join(FRAMES, String(frame++).padStart(5, "0") + ".jpg"), Buffer.from(data, "base64"));
}
/** 推进虚拟时间 ms，每帧可选回调 */
async function step(ms, each) {
  const end = t + ms;
  while (t + DT <= end + 1e-6) {
    t += DT;
    if (each) await each((t - (end - ms)) / ms);
    await page.evaluate((v) => window.__step(v), t);
    await snapFrame();
  }
}
async function shot(name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log("截图", name, `@${Math.round(t)}ms`);
}
const center = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
async function tap(x, y) {
  await touch(x, y, 0.9, 0.8);
  await page.touchscreen.tap(x, y);
  await step(140);
  await step(200, (k) => touch(x, y, 0.9 * (1 - k), 0.8 + 0.3 * k));
}
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
/** 等图片加载完（按屏加载，录屏时钟停着，不影响时间线） */
const imgsReady = () => page.waitForFunction(() => [...document.images].every((i) => !i.getAttribute("src") || i.complete), { timeout: 20000 });
/** 上滑到下一屏：手指 1:1 拖 200px / 280ms，松手后吸附 620ms（同 motion/prototypes/camera.html 的示意） */
async function swipeNext() {
  await imgsReady();
  const H = await page.evaluate(() => document.getElementById("scroller").clientHeight);
  const y0 = await page.evaluate(() => document.getElementById("scroller").scrollTop);
  const i = Math.round(y0 / H), target = (i + 1) * H;
  await touch(240, 640, 0.9);
  await step(280, async (k) => { const e = ease(k); await touch(240, 640 - 200 * e, 0.9); await page.evaluate((y) => window.__scrollTo(y), y0 + 200 * e); });
  await touch(240, 440, 0);
  const y1 = y0 + 200;
  await step(620, (k) => page.evaluate((y) => window.__scrollTo(y), y1 + (target - y1) * easeOut(k)));
  await imgsReady();
}
async function type(chars, gap = 380) {
  for (const c of chars) { await page.keyboard.type(c); await step(gap); }
}

/* ---------- 流程 ---------- */
const RM = TIER === "0";
async function unlockFlow(withShots) {
  await step(1000);
  await page.focus("#passInput");
  await type("123", 380);
  await page.keyboard.type("4");
  await step(160 + 240); // 校验 160ms 后开始晃，「再想想」淡入
  if (withShots) await shot("01b-passcode-error");
  await step(1600); // 1 秒后清空回到第 1 位
  await type("08", 380);
  if (withShots) await shot("01a-passcode");
  await type("2", 380);
  await page.keyboard.type("5");
  await imgsReady();
  if (RM) { await step(160 + 600 + 1200); if (withShots) await shot("01-opening"); return; }
  await step(160 + 760 + 2450); // 输对 = 第 4 位后 160ms；风起 = 输对 +760；风起后约 2450ms 同屏最多
  if (withShots) await shot("01-opening-gust");
  await step(6000 + 1600 - (760 + 2450)); // 放开下滑（输对 +6000）后再停一会
  if (withShots) await shot("01-opening");
}
if (FLOW === "full") {
  await unlockFlow(true);
  const tapNext = await center(".hintTap");
  await tap(tapNext[0], tapNext[1]); // 「轻触 · 向下」
  await imgsReady();
  await step(620 + 3600 + 600);
  await shot("02-flower");
  await step(600);
  if (screens.includes("letter")) { await swipeNext(); await step(2200); await shot("03-letter"); await step(600); }
  await swipeNext();
  await step(2300);
  await shot("04-postcards");
  const c1 = await center("#s-postcards .c1"), c2 = await center("#s-postcards .c2");
  await tap(c1[0] - 40, c1[1] - 20); await step(800);
  await shot("04-postcards-flipped-1");
  await tap(c2[0] + 40, c2[1] + 20); await step(800);
  await tap(c1[0] - 40, c1[1] - 20); await step(900);
  await swipeNext();
  await step(1900);
  await shot("05-photos");
  // 长按拍立得 2：0.6 秒展开彩蛋
  const p2 = await center("#s-photos .p2");
  await touch(p2[0], p2[1], 0.9);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p2[0], y: p2[1] }] });
  await step(750);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch(p2[0], p2[1], 0);
  await step(1100);
  await shot("05a-easter-egg");
  await step(1200);
  await tap(VW / 2, Math.min(680, VH - 40)); // 轻触空白处收起
  await step(900);
  await swipeNext();
  await step(2700);
  await shot("06-ending");
  await step(1500);
} else {
  // 整分钟换数字：快速解锁、直接跳到第 6 屏（不录），从换分钟前 2 秒开始录 3 秒
  capturing = false;
  await unlockFlow(false);
  const H = await page.evaluate(() => document.getElementById("scroller").clientHeight);
  for (let k = 1; k <= screens.length - 1; k++) { await page.evaluate((y) => window.__scrollTo(y), k * H); await step(DT); await imgsReady(); }
  await step(3000);
  const clockMs = Date.parse(NOW) + t; // ?now 下网站时钟 = NOW + 虚拟时间
  const toMinute = 60000 - (clockMs % 60000);
  await step(toMinute - 2000);
  capturing = VIDEO;
  await step(1500);
  await shot("06-ending-before-roll");
  await step(500 + 15); // 整分钟（网站对齐到整分钟后 15ms 换）
  // 逐帧：旧数字 120ms 淡出上移 4px，淡完新数字 240ms 从下方 4px 进来
  await step(4 * DT); await shot("06-ending-roll-old-out");
  await step(10 * DT); await shot("06-ending-roll-new-in");
  await step(900); await shot("06-ending-after-roll");
  capturing = false;
}

/* ---------- 字体核对：每个文字节点都用到内嵌的 4 个字体，没有回退到系统字体 ---------- */
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
const fonts = new Map();
async function walk(n) {
  if (n.nodeType === 1 && n.children?.some((c) => c.nodeType === 3 && c.nodeValue.trim())) {
    try { const r = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: n.nodeId }); r.fonts.forEach((f) => fonts.set(f.familyName, (fonts.get(f.familyName) || 0) + f.glyphCount)); } catch {}
  }
  for (const c of n.children || []) await walk(c);
}
await walk(root);
console.log("用到的字体（字形数）：", Object.fromEntries(fonts));
await browser.close();

if (VIDEO) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, VIDEO_NAME)]);
  console.log(`录屏 ${frame} 帧（${(frame / FPS).toFixed(1)}s）→ ${join(OUT, VIDEO_NAME)}`);
  rmSync(FRAMES, { recursive: true, force: true });
}

/* ---------- 对比图：上 = 设计（效果图 / design/adapt 示意图），下 = 实现 ---------- */
if (FLOW === "full" && !TIER) {
  const ADAPT = { "375x667": ["01-opening", "01a-passcode", "02-flower", "04-postcards", "05-photos", "05a-easter-egg", "06-ending"], "390x664": ["01-opening", "01a-passcode", "02-flower", "04-postcards", "05-photos", "05a-easter-egg", "06-ending"], "1440x900": ["01-opening", "06-ending"] };
  const designOf = (n) => {
    if (VP === "390x844") return join(WT, "design/pages", `${n}.png`);
    const extra = ["03-letter", "04-postcards", "05-photos", "05a-easter-egg"].includes(n) ? "extra/" : "";
    return join(WT, "design/adapt", `${extra}${n}_${VP}@3x.png`);
  };
  const PAIRS = VP === "390x844"
    ? ["01a-passcode", "01b-passcode-error", "01-opening-gust", "01-opening", "02-flower", ...(screens.includes("letter") ? ["03-letter"] : []), "04-postcards", "05-photos", "05a-easter-egg", "06-ending"]
    : (ADAPT[VP] || []).filter((n) => existsSync(designOf(n)));
  if (PAIRS.length) {
    const FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc";
    const sc = VW > 430 ? 0.5 : 1, W = Math.round(VW * sc), Hh = Math.round(VH * sc);
    const inputs = [], filters = [];
    PAIRS.forEach((n, i) => {
      inputs.push("-i", designOf(n), "-i", join(SHOTS, `${n}.png`));
      const lab = (txt) => existsSync(FONT) ? `,pad=${W}:${Hh + 36}:0:36:0x0B1E8C,drawtext=fontfile=${FONT}:text='${txt}':fontcolor=white:fontsize=18:x=12:y=9` : "";
      filters.push(`[${2 * i}:v]scale=${W}:${Hh}:flags=lanczos${lab(`设计 ${n}`)}[d${i}]`);
      filters.push(`[${2 * i + 1}:v]scale=${W}:${Hh}:flags=lanczos${lab(`实现 ${n}`)}[m${i}]`);
      filters.push(`[d${i}][m${i}]vstack=inputs=2,pad=${W + 12}:ih:6:0:0x0B1E8C[c${i}]`);
    });
    filters.push(`${PAIRS.map((_, i) => `[c${i}]`).join("")}hstack=inputs=${PAIRS.length}[out]`);
    const cmp = join(OUT, `compare-${VP}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-frames:v", "1", cmp]);
    console.log("对比图 →", cmp);
  }
}
if (errors.length) { console.log("页面报错：", errors); process.exitCode = 1; }
