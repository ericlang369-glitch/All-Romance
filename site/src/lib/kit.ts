/* 动效小工具：时长 / 缓动 token（plan.md §0）、统一时钟、tween。
   移植自 motion/prototypes/motion-kit.js。时钟有两种：
   - 正常：真实时间（页面隐藏时暂停，回来不跳）；
   - 录屏：?rec 时由 scripts/record.mjs 调 window.__step(ms) 逐帧推进，60 帧均匀、可复现。 */
import { cubicBezier } from "motion";

export const T = { xs: 160, s: 240, m: 400, l: 600, xl: 800, flip: 720, fly: 2400, settle: 1200, stagger: 80, staggerL: 120 };

export type Ease = (x: number) => number;
export const E = {
  out: cubicBezier(0.22, 0.61, 0.36, 1), // --ease-out
  soft: cubicBezier(0.16, 1, 0.3, 1), // --ease-out-soft
  inout: cubicBezier(0.65, 0, 0.35, 1), // --ease-in-out
  in: cubicBezier(0.55, 0, 1, 0.45), // --ease-in
  glide: cubicBezier(0.3, 0.45, 0.35, 1), // --ease-glide
  linear: (x: number) => x,
} satisfies Record<string, Ease>;

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/* ---------- 时钟 ---------- */
let vt: number | null = null;
let offset = 0;
let hiddenAt: number | null = null;
export const isVirtual = () => vt !== null;
export const now = () => (vt !== null ? vt : performance.now() - offset);

type Task = { t: number; fn: () => void };
type Loop = (t: number) => void;
const tasks: Task[] = [];
const loops: Loop[] = [];
let rafOn = false;

function tick(t: number) {
  for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].t <= t) tasks.splice(i, 1)[0].fn();
  for (const f of loops.slice()) f(t);
}
function frame() {
  rafOn = false;
  if (vt !== null) return;
  tick(now());
  if (tasks.length || loops.length) wake();
}
function wake() {
  if (!rafOn && vt === null && typeof window !== "undefined") {
    rafOn = true;
    requestAnimationFrame(frame);
  }
}
export function at(ms: number, fn: () => void) {
  tasks.push({ t: ms, fn });
  wake();
}
export const after = (ms: number, fn: () => void) => at(now() + ms, fn);
export function loop(fn: Loop) {
  loops.push(fn);
  wake();
  pokeMonitor();
  return () => {
    const i = loops.indexOf(fn);
    if (i >= 0) loops.splice(i, 1);
  };
}
export type TweenOpts = { dur: number; delay?: number; ease?: Ease; on: (k: number, p: number) => void; done?: () => void };
/** 返回 stop()。on(k, p)：k = 缓动后进度，p = 线性进度 */
export function tween({ dur, delay = 0, ease = E.out, on, done }: TweenOpts) {
  const st = now() + delay;
  let fin = false;
  const stop = loop((t) => {
    if (t < st) return;
    const p = Math.min(1, (t - st) / dur);
    on(ease(p), p);
    if (p >= 1 && !fin) {
      fin = true;
      stop();
      done?.();
    }
  });
  return stop;
}

function initClock() {
  if (new URLSearchParams(location.search).has("rec")) {
    vt = 0;
    (window as unknown as { __step: (ms: number) => void }).__step = (ms: number) => {
      vt = ms;
      tick(ms);
    };
    return;
  }
  // 页面隐藏时时钟暂停（plan §1a、§1b：visibilitychange 时停），回来不跳时间
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt !== null) {
      offset += performance.now() - hiddenAt;
      hiddenAt = null;
      wake();
    }
  });
}

