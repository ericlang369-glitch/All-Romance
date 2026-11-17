/* 第 2 屏 · 蝴蝶飞入（plan §4）。路径、振翅、朝向逐帧算法移植自 motion/prototypes/screens-kit.js build02，
   按 §4e 预先以 60 帧采样成关键帧，交给 Motion（WAAPI，合成线程）播放；拖尾光点 ≤16 个 DOM 小圆点。 */
import { animate } from "motion";
import { E, T, clamp, env, isVirtual, lerp, loadImgs, loop, now, op, tween } from "./kit";

const LAYER = { left: 102, top: 242.5 }, HEAD = [138.3, 118.7], TAIL = [180.3, 183.1];
const MID = [(HEAD[0] + TAIL[0]) / 2, (HEAD[1] + TAIL[1]) / 2];
const AX = (Math.atan2(TAIL[0] - HEAD[0], TAIL[1] - HEAD[1]) * 180) / Math.PI;
const S = [430, 960], C = [387, 586], END = [LAYER.left + MID[0], LAYER.top + MID[1]], HD = [HEAD[0] - TAIL[0], HEAD[1] - TAIL[1]];
const P = { fly: T.fly, settle: T.settle, hzFly: 5.2, hzSettle: 1.5, foldMax: 0.66, rotMax: 10, bob: 2, trailEvery: 60, trailMax: 16 };
const FPS = 60;

