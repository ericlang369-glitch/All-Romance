/* 第 1 屏：树摆（§1c）、零星飘落（§1d）、水波纹（§1a）、密码门（§2）、一阵风 v4 + 逐簇扯落（§1b、§1c）。
   逐行移植自 motion/prototypes/01-opening.html，参数、随机种子、曲线都不改。
   只动 transform / opacity；风和落花画在一张 Canvas 上（像素比上限 2），模糊全部预渲染成贴图。 */
import TLraw from "@/data/tree-layout.json";
import { BASE_PATH, PASSCODE, DAY100_CODE } from "@/config";
import { E, L, T, after, clamp, commitTier, env, lerp, loop, now, onJudge, onLayout, onTier, op, smooth, tween } from "./kit";

type Pt = number[];
type GroupData = { anchor: number[]; fullBox: number[]; counts: Record<string, number>; detach: Pt[]; drop: Pt[]; keep: Pt[] };
type Layer = { id: string; z: number; group: string; kind: string; set: string; src: string; x: number; y: number; w: number; h: number };
const TL = TLraw as unknown as { layers: Layer[]; groups: Record<string, GroupData> };
const TREE_BASE = `${BASE_PATH}/assets/tree/`;

const SK = "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";
const SP = "M0 -1.60 C 3.52 -3.84, 6.08 -6.72, 5.92 -10.56 C 5.76 -13.76, 3.52 -15.68, 1.44 -15.20 L 0 -13.28 L -1.44 -15.20 C -3.52 -15.68, -5.76 -13.76, -5.92 -10.56 C -6.08 -6.72, -3.52 -3.84, 0 -1.60 Z";
/** 静止的白色五瓣樱花（水波纹圆心那朵，spec §7 01：18px、旋转 6°） */
const sakuraSVG = (s: number, rot = 0) =>
  `<svg width="${s}" height="${s}" viewBox="-10 -10 20 20" style="display:block;transform:rotate(${rot}deg)"><g fill="#fff">${[0, 72, 144, 216, 288]
    .map((r) => `<path d="${SK}" transform="rotate(${r})"/>`)
    .join("")}<circle r="2.2"/></g></svg>`;

export type OpeningEls = {
  root: HTMLElement; tree: HTMLElement; calm: HTMLElement; row: HTMLElement; burst: HTMLElement; again: HTMLElement;
  input: HTMLInputElement; passLines: HTMLElement[]; titleLines: HTMLElement[]; hintTxt: HTMLElement; hintLine: HTMLElement; canvas: HTMLCanvasElement;
};
export type OpeningCallbacks = { onUnlock: () => void };