/* ---------- 环境：整站三档画质（plan v7 §10.9） ----------
   档 2 正常 / 档 1 低端 / 档 0 关闭（= reduced-motion，入场只淡入）。
   - 初始档：?tier=0|1|2 强制（忽略帧率与系统设置）；?low = 档 1；?rm = 档 0（不因系统 prefers-reduced-motion 自动降入档 0）；
     hardwareConcurrency ≤ 4 或 deviceMemory ≤ 4 → 档 1；其余档 2。录屏（?rec）固定档 2，除非带 ?tier / ?low / ?rm。
   - 判定档 judged：rAF 帧间隔 2s 滑动窗口实时判定，只降不升（自动降档最高只降到档 1，永不自动降到档 0）；出花速率这类可以立刻跟着 judged 变（onJudge）。
   - 生效档 applied：树怎么摆、镜头、入场是滑还是淡等「观感」只在静止时由 commitTier() 落地（开场解锁、屏间吸附稳定后）。
   env.rm / env.low / env.tier 读的都是生效档。 */
let applied: 0 | 1 | 2 = 2;
let judged: 0 | 1 | 2 = 2;
let forced = false;
export const env = {
  get tier() { return applied; },
  get rm() { return applied === 0; }, // 档 0：只淡入
  get low() { return applied <= 1; }, // 档 1 及以下：低端配额、无拖尾、F1
};
export const judgedTier = () => judged;
const judgeFns: ((t: 0 | 1 | 2) => void)[] = [];
const tierFns: ((t: 0 | 1 | 2, prev: 0 | 1 | 2) => void)[] = [];
/** 判定档一变就通知（只降不升）：用于立刻减半 / 停发出花 */
export const onJudge = (fn: (t: 0 | 1 | 2) => void) => judgeFns.push(fn);
/** 生效档变化时通知：各屏把已有元素切到新档的终态 */
export const onTier = (fn: (t: 0 | 1 | 2, prev: 0 | 1 | 2) => void) => tierFns.push(fn);
let holds = 0;
/** 翻面、彩蛋展开这类「做到一半」的动作期间不切档 */
export const holdTier = () => { holds++; return () => { holds = Math.max(0, holds - 1); }; };
function writeTier() {
  const h = document.documentElement;
  h.dataset.tier = String(applied);
  if (applied === 0) h.dataset.rm = ""; else delete h.dataset.rm;
}
/** 在静止点调用：把判定档落地成生效档。返回是否切了档 */
export function commitTier() {
  if (judged >= applied || holds > 0) return false;
  const prev = applied;
  applied = judged;
  writeTier();
  tierFns.forEach((f) => f(applied, prev));
  return true;
}
function judge(t: 0 | 1 | 2) {
  if (t >= judged) return;
  judged = t;
  document.documentElement.dataset.judged = String(t);
  judgeFns.forEach((f) => f(t));
}
function initEnv() {
  const q = new URLSearchParams(location.search);
  const qt = q.get("tier");
  let t: 0 | 1 | 2 = 2;
  if (qt === "0" || qt === "1" || qt === "2") { t = +qt as 0 | 1 | 2; forced = true; }
  else if (q.has("rm")) { t = 0; forced = true; }
  else if (q.has("low")) { t = 1; forced = true; }
  else if (q.has("rec")) { t = 2; forced = true; }
  else {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((navigator.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)) t = 1;
  }
  applied = judged = t;
  writeTier();
  document.documentElement.dataset.judged = String(t);
}

/* ---------- 帧率监测（§10.9「测什么 / 窗口 / 阈值」） ----------
   主指标 rAF 帧间隔 Δt；2.0s 滑动窗口，实际覆盖 ≥ 1.8s 才判定。
   自动降档上限为档 1（慢帧 Δt>20ms ≥ 40% 或平均 fps < 45），永不自动判入档 0（避免 iOS 键盘弹出或图片解码抖动误杀全部动效）。
   只在有东西在动（kit 的动画循环在跑、或最近 300ms 内滚动过）时记帧；空闲间隙不计入窗口。 */
const WIN = 2000, COVER = 1800;
/* 「低于 30 帧（Δt > 33.3ms）」：正好隔两个 vsync 的帧是 33.33ms（= 30 帧，不算低于），
   rAF 时间戳有 ±0.5ms 左右抖动，直接比 33.3 会让这类帧一半算、一半不算，结果随机。
   这里给 1ms 容差，只数真正掉到 30 帧以下（≥3 个 vsync）的帧。 */