const bz = (p: number, a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
const bzd = (p: number, a: number, b: number, c: number) => 2 * (1 - p) * (b - a) + 2 * p * (c - b);
const angTo = (v: number[]) => (Math.atan2(HD[0] * v[1] - HD[1] * v[0], HD[0] * v[0] + HD[1] * v[1]) * 180) / Math.PI;
const flapT = (s: number) => `rotate(${-AX}deg) scaleX(${s.toFixed(4)}) rotate(${AX}deg)`;
function l2s(pt: number[], dx: number, dy: number, r: number) {
  const a = (r * Math.PI) / 180, x = pt[0] - MID[0], y = pt[1] - MID[1];
  return [LAYER.left + MID[0] + dx + x * Math.cos(a) - y * Math.sin(a), LAYER.top + MID[1] + dy + x * Math.sin(a) + y * Math.cos(a)];
}

/** 逐帧采样（和原型同一套公式，固定 1/60s 步长，所以每次都一样） */
function sample() {
  const total = P.fly + P.settle, n = Math.round((total / 1000) * FPS);
  const bf: string[] = [], wing: string[] = [], opa: number[] = [], pos: number[][] = [];
  let phase = 0;
  for (let i = 0; i <= n; i++) {
    const e = (i / n) * total, dt = i ? total / n / 1000 : 0;
    let dx = 0, dy = 0, rot = 0, amp: number, hz: number, o = 1;
    if (e < P.fly) {
      const lin = e / P.fly, p = E.glide(lin);
      dx = bz(p, S[0], C[0], END[0]) - END[0];
      dy = bz(p, S[1], C[1], END[1]) - END[1];
      rot = clamp(angTo([bzd(p, S[0], C[0], END[0]), bzd(p, S[1], C[1], END[1])]), -P.rotMax, P.rotMax);
      amp = lin < 0.7 ? 1 : 1 - 0.55 * ((lin - 0.7) / 0.3);
      hz = lerp(P.hzFly, P.hzSettle + 1, Math.max(0, (lin - 0.6) / 0.4));
      o = Math.min(1, e / 120);
    } else {
      const k = Math.min(1, (e - P.fly) / P.settle);
      amp = 0.45 * (1 - E.out(k));
      hz = P.hzSettle;
    }
    phase += 2 * Math.PI * hz * dt;
    const wave = Math.pow(0.5 - 0.5 * Math.cos(phase), 0.85);
    let s = 1 - P.foldMax * amp * wave;
    const bob = -P.bob * amp * (1 - wave);
    if (i === n) { s = 1; dx = dy = rot = 0; }
    wing.push(flapT(s));
    bf.push(`translate(${dx.toFixed(2)}px,${(dy + (i === n ? 0 : bob)).toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`);
    opa.push(o);
    pos.push([dx, dy, rot]);
  }
  return { bf, wing, opa, pos, total };
}

export function createButterfly(bfEl: HTMLElement, wings: HTMLElement[], trail: HTMLElement) {
  let rs = 20261115;
  const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0), rs / 4294967296);
  // §10.5：起飞前先解码；图片按屏加载（G6），所以到用时才取
  const ready = () => loadImgs(bfEl);

  function fly() {
    if (env.rm) {
      // reduced-motion：直接在终点、原角度淡入 400ms，不振翅，没有光点
      tween({ dur: T.m, ease: E.out, on: (k) => op(bfEl, k) });
      return;
    }
    const K = sample();
    const t0 = now();
    bfEl.style.willChange = "transform,opacity";
    wings.forEach((w) => (w.style.willChange = "transform"));
    const opts = { duration: K.total / 1000, ease: "linear" as const };
    const anims = [animate(bfEl, { transform: K.bf, opacity: K.opa }, opts), ...wings.map((w) => animate(w, { transform: K.wing }, opts))];
    if (isVirtual()) anims.forEach((a) => a.pause()); // 录屏：跟着虚拟时钟逐帧拨
    // M3：落定后取消 Motion 的动画（不让它把最后一帧写回内联样式），所有 transform 设成 none（plan §4b）
    const finish = () => {
      anims.forEach((a) => a.cancel());
      bfEl.style.transform = "none";
      bfEl.style.opacity = "1";
      wings.forEach((w) => { w.style.transform = "none"; w.style.willChange = "auto"; });
      bfEl.style.willChange = "auto";
    };
    // 拖尾光点（§4d）：从腹末发出，每 60ms 一个，只在飞行前 92% 发，同屏 ≤16（低端机关掉）
    type Dot = { d: HTMLDivElement; x: number; y: number; vx: number; vy: number; o0: number; life: number; t0: number };
    let alive: Dot[] = [], lastEmit = -1e9, done = false;
    const stop = loop((t) => {
      const e = t - t0;
      if (isVirtual()) anims.forEach((a) => (a.time = Math.min(K.total, Math.max(0, e)) / 1000));
      if (!done && e >= K.total) { done = true; finish(); }
      if (!env.low && e < P.fly * 0.92 && t - lastEmit >= P.trailEvery && alive.length < P.trailMax) {
        lastEmit = t;
        const [dx, dy, rot] = K.pos[Math.min(K.pos.length - 1, Math.round((e / 1000) * FPS))];
        const [x, y] = l2s(TAIL, dx, dy, rot);
        const d = document.createElement("div");
        d.className = "pt";
        const r = 0.8 + rnd() * 1.2, mist = rnd() < 0.45;
        d.style.cssText += `width:${2 * r}px;height:${2 * r}px;background:${mist ? "#CFD8FF" : "#fff"};margin:${-r}px 0 0 ${-r}px;opacity:0`;
        trail.appendChild(d);
        alive.push({ d, x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8, vx: (rnd() - 0.5) * 10, vy: 6 + rnd() * 8, o0: 0.6 + rnd() * 0.4, life: 900 + rnd() * 500, t0: t });
      }
      alive = alive.filter((o) => {
        const k = (t - o.t0) / o.life;
        if (k >= 1) { o.d.remove(); return false; }
        o.d.style.transform = `translate(${(o.x + o.vx * k).toFixed(2)}px,${(o.y + o.vy * k).toFixed(2)}px) scale(${(1 - 0.4 * k).toFixed(3)})`;
        op(o.d, o.o0 * (1 - k));
        return true;
      });
      if (done && !alive.length) stop();
    });
  }
  return { ready, fly };
}