export function createOpening(el: OpeningEls, cb: OpeningCallbacks) {
  // 档位（plan v7 §10.9）：开场一开始的档决定配额；之后判定降档立刻减量出花，观感在解锁时落地
  let RM = env.rm, LOW_END = env.low;
  let rs = 20261203;
  const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0), rs / 4294967296);
  const range = (a: number | number[]) => (Array.isArray(a) ? a[0] + rnd() * (a[1] - a[0]) : a);
  const G = { rise: 1500, hold: 2800, end: 5200, fadeFrom: 3200, tailEnd: 6200 };
  const WIND = (t: number) => (t < G.rise ? smooth(t / G.rise) : t < G.hold ? 1 : smooth(1 - (t - G.hold) / (G.end - G.hold)));
  const THETA = (38 * Math.PI) / 180;
  let gustT0: number | null = null;
  const gustE = (t: number) => (gustT0 === null ? -1 : t - gustT0);
  const DPR = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

  /* ---------- 树：33 层，10 个摆动组 ---------- */
  type GP = { design: number; peak: number; Tn: number; calmA: number; calmT: number; calmPh: number; delay: number; turbPh: number; turbPh2: number; A: number };
  const mkGP = (design: number, peak: number, Tn: number, calmA: number, calmT: number, calmPh: number): GP => ({ design, peak, Tn, calmA, calmT, calmPh, delay: 0, turbPh: 0, turbPh2: 0, A: 0 });
  const GPS: Record<string, GP> = {
    top1: mkGP(-6, -7.7, 3.0, 0.7, 5.2, 0.0), top2: mkGP(-5.5, -7.4, 3.2, 0.6, 6.1, 1.3), top3: mkGP(-6.5, -8.3, 3.1, 0.8, 4.6, 2.4),
    top4: mkGP(-5, -6.8, 3.3, 0.6, 5.7, 3.6), top5: mkGP(-6, -8.1, 3.0, 0.7, 6.6, 4.4), top6: mkGP(-4, -5.4, 2.8, 0.5, 4.9, 5.5),
    left1: mkGP(-2.5, -3.4, 3.8, 0.45, 6.8, 0.7), left2: mkGP(-3, -4.1, 3.6, 0.4, 5.9, 2.0), left3: mkGP(-3.5, -4.7, 3.4, 0.35, 5.3, 3.1),
    left4: mkGP(-3, -4.1, 3.0, 0.3, 4.4, 4.2),
  };
  const ZETA = 0.15, WAVE = 420, LIMIT = { top: 8.5, left: 5 };
  type Group = { d: HTMLDivElement; imgs: Record<string, HTMLImageElement>; anchor: number[]; name: string; th: number; v: number; osc: number; x0: number; y0: number };
  const groups: Record<string, Group> = {};
  const windImgs: HTMLImageElement[] = [];
  const windReady = new Map<HTMLImageElement, boolean>();
  const windWaiters = new Map<HTMLImageElement, ((ok: boolean) => void)[]>();
  let windP: Promise<unknown> | null = null;
  const onWindReady = (im: HTMLImageElement, fn: (ok: boolean) => void) => {
    if (windReady.has(im)) fn(windReady.get(im)!);
    else {
      const q = windWaiters.get(im) || [];
      q.push(fn);
      windWaiters.set(im, q);
    }
  };
  const loadWind = () =>
    (windP ||= Promise.all(
      windImgs.map((im) => {
        im.src = im.dataset.src!;
        return im.decode().then(
          () => true,
          () => im.complete && im.naturalWidth > 0,
        ).then((ok) => {
          const good = ok && im.naturalWidth > 0;
          windReady.set(im, good);
          windWaiters.get(im)?.forEach((fn) => fn(good));
          windWaiters.delete(im);
        });
      }),
    ));
  const preview = document.createElement("img");
  preview.src = `${BASE_PATH}/assets/tree-calm-preview.webp`;
  preview.alt = "";
  preview.decoding = "sync";
  preview.setAttribute("fetchpriority", "high");
  preview.style.cssText = "position:absolute;left:0;top:0;width:390px;height:844px;pointer-events:none;z-index:0;transition:opacity 220ms ease";
  el.tree.appendChild(preview);
  const calmDecodes: Promise<void>[] = [];
  const calmGroups: HTMLDivElement[] = [];

  const byGroup: Record<string, Layer[]> = {};
  TL.layers.forEach((l) => (byGroup[l.group] = byGroup[l.group] || []).push(l));
  function makeGroup(name: string, ls: Layer[], anchor: number[]): Group {
    const x0 = Math.min(...ls.map((l) => l.x)), y0 = Math.min(...ls.map((l) => l.y));
    const x1 = Math.max(...ls.map((l) => l.x + l.w)), y1 = Math.max(...ls.map((l) => l.y + l.h));
    const d = document.createElement("div");
    d.className = "g";
    d.dataset.g = name;
    d.style.cssText += `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;transform-origin:${anchor[0] - x0}px ${anchor[1] - y0}px;opacity:0;transition:opacity 220ms ease`;
    calmGroups.push(d);
    const imgs: Record<string, HTMLImageElement> = {};
    ls.sort((a, b) => a.z - b.z).forEach((l) => {
      const im = new Image();
      const src = TREE_BASE + l.src.replace(/\.png$/i, ".webp");
      // G6：风吹后那套（只有风里和风后用）先不加载，第一次碰屏幕 / 按键时再取；减少动态效果档根本用不到
      if (l.set === "wind") { im.dataset.src = src; windImgs.push(im); }
      else {
        im.src = src;
        calmDecodes.push(im.decode().catch(() => undefined));
      }
      im.alt = "";
      im.decoding = "async";
      im.style.cssText = `left:${l.x - x0}px;top:${l.y - y0}px;width:${l.w}px;height:${l.h}px`;
      if (l.set === "wind") im.style.opacity = "0";
      d.appendChild(im);
      imgs[l.kind.replace("fardots-", "flowers-")] = im;
    });
    el.tree.appendChild(d);
    return { d, imgs, anchor, name, th: 0, v: 0, osc: 0, x0, y0 };
  }
  ["fardots", "trunk", "top1", "top2", "top3", "top4", "top5", "top6", "left1", "left2", "left3", "left4"].forEach((n) => {
    const a = TL.groups[n].anchor;
    groups[n] = makeGroup(n, byGroup[n], a);
    const p = GPS[n];
    if (p) {
      p.delay = Math.max(0, ((a[0] * Math.cos(THETA) + a[1] * Math.sin(THETA)) / WAVE) * 1000);
      p.turbPh = rnd() * 6.28;
      p.turbPh2 = rnd() * 6.28;
    }
  });
  Promise.all(calmDecodes).then(() => {
    const reveal = () => {
      calmGroups.forEach((d) => { d.style.opacity = "1"; });
      preview.style.opacity = "0";
      window.setTimeout(() => preview.remove(), 260);
    };
    if (RM) reveal();
    else requestAnimationFrame(reveal);
  });
  const force = (p: GP, e: number) => {
    const t = e - p.delay;
    if (t < 0) return 0;
    const w = WIND(t);
    return -(w * w) * (1 + 0.22 * Math.sin((2 * Math.PI * t) / 1600 + p.turbPh) + 0.12 * Math.sin((2 * Math.PI * t) / 900 + p.turbPh2));
  };
  for (const n in GPS) {
    const p = GPS[n], w = (2 * Math.PI) / p.Tn;
    let th = 0, v = 0, mx = 0;
    for (let e = 0; e < 9000; e += 1000 / 60) {
      const a = w * w * (force(p, e) - th) - 2 * ZETA * w * v;
      v += a / 60;
      th += v / 60;
      mx = Math.max(mx, -th);
    }
    p.A = -p.peak / mx;
  }
  const swingGroups = () => (LOW_END ? ["top1", "top3", "top5", "left1"] : Object.keys(GPS));
  let lastTreeT: number | null = null;
  function stepTree(t: number) {
    const dt = lastTreeT === null ? 0 : Math.min(0.05, (t - lastTreeT) / 1000);
    lastTreeT = t;
    const e = gustE(t);
    for (const n of swingGroups()) {
      const g = groups[n], p = GPS[n], w = (2 * Math.PI) / p.Tn;
      const F = e >= 0 ? p.A * force(p, e) : 0;
      const a = w * w * (F - g.osc) - 2 * ZETA * w * g.v;
      g.v += a * dt;
      g.osc += g.v * dt;
      const calm = (LOW_END ? 0 : 1) * p.calmA * Math.sin((2 * Math.PI * t) / 1000 / p.calmT + p.calmPh);
      g.th = g.osc + calm;
      const lim = n[0] === "t" ? LIMIT.top : LIMIT.left;
      if (Math.abs(g.th) > lim) g.th = Math.sign(g.th) * lim;
      g.d.style.transform = `rotate(${g.th.toFixed(3)}deg)`;
    }
    const fd = groups.fardots, w = e >= 0 ? WIND(e) : 0;
    fd.d.style.transform = `translate(${(10 * w + 1.5 * Math.sin(t / 3100)).toFixed(2)}px,${(5 * w).toFixed(2)}px)`;
  }

  /* ---------- 满花 → 风吹后：逐簇扯落（§1c） ---------- */
  const SWAP_AT = 950;
  const DET = {
    start: 1000, span: 1500, rClump: LOW_END ? 20 : 14, maxClump: LOW_END ? 10 : 6,
    life: LOW_END ? [1.1, 1.9] : [2.2, 3.8], lifeOver: [0.7, 1.0], dotShare: LOW_END ? 0 : 0.3, dotLife: [0.5, 0.9], cap: LOW_END ? 170 : 380,
  };
  const DSPR: Record<number, HTMLCanvasElement> = {};
  function dSprite(type: number) {
    if (DSPR[type]) return DSPR[type];
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    x.translate(32, 32);
    x.scale(3.2, 3.2);
    x.fillStyle = "#fff";
    const p = new Path2D(SK);
    for (let i = 0; i < 5; i++) {
      x.fill(p);
      x.rotate((Math.PI * 2) / 5);
    }
    x.beginPath();
    x.arc(0, 0, 2.2, 0, 7);
    x.fill();
    if (type === 1) {
      x.fillStyle = "#0B1E8C";
      x.globalAlpha = 0.5;
      x.beginPath();
      x.arc(0, 0, 1.5, 0, 7);
      x.fill();
      x.globalAlpha = 0.55;
      [[2, -2.75], [3.23, 1.05], [0, 3.4], [-3.23, 1.05], [-2, -2.75]].forEach(([a, b]) => {
        x.beginPath();
        x.arc(a, b, 0.55, 0, 7);
        x.fill();
      });
    }
    return (DSPR[type] = c);
  }
  function paintEl(c: CanvasRenderingContext2D, e: Pt, bx: number, by: number, erase: boolean) {
    c.setTransform(DPR, 0, 0, DPR, (e[1] - bx) * DPR, (e[2] - by) * DPR);
    c.globalCompositeOperation = erase ? "destination-out" : "source-over";
    c.globalAlpha = erase ? 1 : e[5];
    if (e[0] === 2) {
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(0, 0, e[4] + (erase ? 0.5 : 0), 0, 7);
      c.fill();
      return;
    }
    c.rotate((e[3] * Math.PI) / 180);
    const k = e[4] * (erase ? 1.18 : 1);
    c.drawImage(dSprite(e[0]), -10 * k, -10 * k, 20 * k, 20 * k);
  }
  const elR = (e: Pt) => (e[0] === 2 ? e[4] + 0.5 : 10 * e[4] * 1.05);
  type Spr = { c: HTMLCanvasElement; ox: number; oy: number; w: number; h: number };
  function clumpSprite(m: Pt[], cx0: number, cy0: number): Spr {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    m.forEach((e) => {
      const r = elR(e);
      x0 = Math.min(x0, e[1] - r); y0 = Math.min(y0, e[2] - r); x1 = Math.max(x1, e[1] + r); y1 = Math.max(y1, e[2] + r);
    });
    x0 = Math.floor(x0 - 1); y0 = Math.floor(y0 - 1);
    const w = Math.ceil(x1 + 1 - x0), h = Math.ceil(y1 + 1 - y0);
    const c = document.createElement("canvas");
    c.width = w * DPR; c.height = h * DPR;
    const x = c.getContext("2d")!;
    m.forEach((e) => paintEl(x, e, x0, y0, false));
    return { c, ox: x0 - cx0, oy: y0 - cy0, w, h };
  }
  type Clump = { m: Pt[]; dots: Pt[]; loose?: boolean; off?: Pt[]; spr?: Spr };
  type Det = { c: HTMLCanvasElement; cx: CanvasRenderingContext2D; bx: number; by: number; swapped: boolean; queue: { t: number; c: Clump }[]; i: number };
  const detach: Record<string, Det> = {};
  const beta22 = () => {
    for (;;) {
      const x = rnd();
      if (rnd() < 4 * x * (1 - x)) return x;
    }
  };
  function prepDetach() {
    rs = 20261207;
    for (const n of Object.keys(GPS)) {
      const g = groups[n], gd = TL.groups[n], [bx, by, bw, bh] = gd.fullBox, a = gd.anchor, p = GPS[n];
      const c = document.createElement("canvas");
      c.width = Math.ceil(bw * DPR); c.height = Math.ceil(bh * DPR);
      c.style.cssText = `position:absolute;left:${bx - g.x0}px;top:${by - g.y0}px;width:${bw}px;height:${bh}px;display:none`;
      g.d.appendChild(c);
      const cx = c.getContext("2d")!;
      gd.detach.forEach((e) => paintEl(cx, e, bx, by, false));
      const vis = (e: Pt) => e[1] >= -12 && e[1] <= 402 && e[2] >= -12 && e[2] <= 856;
      const fl = gd.detach.filter((e) => e[0] < 2 && vis(e)), dots = gd.detach.filter((e) => e[0] === 2 && vis(e)), off = gd.detach.filter((e) => !vis(e));
      const rMax = Math.max(1, ...gd.detach.filter(vis).map((e) => Math.hypot(e[1] - a[0], e[2] - a[1])));
      const used = new Set<Pt>(), clumps: Clump[] = [];
      fl.slice().sort((u, v) => v[4] - u[4]).forEach((f) => {
        if (used.has(f)) return;
        used.add(f);
        const m = [f];
        fl.filter((o) => !used.has(o)).map((o) => [o, Math.hypot(o[1] - f[1], o[2] - f[2])] as [Pt, number]).filter((q) => q[1] <= DET.rClump)
          .sort((u, v) => u[1] - v[1]).slice(0, DET.maxClump - 1).forEach(([o]) => { used.add(o); m.push(o); });
        clumps.push({ m, dots: [] });
      });
      dots.forEach((d) => {
        let best: Clump | null = null, bd = DET.rClump * 0.7;
        clumps.forEach((c) => {
          if (!c.m.length) return;
          const q = Math.hypot(c.m[0][1] - d[1], c.m[0][2] - d[2]);
          if (q < bd) { bd = q; best = c; }
        });
        if (best) (best as Clump).dots.push(d);
        else clumps.push({ m: [], dots: [d], loose: true });
      });
      const when = (x: number, y: number) => {
        const rN = Math.hypot(x - a[0], y - a[1]) / rMax;
        const u = clamp(0.5 * beta22() + 0.5 * (1 - rN) + (rnd() - 0.5) * 0.12, 0, 1);
        return p.delay + DET.start + DET.span * u;
      };
      const q: { t: number; c: Clump }[] = [];
      clumps.forEach((c) => {
        const h = c.m[0] || c.dots[0];
        if (c.m.length) c.spr = clumpSprite(c.m.concat(c.dots), h[1], h[2]);
        q.push({ t: when(h[1], h[2]), c });
      });
      off.forEach((e) => q.push({ t: when(e[1], e[2]), c: { m: [], dots: [], off: [e] } }));
      q.sort((u, v) => u.t - v.t);
      detach[n] = { c, cx, bx, by, swapped: false, queue: q, i: 0 };
    }
  }
  function stepDetach(e: number) {
    for (const n in detach) {
      const D = detach[n], g = groups[n], p = GPS[n];
      if (!D.swapped && e >= p.delay + SWAP_AT) {
        D.swapped = true;
        const fImg = g.imgs["flowers-full"], wImg = g.imgs["flowers-wind"];
        if (windReady.get(wImg)) {
          fImg.style.display = "none";
          wImg.style.opacity = "1";
          D.c.style.display = "block";
        } else {
          onWindReady(wImg, (ok) => {
            if (RM || !ok) { D.c.remove(); return; }
            if (D.i < D.queue.length) D.c.style.display = "block";
            else D.c.remove();
            tween({ dur: 240, ease: E.out, on: (k) => op(wImg, k) });
            tween({ dur: 240, delay: 120, ease: E.out, on: (k) => op(fImg, 1 - k), done: () => (fImg.style.display = "none") });
          });
        }
      }
      while (D.i < D.queue.length && D.queue[D.i].t <= e) {
        const { c } = D.queue[D.i++];
        (c.off || []).forEach((x) => paintEl(D.cx, x, D.bx, D.by, true));
        c.m.forEach((f) => paintEl(D.cx, f, D.bx, D.by, true));
        c.dots.forEach((d) => paintEl(D.cx, d, D.bx, D.by, true));
        if (stopEmit) continue; // 档 0：照常擦掉树上的花，但不再放出新的
        if (c.m.length) spawnTreePart(g, c.m[0], c.spr || null, treeParts.length >= DET.cap);
        else if (c.loose && rnd() < DET.dotShare) spawnTreePart(g, c.dots[0], null, false);
      }
      if (D.swapped && D.i >= D.queue.length && D.c.style.display !== "none") {
        D.c.style.display = "none"; // 全部扯完：移除这张 Canvas，只剩风吹后 PNG
        D.c.remove();
      }
    }
  }
  function rotPt(g: Group, x: number, y: number) {
    const a = (g.th * Math.PI) / 180, dx = x - g.anchor[0], dy = y - g.anchor[1];
    return [g.anchor[0] + dx * Math.cos(a) - dy * Math.sin(a), g.anchor[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  }

  /* ---------- 水波纹：每 6s 一次 + 圆心那朵 18px 静止花（plan v7 §1a，G5） ----------
     位置按 spec §6.2：密码页圆心 y = 610 − 0.35·D，进门后 610 − 0.65·D；三圈半径同乘 s = clamp(1 − D/250, .5, 1)，线宽和花不缩 */
  let calmOn = 1;
  const rings = ([[26, 0.8], [52, 0.45], [84, 0.22]] as const).map(([r, o]) => {
    const e = document.createElement("div");
    e.className = "ring";
    e.style.opacity = String(o);
    el.calm.appendChild(e);
    return { e, o, r };
  });
  const cflower = document.createElement("div");
  cflower.className = "cflower";
  cflower.innerHTML = sakuraSVG(18, 6);
  el.calm.appendChild(cflower);
  let rippleMode: "pass" | "title" = "pass";
  function placeCalm() {
    const cy = (rippleMode === "pass" ? 610 - 0.35 * L.D : 610 - 0.65 * L.D) + L.o, k = clamp(1 - L.D / 210, 0.46, 1);
    rings.forEach(({ e, r }) => (e.style.cssText += `left:${206 - r * k}px;top:${cy - r * k}px;width:${2 * r * k}px;height:${2 * r * k}px`));
    cflower.style.cssText += `left:${206 - 9}px;top:${cy - 9}px`;
  }
  function stepRings(t: number) {
    const c = (t % 6000) / 6000;
    rings.forEach((r, i) => {
      const k = clamp((c - i * 0.06) / 0.55, 0, 1), e = E.out(k);
      r.e.style.transform = `scale(${(0.6 + 0.4 * e).toFixed(4)})`;
      op(r.e, r.o * Math.sin(Math.PI * k) * calmOn);
    });
    op(cflower, calmOn);
  }

  /* ---------- Canvas：风里的花 + 零星飘落 ---------- */
  const cv = el.canvas, ctx = cv.getContext("2d")!;
  // Canvas 盖满整屏宽（宽屏含列外 64px），设计坐标原点在 OX；高 = 屏高
  let OX = 0, CW = 390, CH = 844;
  function sizeCanvas() {
    OX = L.dx + L.bx; CW = L.Wc + 2 * L.bx; CH = Math.max(1, Math.round(L.H));
    cv.width = Math.round(CW * DPR); cv.height = CH * DPR;
    cv.style.cssText += `left:${-OX}px;width:${CW}px;height:${CH}px`;
  }
  sizeCanvas();
  /* 矮屏（§6.2）：标题下方区间 [top, 844] 线性压到 [top, 844 − D]；高屏整体下移 o */
  const below = (y: number, top: number) => (y <= top ? y + L.o : top + L.o + ((y - top) * (844 - L.D + L.o - top)) / (844 - top));
  /* 风带：中心线 (−40,40)→(430,800)，终点 y 按 800 − D（§6.2） */
  const bandY = (y: number) => (y <= 40 ? y : 40 + ((y - 40) * (760 - L.D + 2 * L.o)) / 760);
  type Sprite = { c: HTMLCanvasElement; S: number };
  const sprCache: Record<string, Sprite> = {};
  function sprite(size: number, blur: number, kind: string): Sprite {
    const key = kind + "|" + size.toFixed(1) + "|" + blur;
    if (sprCache[key]) return sprCache[key];
    const pad = Math.ceil(blur * 3) + 1, S = Math.ceil(size + pad * 2), c = document.createElement("canvas");
    c.width = c.height = S * DPR;
    const x = c.getContext("2d")!;
    x.scale(DPR, DPR);
    if (blur) x.filter = `blur(${blur}px)`;
    x.translate(S / 2, S / 2);
    x.fillStyle = "#fff";
    if (kind === "dot") { x.beginPath(); x.arc(0, 0, size / 2, 0, 7); x.fill(); }
    else {
      const k = size / 20;
      x.scale(k, k);
      const p = new Path2D(kind === "petal" ? SP : SK);
      if (kind === "petal") { x.translate(0, 8); x.fill(p); }
      else { for (let i = 0; i < 5; i++) { x.fill(p); x.rotate((Math.PI * 2) / 5); } x.beginPath(); x.arc(0, 0, 2.2, 0, 7); x.fill(); }
    }
    return (sprCache[key] = { c, S });
  }
  type Flake = { kind: string; sp: Sprite; rot: number; vr: number; fx: number; fy: number; fph: number };
  function drawSprite(p: Flake, x: number, y: number, o: number, a: number) {
    ctx.globalAlpha = o;
    ctx.setTransform(DPR, 0, 0, DPR, (x + OX) * DPR, y * DPR);
    if (p.kind !== "dot") {
      ctx.rotate(((p.rot + p.vr * a) * Math.PI) / 180);
      ctx.scale(0.3 + 0.7 * Math.pow(Math.abs(Math.cos(p.fx * a + p.fph)), 0.6), 0.3 + 0.7 * Math.pow(Math.abs(Math.cos(p.fy * a + p.fph * 1.7)), 0.6));
    }
    ctx.drawImage(p.sp.c, -p.sp.S / 2, -p.sp.S / 2, p.sp.S, p.sp.S);
  }

  type LayerDef = { name: "far" | "mid" | "pet" | "near"; n: number; emitEnd: number; v: number[]; fall: number; sw: number[]; sf: number[]; vr: number | number[]; ff: number | number[]; size: () => number; blur: number; op: () => number; kind: string };
  const SHARE = { far: 0.6, mid: 0.55, pet: 0.55, near: 0 };
  const LAYERS: LayerDef[] = [
    { name: "far", n: 80, emitEnd: 2500, v: [130, 160], fall: 14, sw: [6, 12], sf: [0.25, 0.5], vr: 0, ff: 0, size: () => 1.6 + rnd() * 2, blur: 0.9, op: () => 0.55 + rnd() * 0.35, kind: "dot" },
    { name: "mid", n: 120, emitEnd: 2700, v: [180, 220], fall: 22, sw: [10, 22], sf: [0.3, 0.7], vr: [20, 90], ff: [0.35, 0.9], size: () => [7, 8, 9, 10, 11, 12, 13, 15][Math.floor(rnd() * 8)], blur: 0, op: () => 0.95, kind: "sk" },
    { name: "pet", n: 36, emitEnd: 2700, v: [190, 230], fall: 26, sw: [12, 26], sf: [0.35, 0.8], vr: [40, 140], ff: [0.5, 1.2], size: () => 6 + rnd() * 4, blur: 0, op: () => 0.9, kind: "petal" },
    { name: "near", n: 7, emitEnd: 2400, v: [260, 300], fall: 30, sw: [14, 30], sf: [0.25, 0.5], vr: [15, 50], ff: [0.25, 0.5], size: () => 24 + rnd() * 14, blur: 1.6, op: () => 0.9, kind: "sk" },
  ];
  const entry = (u: number) => { const PT = 0.38; return u < PT ? [-40 + (u / PT) * 440, -24] : [-24, bandY(-20 + ((u - PT) / (1 - PT)) * 880)]; };
  function invEnv(c: number, emitEnd: number) {
    const N = 200, acc = [0];
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + WIND((emitEnd * i) / N));
    const tot = acc[N];
    for (let i = 1; i <= N; i++) if (acc[i] / tot >= c) { const a = acc[i - 1] / tot, b = acc[i] / tot; return (emitEnd * (i - 1 + (c - a) / (b - a || 1))) / N; }
    return emitEnd;
  }
  const density = (u: number) => 1 - 0.3 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 2.3 + 1.1)) * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 0.9 + 2.4));
  const TREE_GROUPS = ["top1", "top2", "top3", "top4", "top5", "top6", "left1", "left2", "left3", "left4"];
  function pickGroup(weights: number[], total: number) {
    let r = rnd() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return TREE_GROUPS[i]; }
    return TREE_GROUPS[0];
  }
  type Part = Flake & { L: LayerDef; s: number; tb: number; x: number; y: number; dx: number; dy: number; v: number; sw: number; sf: number; sph: number; o: number; fade: number; dead?: boolean };
  type TreePart = { spr: Spr | null; s: number; rot: number; o: number; x: number; y: number; vx: number; vy: number; ux: number; uy: number; fall: number; tau: number; life: number; t0: number | null; sw: number; sf: number; sph: number; vr: number; fx: number; fy: number };
  let parts: Part[] = [], treeParts: TreePart[] = [];
  function spawnTreePart(g: Group, f: Pt, spr: Spr | null, over: boolean) {
    const [x, y] = rotPt(g, f[1], f[2]), a = g.anchor, w = ((g.v || 0) * Math.PI) / 180;
    const th = THETA + (rnd() - 0.5) * 0.4, J = spr ? range([50, 110]) : range([30, 70]);
    const V = range([150, 205]);
    treeParts.push({
      spr, s: f[4], rot: g.th, o: spr ? 1 : f[5], x, y,
      vx: -w * (y - a[1]) + Math.cos(th) * J, vy: w * (x - a[0]) + Math.sin(th) * J, ux: Math.cos(th) * V, uy: Math.sin(th) * V, fall: range([18, 30]),
      tau: range([0.35, 0.7]), life: spr ? (over ? range(DET.lifeOver) : range(DET.life)) : range(DET.dotLife), t0: null, sw: range([8, 20]), sf: range([0.3, 0.7]) * 2 * Math.PI, sph: rnd() * 6.28,
      vr: (rnd() < 0.5 ? -1 : 1) * range([30, 120]), fx: range([0.35, 0.9]) * 2 * Math.PI, fy: range([0.35, 0.9]) * 2 * Math.PI * 0.7,
    });
  }
  function drawTreeParts(e: number, dt: number, w: number, tail: number) {
    const gain = 0.55 + 0.45 * w, keep: TreePart[] = [];
    for (const p of treeParts) {
      if (p.t0 === null) p.t0 = e;
      const a = (e - p.t0) / 1000, k = Math.min(1, dt / p.tau);
      p.vx += (p.ux * gain - p.vx) * k;
      p.vy += (p.uy * gain + p.fall - p.vy) * k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const ramp = smooth(a / 0.9), sway = p.sw * Math.sin(p.sf * a + p.sph) * ramp, x = p.x - Math.sin(THETA) * sway, y = p.y + Math.cos(THETA) * sway;
      const life = 1 - smooth((a - p.life * 0.6) / (p.life * 0.4));
      if (life <= 0 || x < -OX - 40 || x > CW - OX + 40 || y > CH + 46) continue;
      keep.push(p);
      const o = p.o * life * tail;
      if (o <= 0.01) continue;
      ctx.globalAlpha = o;
      ctx.setTransform(DPR, 0, 0, DPR, (x + OX) * DPR, y * DPR);
      if (!p.spr) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); }
      else {
        const fa = Math.max(0, a - 0.12) * ramp;
        ctx.rotate(((p.rot + p.vr * a * ramp) * Math.PI) / 180);
        ctx.scale(0.3 + 0.7 * Math.pow(Math.abs(Math.cos(p.fx * fa)), 0.6), 0.3 + 0.7 * Math.pow(Math.abs(Math.cos(p.fy * fa)), 0.6));
        const S = p.spr;
        ctx.drawImage(S.c, S.ox, S.oy, S.w, S.h);
      }
    }
    treeParts = keep;
  }
  function add(L: LayerDef, [x, y]: number[], tb: number, fadeS: number) {
    const s = L.size(), th = THETA + (rnd() - 0.5) * 0.35;
    parts.push({
      L, kind: L.kind, s, sp: sprite(s, L.blur, L.kind), tb, x, y, dx: Math.cos(th), dy: Math.sin(th), v: range(L.v), sw: range(L.sw), sf: range(L.sf) * 2 * Math.PI, sph: rnd() * 6.28,
      rot: rnd() * 360, vr: (rnd() < 0.5 ? -1 : 1) * range(L.vr || 0), fx: range(L.ff || 0) * 2 * Math.PI, fy: range(L.ff || 0) * 2 * Math.PI * 0.7, fph: rnd() * 6.28, o: L.op(), fade: fadeS,
    });
  }
  function buildGust() {
    rs = 20261203;
    parts = [];
    LAYERS.forEach((L) => {
      let n = L.n;
      if (LOW_END) n = L.name === "near" ? 4 : Math.round(n / 2);
      const nIn = Math.round(n * SHARE[L.name]), nEdge = n - nIn;
      const nu = Math.max(1, Math.round(Math.sqrt(nEdge * 1.6))), nt = Math.ceil(nEdge / nu), cells: number[][] = [];
      for (let i = 0; i < nu; i++) for (let j = 0; j < nt; j++) cells.push([i, j]);
      for (let k = cells.length - 1; k > 0; k--) { const m = Math.floor(rnd() * (k + 1)); [cells[k], cells[m]] = [cells[m], cells[k]]; }
      cells.slice(0, nEdge).forEach(([i, j]) => {
        const u = (i + rnd()) / nu;
        if (rnd() > density(u)) return;
        add(L, entry(u), invEnv((j + rnd()) / nt, L.emitEnd), 0.4);
      });
      const gx = 6, gy = 12;
      let made = 0, guard = 0;
      while (made < nIn && guard++ < 5000) {
        const i = Math.floor(rnd() * gx), j = Math.floor(rnd() * gy);
        const x = ((i + rnd()) / gx) * 390, y = ((j + rnd()) / gy) * 844;
        const proj = (x * Math.cos(THETA) + y * Math.sin(THETA)) / (390 * Math.cos(THETA) + 844 * Math.sin(THETA));
        if (rnd() > (0.3 + 0.7 * proj) * (0.05 + 0.95 * Math.pow(y / 844, 1.5))) continue;
        add(L, [x, bandY(y)], invEnv(rnd() * 0.75, 2400), 0.7);
        made++;
      }
    });
  }

  /* ----- 零星飘落（§1d） ----- */
  const DRIFT = { min: 3, max: 8, retarget: [4000, 7000], gap: 700, vy: [24, 40], vx: [4, 12], sw: [10, 22], sf: [0.15, 0.32], vr: [10, 45], ff: [0.2, 0.5], fadeIn: 600, fadeOutY: [720, 820] };
  const ZONES = { pass: [[60, 392, 330, 440], [96, 372, 294, 492]], title: [[114, 304, 354, 454]] };
  type Drifter = Flake & { s: number; near: boolean; depth: number; x: number; y: number; t0: number; o: number; vy: number; vx: number; sw: number; sf: number; sph: number };
  let zoneMode: "pass" | "title" = "pass", drifters: Drifter[] = [], driftOn = true, driftTarget = 5, nextRetarget = 0, lastSpawn = -1e9, lastDT: number | null = null;
  const keepW = TREE_GROUPS.map((n) => TL.groups[n].counts.wind), keepT = keepW.reduce((a, b) => a + b);
  const fullW = TREE_GROUPS.map((n) => TL.groups[n].counts.full), fullT = fullW.reduce((a, b) => a + b);
  let treeSet: "full" | "wind" = "full";
  function spawnDrifter(t: number, prefill: boolean) {
    const r = rnd();
    let kind: string, size: number, blur = 0, o = 0.9, depth = 1;
    if (r < 0.5) { kind = "petal"; size = 6 + rnd() * 3; }
    else if (r < 0.9) { kind = "sk"; size = 6 + rnd() * 4; o = 0.95; }
    else { kind = "sk"; size = 4 + rnd(); blur = 0.8; o = 0.7; depth = 0.7; }
    const near = !prefill && rnd() < 0.12 && !drifters.some((d) => d.near);
    if (near) { kind = "sk"; size = 22 + rnd() * 6; blur = 1.6; o = 0.85; depth = 1.4; }
    let x: number, y: number;
    if (near) { x = rnd() * 360; y = -30; }
    else {
      const set = treeSet === "full";
      const gname = pickGroup(set ? fullW : keepW, set ? fullT : keepT), gd = TL.groups[gname];
      const pool = set ? gd.drop.concat(gd.keep) : gd.keep, f = pool[Math.floor(rnd() * pool.length)];
      [x, y] = rotPt(groups[gname], f[0], f[1]);
    }
    if (prefill) { y = below(60 + rnd() * 640, zoneMode === "pass" ? 492 : 437); x = rnd() * 390; }
    const d: Drifter = {
      kind, s: size, sp: sprite(size, blur, kind), near, depth, x, y, t0: t, o, vy: range(DRIFT.vy) * depth, vx: range(DRIFT.vx), sw: range(DRIFT.sw), sf: range(DRIFT.sf) * 2 * Math.PI, sph: rnd() * 6.28,
      rot: rnd() * 360, vr: (rnd() < 0.5 ? -1 : 1) * range(DRIFT.vr), fx: range(DRIFT.ff) * 2 * Math.PI, fy: range(DRIFT.ff) * 2 * Math.PI * 0.8, fph: rnd() * 6.28,
    };
    if (prefill) d.t0 = t - DRIFT.fadeIn;
    drifters.push(d);
    lastSpawn = t;
  }
  function zoneFade(x: number, y: number) {
    let f = 1;
    for (const [x0, y0, x1, y1] of ZONES[zoneMode]) {
      const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 + L.o - y, 0, y - y1 - L.o);
      f = Math.min(f, 0.3 + 0.7 * smooth(Math.hypot(dx, dy) / 24));
    }
    return f;
  }
  function stepDrift(t: number) {
    const dt = lastDT === null ? 0 : Math.min(0.05, (t - lastDT) / 1000);
    lastDT = t;
    const e = gustE(t), w = e >= 0 ? WIND(e) : 0;
    if (driftOn) {
      if (t >= nextRetarget) { driftTarget = DRIFT.min + Math.floor(rnd() * (DRIFT.max - DRIFT.min + 1)); nextRetarget = t + range(DRIFT.retarget); }
      const vis = drifters.filter((d) => d.y > -10 && d.y < CH).length;
      if (vis < driftTarget && t - lastSpawn >= DRIFT.gap) spawnDrifter(t, false);
    }
    drifters = drifters.filter((d) => {
      const a = (t - d.t0) / 1000;
      d.x += (d.vx + w * 170 * Math.cos(THETA)) * dt;
      d.y += (d.vy + w * 170 * Math.sin(THETA)) * dt;
      const x = d.x + d.sw * Math.sin(d.sf * a + d.sph), y = d.y;
      if (y > CH + 16 || x > CW - OX + 50) return false;
      const top = zoneMode === "pass" ? 492 : 437, f0 = below(DRIFT.fadeOutY[0], top), f1 = below(DRIFT.fadeOutY[1], top);
      let o = d.o * Math.min(1, (a * 1000) / DRIFT.fadeIn) * (1 - smooth((y - f0) / (f1 - f0)));
      if (!d.near) o *= zoneFade(x, y);
      if (o > 0.01) drawSprite(d, x, y, o, a);
      return true;
    });
  }
  let lastGT: number | null = null, stopEmit = false;
  function drawGustParts(t: number) {
    if (gustT0 === null) return;
    const e = t - gustT0, dt = Math.min(0.05, (t - (lastGT ?? t)) / 1000);
    lastGT = t;
    if (e > G.tailEnd) return;
    const w = WIND(e), tail = e < G.fadeFrom ? 1 : 1 - smooth((e - G.fadeFrom) / (G.tailEnd - G.fadeFrom));
    for (const p of parts) {
      if (e < p.tb || p.dead) continue;
      const a = (e - p.tb) / 1000, sp = p.v * (0.55 + 0.45 * w);
      p.x += p.dx * sp * dt;
      p.y += (p.dy * sp + p.L.fall) * dt;
      const sway = p.sw * Math.sin(p.sf * a + p.sph) * Math.min(1, a / 0.6), x = p.x - p.dy * sway, y = p.y + p.dx * sway;
      if (x < -OX - 50 || x > CW - OX + 50 || y < -50 || y > CH + 50) continue;
      const o = p.o * Math.min(1, a / p.fade) * tail;
      if (o <= 0.01) continue;
      drawSprite(p, x, y, o, a);
    }
    stepDetach(e);
    drawTreeParts(e, dt, w, tail);
  }
  /* 判定降档时立刻改出花速率（§10.9「切档时机」）：档 1 还没出生的背景花减半、近层 7→4；档 0 立刻停发，已在飞的不收回 */
  let quota: 0 | 1 | 2 = LOW_END ? 1 : 2;
  function reduceEmit(t: 0 | 1 | 2) {
    const e = gustT0 === null ? 0 : now() - gustT0;
    if (t <= 1 && quota === 2) {
      let i = 0, near = 0;
      for (const p of parts) {
        if (p.tb <= e || p.dead) continue;
        if (p.L.name === "near") { if (near++ % 2 === 1) p.dead = true; }
        else if (i++ % 2 === 0) p.dead = true;
      }
      DET.cap = 170;
      quota = 1;
    }
    if (t === 0 && quota > 0) {
      for (const p of parts) if (p.tb > e) p.dead = true;
      stopEmit = true;
      driftOn = false;
      quota = 0;
    }
  }
  onJudge(reduceEmit);
  function drawAll(t: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawGustParts(t);
    stepDrift(t);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
  }

  function gust() {
    buildGust();
    rs = 20261209;
    gustT0 = now();
    lastGT = gustT0;
    const fd = groups.fardots, fdFull = fd.imgs["flowers-full"], fdWind = fd.imgs["flowers-wind"];
    fdWind.style.opacity = "0";
    after(900, () =>
      onWindReady(fdWind, (ok) => {
        if (RM || !ok) return;
        tween({ dur: 300, ease: E.out, on: (k) => op(fdWind, k) });
        tween({ dur: 1600, delay: 300, ease: smooth, on: (k) => op(fdFull, 1 - k), done: () => (fdFull.style.display = "none") });
      }),
    );
    driftOn = false;
    after(3800, () => { treeSet = "wind"; if (!stopEmit) driftOn = true; nextRetarget = 0; });
    tween({ dur: 800, ease: E.out, on: (k) => (calmOn = 1 - k), done: () => { rippleMode = "title"; placeCalm(); } }); // 淡出期间换到进门后的位置
    tween({ dur: 1000, delay: 4400, ease: E.out, on: (k) => (calmOn = k) });
  }

  /* ---------- 启停：第 1 屏可见时跑，滚走 / 页面隐藏时停（§1a、§10.4） ---------- */
  let stops: (() => void)[] = [];
  let active = false;
  function setActive(on: boolean) {
    if (RM || on === active) return;
    active = on;
    Object.values(groups).forEach((g) => (g.d.style.willChange = on ? "transform" : "auto"));
    if (on) {
      lastTreeT = null; lastDT = null;
      stops = [loop(stepTree), loop(stepRings), loop(drawAll)];
    } else {
      stops.forEach((s) => s());
      stops = [];
    }
  }

  placeCalm();
  if (!RM) {
    prepDetach();
    for (let i = 0; i < 5; i++) spawnDrifter(0, true);
    after(400, () => { if (!RM) loadWind(); });
  }
  onLayout(() => { sizeCanvas(); placeCalm(); });

  /* 生效档变化（静止点落地）：档 1 只摆 4 组、关平静微摆；档 0 树、落花、水波纹全部静止，等于效果图 01 */
  onTier((t) => {
    if (t <= 1 && !LOW_END) {
      LOW_END = true;
      Object.keys(GPS).forEach((n) => { if (!swingGroups().includes(n)) { groups[n].d.style.transform = "none"; groups[n].d.style.willChange = "auto"; } });
    }
    if (t === 0 && !RM) toStatic();
  });
  function toStatic() {
    const wasActive = active;
    setActive(false);
    RM = true;
    active = wasActive;
    Object.values(groups).forEach((g) => { g.d.style.transform = "none"; g.d.style.willChange = "auto"; });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = []; treeParts = []; drifters = [];
    for (const n in detach) { detach[n].c.remove(); }
    rings.forEach((r) => { r.e.style.transform = "none"; op(r.e, r.o); });
    op(cflower, 1);
  }

  /* ---------- 密码门（§2） ---------- */
  const X0 = 115, W = 28, GAP = 16;
  const slots = [0, 1, 2, 3].map((i) => {
    const s = document.createElement("div");
    s.className = "slot";
    s.style.left = X0 + i * (W + GAP) + "px";
    s.innerHTML = '<span class="digit"></span><i></i>';
    el.row.appendChild(s);
    return { s, d: s.firstChild as HTMLElement, u: s.lastChild as HTMLElement };
  });
  let code = "", locked = false, unlocked = false;
  function lineState() {
    slots.forEach((x, i) => {
      const target = i === code.length ? 0.7 : 0.4, from = +x.u.style.opacity || 0.4;
      if (Math.abs(from - target) > 0.01) tween({ dur: T.xs, ease: E.out, on: (k) => op(x.u, lerp(from, target, k)) });
    });
  }
  function typeDigit(ch: string) {
    if (locked || code.length >= 4) return;
    if (!RM) loadWind();
    const i = code.length;
    code += ch;
    const d = slots[i].d;
    d.textContent = ch;
    if (RM) op(d, 1);
    else tween({ dur: T.s, ease: E.soft, on: (k) => { op(d, k); d.style.transform = `translateY(${lerp(6, 0, k).toFixed(2)}px)`; } });
    lineState();
    if (code.length === 4) {
      locked = true;
      const c = code;
      after(160, () => (c === PASSCODE ? success() : fail(c)));
    }
  }
  const BURST = [[94, 432, 8, 18, 0.85], [108, 474, 6, 40, 0.7], [82, 404, 5, 8, 0.6], [296, 408, 7, 30, 0.8], [304, 448, 9, 12, 0.85], [276, 486, 5, 50, 0.6]];
  function fail(c: string) {
    const again = el.again;
    again.textContent = c === DAY100_CODE ? "这是第 100 天，往前想" : "再想想";
    if (RM) {
      // reduced-motion：不晃，底线和数字一起闪一次不透明度 1→.4→1（300ms）
      tween({ dur: 300, ease: E.linear, on: (_k, p) => op(el.row, 1 - 0.6 * Math.sin(Math.PI * p)) });
    } else {
      const KF = [0, -6, 6, -4, 4, -2, 0];
      tween({
        dur: 420, ease: E.linear,
        on: (_k, p) => {
          const f = p * (KF.length - 1), i = Math.min(KF.length - 2, Math.floor(f));
          el.row.style.transform = `translateX(${lerp(KF[i], KF[i + 1], E.inout(f - i)).toFixed(2)}px)`;
        },
      });
      BURST.forEach(([x, y, s, r, o], i) => {
        const d = document.createElement("div");
        d.className = "cp";
        // M4：0.5px 模糊预先烘焙进贴图（plan §10.2），运动中的元素不挂 CSS filter
        const sp = sprite(s, 0.5, "sk"), c = document.createElement("canvas");
        c.width = sp.c.width; c.height = sp.c.height;
        c.style.cssText = `display:block;width:${sp.S}px;height:${sp.S}px;margin:${(s - sp.S) / 2}px`;
        c.getContext("2d")!.drawImage(sp.c, 0, 0);
        d.appendChild(c);
        op(d, 0);
        el.burst.appendChild(d);
        const cx = 195, cy = 434, L = Math.hypot(x - cx, y - cy), ux = (x - cx) / L, uy = (y - cy) / L;
        tween({
          dur: 900, delay: i * 20, ease: E.out,
          on: (k, p) => {
            const dd = -14 * (1 - k);
            d.style.transform = `translate(${(x - s / 2 + ux * dd).toFixed(2)}px,${(y - s / 2 + uy * dd).toFixed(2)}px) rotate(${(r + 30 * k).toFixed(1)}deg)`;
            op(d, o * (p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75));
          },
          done: () => d.remove(),
        });
      });
    }
    tween({
      dur: T.s, delay: 80, ease: E.out,
      on: (k) => { op(again, 0.999 * k); again.style.transform = `rotate(-14deg) translateY(${(RM ? 0 : lerp(4, 0, k)).toFixed(2)}px)`; },
    });
    after(1000, () => {
      slots.forEach((x, i) => tween({ dur: 200, delay: (3 - i) * 30, ease: E.in, on: (k) => op(x.d, 1 - k) }));
      tween({ dur: 300, ease: E.in, on: (k) => op(again, 1 - k) });
      after(300, () => {
        code = "";
        locked = false;
        slots.forEach((x) => (x.d.textContent = ""));
        lineState();
        el.input.value = "";
      });
    });
  }
  function titleIn() {
    el.titleLines.forEach((l, i) =>
      tween({ dur: T.xl, delay: i * T.staggerL, ease: E.soft, on: (k) => { op(l, k); l.style.transform = k >= 1 ? "none" : `translateX(${lerp(-14, 0, k).toFixed(2)}px)`; } }),
    );
  }
  function hintIn(delay: number) {
    tween({ dur: T.l, delay, ease: E.out, on: (k) => op(el.hintTxt, k) });
    tween({ dur: 500, delay: delay + 100, ease: E.out, on: (k) => { op(el.hintLine, k); el.hintLine.style.transform = `scaleY(${k.toFixed(3)})`; } });
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    el.input.disabled = true;
    cb.onUnlock();
  }
  function success() {
    after(160, () => el.input.blur());
    commitTier(); // 输对的那一刻是静止点：之前判定出的档在这里落地
    if (!RM && env.rm) toStatic();
    if (RM) {
      // reduced-motion：整组交叉淡入淡出 300ms，不播风，600ms 放开下滑
      tween({ dur: 300, ease: E.linear, on: (k) => { op(el.row, 1 - k); el.passLines.forEach((l) => op(l, 1 - k)); el.titleLines.forEach((l) => op(l, k)); op(el.hintTxt, k); op(el.hintLine, k); } });
      zoneMode = "title";
      // 水波纹换到进门后的位置（矮屏才会动）：随这 300ms 交叉淡化，先淡出 150 再淡入 150
      tween({ dur: 150, ease: E.linear, on: (k) => { rings.forEach((r) => op(r.e, r.o * (1 - k))); op(cflower, 1 - k); }, done: () => {
        rippleMode = "title"; placeCalm();
        tween({ dur: 150, ease: E.linear, on: (k) => { rings.forEach((r) => op(r.e, r.o * k)); op(cflower, k); } });
      } });
      after(600, unlock);
      return;
    }
    loadWind();
    slots.forEach((x) => tween({ dur: T.xs, ease: E.out, on: (k) => op(x.u, lerp(0.4, 0.7, k)) }));
    slots.forEach((x, i) => tween({ dur: 360, delay: 180 + i * 40, ease: E.in, on: (k) => { op(x.s, 1 - k); x.s.style.transform = `translateY(${(-6 * k).toFixed(2)}px)`; } }));
    el.passLines.forEach((l, i) => tween({ dur: 360, delay: 180 + i * 60, ease: E.in, on: (k) => { op(l, 1 - k); l.style.transform = `translateX(${(10 * k).toFixed(2)}px)`; } }));
    after(560, () => { titleIn(); zoneMode = "title"; });
    after(720, () => { if (!RM) gust(); });
    hintIn(1050);
    after(1200, unlock);
  }
  el.input.addEventListener("input", () => {
    const v = el.input.value.replace(/\D/g, "").slice(0, 4);
    if (v !== el.input.value) el.input.value = v;
    if (!locked && v.length < code.length) {
      // 退格：删掉的位直接清空（定稿没写，这里不加动效）
      for (let i = v.length; i < code.length; i++) { slots[i].d.textContent = ""; op(slots[i].d, 0); }
      code = v;
      lineState();
    }
    while (code.length < v.length && !locked) typeDigit(v[code.length]);
  });
  lineState();

  return { setActive, typeDigit, get unlocked() { return unlocked; } };
}