const OVER33 = 33.3 + 1;
let samples: [number, number][] = []; // [时间戳, Δt]
let monOn = false, monLast = 0, lastPoke = -1e9;
export const frameStats = { windows: 0, worst: { slow: 0, fps: 60, over33: 0 }, log: [] as { at: number; tier: number; slow: number; fps: number; over33: number; from: number }[] };
function monFrame(t: number) {
  if (judged === 0) { monOn = false; return; }
  if (monLast) {
    const dt = t - monLast;
    if (dt < 500) samples.push([t, dt]); // 页面隐藏、后台回来这类长间隙不算
  }
  monLast = t;
  while (samples.length && samples[0][0] - samples[0][1] < t - WIN) samples.shift();
  const cover = samples.reduce((a, s) => a + s[1], 0);
  if (cover >= COVER) {
    const n = samples.length, slow = samples.filter((s) => s[1] > 20).length / n, over33 = samples.filter((s) => s[1] > OVER33).length / n, fps = 1000 / (cover / n);
    frameStats.windows++;
    if (slow > frameStats.worst.slow) frameStats.worst.slow = +slow.toFixed(3);
    if (fps < frameStats.worst.fps) frameStats.worst.fps = +fps.toFixed(1);
    if (over33 > frameStats.worst.over33) frameStats.worst.over33 = +over33.toFixed(3);
    const to = slow >= 0.4 || fps < 45 ? 1 : 2;
    if (to < judged) frameStats.log.push({ at: Math.round(t), tier: to, slow: +slow.toFixed(3), fps: +fps.toFixed(1), over33: +over33.toFixed(3), from: Math.round(samples[0][0] - samples[0][1]) }); // 验收读：何时、凭哪个窗口降档
    if (to < 2) judge(to);
  }
  const busy = loops.length > 0 || performance.now() - lastPoke < 300;
  if (busy && judged > 0 && !document.hidden) requestAnimationFrame(monFrame);
  else { monOn = false; monLast = 0; }
}
/** 有动画或滚动时叫一下，保证监测在跑 */
export function pokeMonitor() {
  lastPoke = performance.now();
  if (forced || vt !== null || judged === 0 || monOn || typeof window === "undefined") return;
  monOn = true;
  monLast = 0;
  requestAnimationFrame(monFrame);
}

/* ---------- 视口适配（spec §6） ----------
   H 只在首次加载和旋转屏幕（宽度变了）时读；键盘弹出、地址栏伸缩都不重排（G3）。 */
export const L = { W: 390, H: 844, Wc: 390, colL: 0, dx: 0, bx: 0, D: 0, o: 0, t: 0, fs: 1, ss: 1 };
const layoutFns: (() => void)[] = [];
export const onLayout = (fn: () => void) => { layoutFns.push(fn); return () => { const i = layoutFns.indexOf(fn); if (i >= 0) layoutFns.splice(i, 1); }; };
export function computeLayout(W: number, H: number) {
  const Wc = Math.min(W, 430), Hl = Math.max(H, 664); // H < 664 按 664 排，底部由屏幕裁掉
  const D = Math.max(0, 844 - Hl), t = Math.min(14, 0.08 * D);
  const sMin = (Wc + 24) / 430.1;
  const fs = clamp((Hl - (140 - t) - 24) / 573.4, sMin, 1); // 02 相框缩放（§6.2）
  const ss = clamp(Math.min(Wc / 390, (H - 6) / 844), 0.65, 1.08);
  Object.assign(L, { W, H, Wc, colL: (W - Wc) / 2, dx: (Wc - 390) / 2, bx: W > 430 ? 64 : 0, D, o: Math.max(0, (H - 844) / 2), t, fs: Math.min(1, fs), ss });
  const h = document.documentElement, set = (k: string, v: number) => h.style.setProperty(k, +v.toFixed(3) + "px");
  set("--W", W); set("--H", H); set("--Wc", Wc); set("--colL", L.colL); set("--dx", L.dx); set("--bx", L.bx); set("--o", L.o); set("--t", t);
  h.style.setProperty("--D", String(+D.toFixed(3))); // 系数写法 calc(a * var(--D) * 1px)
  h.style.setProperty("--fs", String(+L.fs.toFixed(5)));
  h.style.setProperty("--ss", String(+ss.toFixed(5)));
  if (W > 430) h.dataset.wide = ""; else delete h.dataset.wide;
  layoutFns.forEach((f) => f());
}
/** 设计坐标 y 换成 CSS top：y' = y + a·D + o（§6.1 第 5、6 条） */
export const Y = (y: number, a = 0) => (a ? `calc(${y}px + ${a} * var(--D) * 1px + var(--o))` : `calc(${y}px + var(--o))`);
/** 左上标题：上提 t，且外接框顶不小于 safe-top + 16（§6.1 第 7、9 条）。box = 原点 top 到外接框顶的距离 */
export const YT = (y: number, box = 0) => `max(calc(${y}px - var(--t) + var(--o)), calc(env(safe-area-inset-top, 0px) + ${16 + box}px))`;
/** 底部锚定的文字：离底边 ≥ safe-bottom + 8（§6.1 第 9 条）。h = 文字行盒高 */
export const YB = (y: number, a: number, h: number) => `min(${Y(y, a)}, calc(var(--H) - ${h + 8}px - env(safe-area-inset-bottom, 0px)))`;
/** 贴左边距的标题字组：x' = colL + x（不加 dx） */
export const XT = (x: number) => `calc(${x}px - var(--dx))`;

/* ---------- 按屏加载图片（G6） ---------- */
/** 把 root 里 img[data-src] 换成真实 src，返回全部解码完成的 Promise（失败也算完成） */
export function loadImgs(root: ParentNode) {
  const imgs = [...root.querySelectorAll<HTMLImageElement>("img[data-src]")];
  imgs.forEach((i) => { if (!i.getAttribute("src")) i.src = i.dataset.src!; });
  return Promise.all(imgs.map((i) => i.decode().catch(() => undefined))).then(() => undefined);
}

/* ---------- 便捷动画（只写 transform / opacity） ---------- */
export const op = (el: HTMLElement, v: number) => (el.style.opacity = v.toFixed(3));
export function fade(el: HTMLElement, delay: number, dur: number = T.l, ease: Ease = E.out, to = 1, from = 0, done?: () => void) {
  return tween({ dur, delay, ease, on: (k) => op(el, lerp(from, to, k)), done });
}
/** §8：字组每行沿 7° 轴 translateX(−14→0) + 淡入，800 / --ease-out-soft；reduced-motion 只淡入 300 */
export function slideLines(lines: HTMLElement[], delay = 0, stagger: number = T.staggerL) {
  lines.forEach((el, i) => {
    if (env.rm) return fade(el, delay + i * stagger, 300);
    el.style.willChange = "transform,opacity";
    tween({
      dur: T.xl,
      delay: delay + i * stagger,
      ease: E.soft,
      on: (k) => {
        op(el, k);
        el.style.transform = `translateX(${lerp(-14, 0, k).toFixed(2)}px)`;
      },
      done: () => {
        el.style.transform = "none";
        el.style.willChange = "auto"; // §10.6：滑完去掉，免得中文发糊
      },
    });
  });
}
/** 从下方 dy 升起 + 淡入（卡片、花束） */
export function rise(el: HTMLElement, delay: number, dy: number, dur: number = T.l, ease: Ease = E.soft) {
  if (env.rm) return fade(el, delay, 300);
  return tween({
    dur,
    delay,
    ease,
    on: (k) => {
      op(el, k);
      el.style.transform = k >= 1 ? "none" : `translateY(${lerp(dy, 0, k).toFixed(2)}px)`;
    },
  });
}
export const $ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => root.querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => [...root.querySelectorAll(s)] as T[];

// 模块一加载（浏览器里、各屏 effect 之前）就定好时钟和档位
if (typeof window !== "undefined") {
  initClock();
  initEnv();
  if (vt !== null) document.documentElement.dataset.rec = "";
}
