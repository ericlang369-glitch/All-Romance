"use client";
import { cubicBezier } from "motion";
import { useEffect, useRef, useState } from "react";
import { ASSET_BASE, START_ISO, TEXT } from "@/config";
import { E, clamp, env, isVirtual, loadImgs, loop, now, onTier, smooth, tween } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const A = `${ASSET_BASE}/assets/`;
const START = Date.parse(START_ISO);

/** Bouquet soak curve (0 -> 1.35s) and continuous dawn wash curve (0.72s -> 2.82s), both with immediate initial velocity */
const SOAK_EASE = cubicBezier(0.22, 0.55, 0.32, 1);
const DAWN_WASH_EASE = cubicBezier(0.24, 0.48, 0.32, 1);

const BREEZE_STYLE_TEXT = `
@keyframes endingBqBreeze {
  0%, 100% { transform: translate3d(0, -2px, 0) rotate(-0.8deg); }
  50% { transform: translate3d(0, 2px, 0) rotate(0.8deg); }
}
.ending-bq-breeze {
  animation: endingBqBreeze 5.4s ease-in-out infinite;
}
html[data-rm] .ending-bq-breeze {
  animation: none !important;
}
`;

const SKY_NIGHT_STYLE = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(ellipse 68% 52% at 50% 32%, rgba(56, 86, 232, 0.34) 0%, rgba(20, 48, 196, 0) 72%), radial-gradient(ellipse 84% 72% at 50% 50%, rgba(11,30,140,0) 44%, rgba(11,30,140,0.3) 100%), #1430C4",
} as const;

const BG_PRELUDE_STYLE = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(ellipse 78% 50% at 48% 27%, rgba(236,136,178,0.40) 0%, rgba(144,114,240,0.22) 45%, rgba(20,48,196,0) 80%), radial-gradient(ellipse 58% 40% at 53% 25%, rgba(255,224,196,0.30) 0%, rgba(255,182,206,0.12) 56%, transparent 100%)",
  opacity: 0,
} as const;

const BG_DAWN_STYLE = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(ellipse 68% 44% at 49% 25%, rgba(255,208,218,0.42) 0%, rgba(246,222,180,0.22) 54%, transparent 100%), radial-gradient(ellipse 92% 72% at 50% 34%, #FFFDF9 0%, #F7EFE2 58%, #EBE0CD 100%)",
  opacity: 0,
} as const;

const NIGHT_BASE_STYLE = {
  position: "absolute",
  inset: 0,
  color: "#FFFFFF",
  zIndex: 2,
} as const;

const NIGHT_GLOW_STYLE = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(ellipse 56% 36% at 50% 26%, rgba(220,232,255,0.09) 0%, rgba(220,232,255,0.03) 52%, transparent 100%)",
  pointerEvents: "none",
  opacity: 1,
} as const;

const WHISPER_BADGE_STYLE = {
  left: 242,
  top: 282,
  transform: "rotate(-4deg)",
  pointerEvents: "none",
  zIndex: 11,
} as const;

const NIGHT_GROUP_STYLE = {
  left: 22,
  top: 378,
  transform: "rotate(-8deg)",
  color: "#FFFFFF",
} as const;

const NIGHT_DATE_STYLE = {
  position: "absolute",
  left: 218,
  top: 666,
  color: "rgba(255,255,255,0.84)",
  transform: "rotate(-14deg)",
  transformOrigin: "0 0",
  whiteSpace: "nowrap",
  fontFamily: "var(--sans)",
  fontWeight: 500,
  fontSize: 13,
  lineHeight: "20px",
  letterSpacing: "0.1em",
  pointerEvents: "none",
} as const;

const DAWN_LAYER_STYLE = {
  position: "absolute",
  inset: 0,
  background: "transparent",
  color: "#10259E",
  opacity: 0,
  pointerEvents: "none",
  zIndex: 8,
} as const;

const DAWN_MSG_STYLE = {
  position: "absolute",
  left: 0,
  width: 390,
  top: 320,
  textAlign: "center",
  whiteSpace: "nowrap",
  transform: "translateY(8px) rotate(-8deg)",
  fontFamily: "var(--zhimang)",
  fontSize: 22.5,
  letterSpacing: "0.12em",
  color: "#B84A62",
  opacity: 0,
} as const;

const DAWN_COUNT_STYLE = {
  left: 22,
  top: 378,
  transform: "translateY(8px) rotate(-8deg)",
  color: "#10259E",
  opacity: 0,
} as const;

const DAWN_UPPER_STYLE = {
  left: 20,
  top: 432,
  transform: "translateY(8px) rotate(-8deg)",
  color: "#10259E",
  opacity: 0,
} as const;

const DAWN_LOWER_STYLE = {
  left: 26,
  top: 522,
  transform: "translateY(8px) rotate(4.5deg)",
  color: "#10259E",
  opacity: 0,
} as const;

const DAWN_DATE_STYLE = {
  position: "absolute",
  left: 218,
  top: 666,
  color: "rgba(16,37,158,0.62)",
  transform: "translateY(8px) rotate(-14deg)",
  transformOrigin: "0 0",
  whiteSpace: "nowrap",
  fontFamily: "var(--sans)",
  fontWeight: 500,
  fontSize: 13,
  lineHeight: "20px",
  letterSpacing: "0.1em",
  pointerEvents: "none",
  opacity: 0,
} as const;

const BOUQUET_OUTER_STYLE = {
  position: "absolute",
  left: 78,
  top: 16,
  width: 234,
  height: 298,
  transformOrigin: "50% 88%",
  pointerEvents: "none",
  zIndex: 10,
} as const;

const BOUQUET_SPRING_STYLE = {
  position: "absolute",
  inset: 0,
  transformOrigin: "50% 88%",
  pointerEvents: "none",
} as const;

const BOUQUET_IMG_BASE = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 234,
  height: 298,
  objectFit: "contain",
  pointerEvents: "none",
} as const;

const BOUQUET_LINES_STYLE = { ...BOUQUET_IMG_BASE, opacity: 1 } as const;
const BOUQUET_COLOR_A_STYLE = { ...BOUQUET_IMG_BASE, opacity: 0 } as const;
const BOUQUET_COLOR_B_STYLE = { ...BOUQUET_IMG_BASE, opacity: 0 } as const;

const PETAL_CANVAS_STYLE = {
  position: "absolute",
  inset: 0,
  width: 390,
  height: 708,
  pointerEvents: "none",
  zIndex: 12,
} as const;

const HITBOX_BTN_STYLE = {
  position: "absolute",
  left: 60,
  top: 12,
  width: 290,
  height: 312,
  background: "transparent",
  border: 0,
  cursor: "pointer",
  zIndex: 14,
  WebkitTapHighlightColor: "transparent",
} as const;

/* ---------- Offscreen Watercolor Petal & Blossom Sprites ---------- */
const SK_PATH =
  "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";
const SINGLE_PETAL = "M0,-5.5 C2.8,-3.5 3.6,1.5 0,5.5 C-3.6,1.5 -2.8,-3.5 0,-5.5 Z";

type PaletteEntry = {
  base: string;
  core: string;
  tint: string;
  rim: string;
};

const BOTANICAL_PALETTE: readonly PaletteEntry[] = [
  { base: "#F29BB2", core: "rgba(208,100,130,0.92)", tint: "rgba(255,224,234,0.68)", rim: "rgba(196,88,118,0.28)" },
  { base: "#76ADE0", core: "rgba(74,132,190,0.90)", tint: "rgba(206,232,255,0.68)", rim: "rgba(64,118,176,0.26)" },
  { base: "#DFB468", core: "rgba(192,140,58,0.90)", tint: "rgba(252,234,190,0.68)", rim: "rgba(176,124,46,0.26)" },
  { base: "#B796D9", core: "rgba(140,102,184,0.90)", tint: "rgba(232,216,250,0.68)", rim: "rgba(126,88,170,0.26)" },
  { base: "#FFD6E4", core: "rgba(228,136,166,0.90)", tint: "rgba(255,238,244,0.72)", rim: "rgba(210,116,148,0.28)" },
] as const;

type PetalKind = "sakura" | "petal";
const spriteCache = new Map<string, HTMLCanvasElement>();

function getWatercolorSprite(hueIdx: number, kind: PetalKind): HTMLCanvasElement {
  const key = `${hueIdx}:${kind}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;

  const pal = BOTANICAL_PALETTE[hueIdx % BOTANICAL_PALETTE.length];
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const cx = c.getContext("2d")!;
  cx.translate(S / 2, S / 2);

  if (kind === "sakura") {
    cx.scale(2.85, 2.85);
    const p = new Path2D(SK_PATH);
    const g = cx.createRadialGradient(0, 0, 0.8, 0, 0, 9.8);
    g.addColorStop(0, pal.core);
    g.addColorStop(0.46, pal.base);
    g.addColorStop(0.84, pal.tint);
    g.addColorStop(1, pal.base);

    for (let i = 0; i < 5; i++) {
      cx.fillStyle = g;
      cx.fill(p);
      cx.strokeStyle = pal.rim;
      cx.lineWidth = 0.34;
      cx.stroke(p);
      cx.rotate((Math.PI * 2) / 5);
    }

    cx.fillStyle = "rgba(255, 246, 218, 0.94)";
    cx.beginPath();
    cx.arc(0, 0, 1.38, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = pal.core;
    for (let i = 0; i < 5; i++) {
      const a = ((i * 72 + 36) * Math.PI) / 180;
      cx.beginPath();
      cx.arc(Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0.42, 0, Math.PI * 2);
      cx.fill();
    }
  } else {
    cx.scale(4.4, 4.4);
    const p = new Path2D(SINGLE_PETAL);
    const g = cx.createLinearGradient(0, 5.4, 0, -5.5);
    g.addColorStop(0, pal.core);
    g.addColorStop(0.48, pal.base);
    g.addColorStop(0.88, pal.tint);
    g.addColorStop(1, pal.base);

    cx.fillStyle = g;
    cx.fill(p);
    cx.strokeStyle = pal.rim;
    cx.lineWidth = 0.28;
    cx.stroke(p);

    cx.strokeStyle = pal.rim;
    cx.lineWidth = 0.22;
    cx.beginPath();
    cx.moveTo(0, 4.1);
    cx.lineTo(0, -2.0);
    cx.stroke();
  }

  spriteCache.set(key, c);
  return c;
}

/* ---------- Organic Multi-Cloud Watercolor & Atmospheric Masks ---------- */
const BOUQUET_LOBES = [
  { cx: 48, cy: 68, rx0: 14, ry0: 16, rxSpan: 210, rySpan: 240, delay: 0.0, dur: 0.78 },
  { cx: 64, cy: 40, rx0: 12, ry0: 15, rxSpan: 205, rySpan: 235, delay: 0.10, dur: 0.78 },
  { cx: 34, cy: 42, rx0: 12, ry0: 15, rxSpan: 205, rySpan: 235, delay: 0.18, dur: 0.76 },
  { cx: 50, cy: 20, rx0: 12, ry0: 14, rxSpan: 200, rySpan: 230, delay: 0.26, dur: 0.74 },
] as const;

function buildBouquetCloudMask(p: number): string {
  if (p >= 1) return "none";
  if (p <= 0.001) return "radial-gradient(ellipse 1px 1px at 48% 68%, transparent 0%, transparent 100%)";

  const parts: string[] = [];
  for (const l of BOUQUET_LOBES) {
    const u = clamp((p - l.delay) / l.dur, 0, 1);
    if (u <= 0.001) continue;
    const rx = l.rx0 + l.rxSpan * u;
    const ry = l.ry0 + l.rySpan * u;
    const core = smooth((u - 0.56) / 0.44) * 66;
    const span = 100 - core;
    const s1 = core + span * 0.36;
    const s2 = core + span * 0.68;
    parts.push(
      `radial-gradient(ellipse ${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${l.cx}% ${l.cy}%, #000 ${core.toFixed(1)}%, rgba(0,0,0,0.65) ${s1.toFixed(1)}%, rgba(0,0,0,0.18) ${s2.toFixed(1)}%, transparent 100%)`,
    );
  }
  return parts.length
    ? parts.join(", ")
    : "radial-gradient(ellipse 1px 1px at 48% 68%, transparent 0%, transparent 100%)";
}

const DAWN_CLOUDS = [
  { cx: 50, cy: 26, rxBase: 95, ryBase: 68, s0: 0.38, sSpan: 2.05, delay: 0.0, dur: 0.86 },
  { cx: 28, cy: 52, rxBase: 82, ryBase: 80, s0: 0.34, sSpan: 2.05, delay: 0.08, dur: 0.86 },
  { cx: 74, cy: 56, rxBase: 84, ryBase: 82, s0: 0.34, sSpan: 2.05, delay: 0.14, dur: 0.86 },
] as const;

function buildDawnMistMask(p: number): string {
  if (p >= 1) return "none";
  if (p <= 0.001) return "radial-gradient(ellipse 1% 1% at 50% 26%, transparent 0%, transparent 100%)";

  const parts: string[] = [];
  for (const c of DAWN_CLOUDS) {
    const u = clamp((p - c.delay) / c.dur, 0, 1);
    if (u <= 0.001) continue;
    const s = c.s0 + c.sSpan * u;
    const rx = c.rxBase * s;
    const ry = c.ryBase * s;
    const core = smooth((u - 0.52) / 0.48) * 46;
    const span = 100 - core;
    parts.push(
      `radial-gradient(ellipse ${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${c.cx}% ${c.cy}%, #000 ${core.toFixed(1)}%, rgba(0,0,0,0.78) ${(core + span * 0.24).toFixed(1)}%, rgba(0,0,0,0.44) ${(core + span * 0.50).toFixed(1)}%, rgba(0,0,0,0.14) ${(core + span * 0.76).toFixed(1)}%, transparent 100%)`,
    );
  }
  return parts.length
    ? parts.join(", ")
    : "radial-gradient(ellipse 1% 1% at 50% 26%, transparent 0%, transparent 100%)";
}

function setMask(el: HTMLElement | null, mask: string) {
  if (!el) return;
  el.style.webkitMaskImage = mask;
  el.style.maskImage = mask;
}

function applyTextRise(el: HTMLElement | null, startMs: number, baseRot: string, ms: number) {
  if (!el) return;
  if (ms <= startMs) {
    el.style.opacity = "0";
    el.style.transform = `translateY(8px) ${baseRot}`;
    return;
  }
  const p = clamp((ms - startMs) / 550, 0, 1);
  if (p >= 1) {
    el.style.opacity = "1";
    el.style.transform = baseRot;
    return;
  }
  const k = E.soft(p);
  el.style.opacity = k.toFixed(3);
  el.style.transform = `translateY(${((1 - k) * 8).toFixed(2)}px) ${baseRot}`;
}

export function since(ms: number) {
  const e = Math.max(0, ms - START);
  const d = Math.floor(e / 86_400_000);
  return {
    d,
    days: d,
    h: Math.floor((e % 86_400_000) / 3_600_000),
    m: Math.floor((e % 3_600_000) / 60_000),
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

function makeClock() {
  if (typeof window === "undefined") return () => Date.parse("2026-12-03T00:00:00+08:00");
  const q = new URLSearchParams(window.location.search).get("now");
  const base = q ? Date.parse(q) : NaN;
  if (Number.isNaN(base)) return () => Date.now();
  if (isVirtual()) return () => base + now();
  const off = base - Date.now();
  return () => Date.now() + off;
}

function CountdownRow({
  d,
  h,
  m,
  dayColor,
  primary,
}: {
  d: number;
  h: number;
  m: number;
  dayColor: string;
  primary: string;
}) {
  return (
    <span className="l" style={{ whiteSpace: "nowrap" }}>
      <span
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 700,
          fontSize: 22,
          lineHeight: "26px",
          letterSpacing: "0.05em",
          marginRight: 8,
          color: primary,
        }}
      >
        在一起
      </span>
      <span
        style={{
          fontFamily: "var(--geo)",
          fontWeight: 700,
          fontSize: 34,
          lineHeight: 1,
          letterSpacing: "0.02em",
          fontFeatureSettings: '"lnum" 1, "tnum" 1',
          color: dayColor,
        }}
      >
        {d}
      </span>
      <span
        style={{
          fontFamily: "var(--sans)",
          fontWeight: 500,
          fontSize: 13,
          margin: "0 6px 0 3px",
          color: primary,
        }}
      >
        天
      </span>
      <span
        style={{
          fontFamily: "var(--geo)",
          fontWeight: 650,
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: "0.02em",
          fontFeatureSettings: '"lnum" 1, "tnum" 1',
          color: primary,
        }}
      >
        {pad(h)}
      </span>
      <span
        style={{
          fontFamily: "var(--sans)",
          fontWeight: 500,
          fontSize: 13,
          margin: "0 6px 0 3px",
          color: primary,
        }}
      >
        时
      </span>
      <span
        style={{
          fontFamily: "var(--geo)",
          fontWeight: 650,
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: "0.02em",
          fontFeatureSettings: '"lnum" 1, "tnum" 1',
          color: primary,
        }}
      >
        {pad(m)}
      </span>
      <span
        style={{
          fontFamily: "var(--sans)",
          fontWeight: 500,
          fontSize: 13,
          marginLeft: 3,
          color: primary,
        }}
      >
        分
      </span>
    </span>
  );
}

type Petal = {
  bornAt: number;
  life: number;
  sprite: HTMLCanvasElement;
  size: number;
  maxOp: number;
  x0: number;
  y0: number;
  vx0: number;
  vy0: number;
  swAmp: number;
  swFreq: number;
  swPhase: number;
  rot0: number;
  vr: number;
  fx: number;
  fy: number;
  fph: number;
};

/** 07 破晓花束：指尖拨枝 · 落瓣生风 + 无痕水彩连续破晓 */
export function Ending({ register, index, total }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const deadRef = useRef(false);
  const bloomStartedRef = useRef(false);
  const stopTimelineRef = useRef<(() => void) | null>(null);
  const stopPhysicsRef = useRef<(() => void) | null>(null);
  const clockRef = useRef<() => number>(() => Date.parse("2026-12-03T00:00:00+08:00"));

  // Full-bleed background refs (portaled into #sky-7)
  const bgPreludeRef = useRef<HTMLDivElement>(null);
  const bgDawnRef = useRef<HTMLDivElement>(null);

  // Night layer refs
  const nightBaseRef = useRef<HTMLDivElement>(null);
  const nightGlowRef = useRef<HTMLDivElement>(null);
  const whisperNightRef = useRef<HTMLDivElement>(null);

  // Unified Living Bouquet Rig refs (all 3 bouquet layers pixel-locked in one stem-pivoted rig)
  const bouquetSpringRef = useRef<HTMLDivElement>(null);
  const bouquetLinesRef = useRef<HTMLImageElement>(null);
  const bouquetColorARef = useRef<HTMLImageElement>(null);
  const bouquetColorBRef = useRef<HTMLImageElement>(null);

  // Live 60fps Watercolor Petals Canvas ref
  const petalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Dawn layer & staggered typography refs
  const dawnLayerRef = useRef<HTMLDivElement>(null);
  const dawnMsgRef = useRef<HTMLParagraphElement>(null);
  const dawnCountRef = useRef<HTMLDivElement>(null);
  const dawnUpperRef = useRef<HTMLDivElement>(null);
  const dawnLowerRef = useRef<HTMLDivElement>(null);
  const dawnDateRef = useRef<HTMLParagraphElement>(null);

  // Spring & particle physics state (kept in ref, zero React re-renders per frame)
  const physRef = useRef<{
    pressing: boolean;
    angle: number;
    omega: number;
    scale: number;
    scaleVel: number;
    ty: number;
    tyVel: number;
    lastT: number | null;
    seed: number;
    retapSign: number;
    lastTapAt: number;
    petals: Petal[];
    dpr: number;
  }>({
    pressing: false,
    angle: 0,
    omega: 0,
    scale: 1,
    scaleVel: 0,
    ty: 0,
    tyVel: 0,
    lastT: null,
    seed: 20260825,
    retapSign: 1,
    lastTapAt: -1e9,
    petals: [],
    dpr: 1,
  });

  const [phase, setPhase] = useState<"init" | "blooming" | "dawn">("init");
  const [hudDark, setHudDark] = useState(false);
  const [displayDays, setDisplayDays] = useState(100);
  const [clock, setClock] = useState(() => since(Date.parse("2026-12-03T00:00:00+08:00")));

  // Deterministic PRNG for organic petal bursts
  const nextRnd = () => {
    const st = physRef.current;
    st.seed = (st.seed * 1664525 + 1013904223) >>> 0;
    return st.seed / 4294967296;
  };

  const applyBloomTimeline = (
    ms: number,
    flags: { hudFlipped: boolean; dawnPhaseSet: boolean },
  ) => {
    // 1. 0ms -> 1350ms: Bouquet Watercolor Soak (color-a over lines) + bgPrelude warmth
    const pPrelude = E.out(clamp(ms / 1150, 0, 1));
    const preludeFadeOut = ms > 2000 ? 1 - smooth(clamp((ms - 2000) / 820, 0, 1)) : 1;
    if (bgPreludeRef.current) {
      bgPreludeRef.current.style.opacity = (pPrelude * preludeFadeOut).toFixed(3);
    }
    if (nightGlowRef.current) {
      nightGlowRef.current.style.opacity = (1 - clamp(ms / 900, 0, 1)).toFixed(3);
    }

    const pSoak = SOAK_EASE(clamp(ms / 1350, 0, 1));

    // 2. 600ms -> 2820ms: Seamless Overlapping Dawn Wash (3-cloud mist, zero flat-start gap)
    // Mist mask shape is driven by pDawn; overall opacity is driven by elapsed time (600 -> 2050ms)
    // with a near-linear start so the sky never sits still and never flips in one beat.
    const pDawn = ms <= 600 ? 0 : DAWN_WASH_EASE(clamp((ms - 600) / 2220, 0, 1));
    const xDawn = clamp((ms - 600) / 1450, 0, 1);
    const opDawn = 0.5 * xDawn + 0.5 * smooth(xDawn);
    if (bgDawnRef.current) {
      if (pDawn <= 0.001) {
        bgDawnRef.current.style.opacity = "0";
        setMask(bgDawnRef.current, "none");
      } else if (pDawn >= 1) {
        bgDawnRef.current.style.opacity = "1";
        setMask(bgDawnRef.current, "none");
      } else {
        bgDawnRef.current.style.opacity = opDawn.toFixed(3);
        setMask(bgDawnRef.current, buildDawnMistMask(pDawn));
      }
    }

    // 3. 800ms -> 2050ms: Bouquet color-a -> color-b organic reveal, then clean fade-out of lines & color-a
    const pColorB = ms <= 800 ? 0 : DAWN_WASH_EASE(clamp((ms - 800) / 1250, 0, 1));
    const nightBouquetFade = ms <= 1150 ? 1 : 1 - smooth(clamp((ms - 1150) / 900, 0, 1));

    if (bouquetLinesRef.current) {
      const baseLineOp = (1 - 0.32 * pSoak) * nightBouquetFade;
      bouquetLinesRef.current.style.opacity = baseLineOp <= 0.002 ? "0" : baseLineOp.toFixed(3);
    }

    if (bouquetColorARef.current) {
      const opA = clamp(ms / 150, 0, 1) * nightBouquetFade;
      bouquetColorARef.current.style.opacity = opA <= 0.002 ? "0" : opA.toFixed(3);
      setMask(bouquetColorARef.current, opA <= 0.002 || pSoak >= 1 ? "none" : buildBouquetCloudMask(pSoak));
    }

    if (bouquetColorBRef.current) {
      if (pColorB <= 0.001) {
        bouquetColorBRef.current.style.opacity = "0";
        setMask(bouquetColorBRef.current, "none");
      } else {
        const opB = clamp(pColorB / 0.22, 0, 1);
        const maskPB = clamp(pColorB / 0.88, 0, 1);
        bouquetColorBRef.current.style.opacity = opB.toFixed(3);
        setMask(bouquetColorBRef.current, maskPB >= 1 ? "none" : buildBouquetCloudMask(maskPB));
      }
    }

    // 4. 0ms -> 520ms: Night whisper badge fade-out & 600ms -> 1700ms night copy fade-out + HUD tone flip at 1350ms
    if (whisperNightRef.current) {
      whisperNightRef.current.style.opacity = (1 - smooth(clamp(ms / 520, 0, 1))).toFixed(3);
    }

    if (nightBaseRef.current) {
      const nightOp = ms <= 600 ? 1 : 1 - E.inout(clamp((ms - 600) / 1100, 0, 1));
      nightBaseRef.current.style.opacity = nightOp <= 0.004 ? "0" : nightOp.toFixed(3);
      nightBaseRef.current.style.visibility = nightOp <= 0.004 ? "hidden" : "visible";
    }

    if (!flags.hudFlipped && ms >= 1350) {
      flags.hudFlipped = true;
      setHudDark(true);
    }

    if (!flags.dawnPhaseSet && ms >= 1450) {
      flags.dawnPhaseSet = true;
      setPhase("dawn");
    }

    // 5. 1100ms -> 2450ms: Staggered Dawn Typography (550ms E.soft, translateY(8px -> 0) + opacity)
    if (dawnLayerRef.current) {
      dawnLayerRef.current.style.opacity = ms >= 1050 ? "1" : "0";
      dawnLayerRef.current.style.pointerEvents = ms >= 2450 ? "auto" : "none";
    }
    applyTextRise(dawnMsgRef.current, 1100, "rotate(-8deg)", ms);
    applyTextRise(dawnCountRef.current, 1300, "rotate(-8deg)", ms);
    applyTextRise(dawnUpperRef.current, 1500, "rotate(-8deg)", ms);
    applyTextRise(dawnLowerRef.current, 1700, "rotate(4.5deg)", ms);
    applyTextRise(dawnDateRef.current, 1900, "rotate(-14deg)", ms);
  };

  const stopPhysicsLoop = () => {
    stopPhysicsRef.current?.();
    stopPhysicsRef.current = null;
    physRef.current.lastT = null;
  };

  const stepPhysics = (t: number) => {
    if (deadRef.current) {
      stopPhysicsLoop();
      return;
    }
    const st = physRef.current;
    const dt = st.lastT === null ? 0 : clamp((t - st.lastT) / 1000, 0, 0.05);
    st.lastT = t;

    // 1. Bouquet press & 2nd-order underdamped spring integration
    if (st.pressing) {
      const targetScale = bloomStartedRef.current ? 0.97 : 0.962;
      const targetTy = bloomStartedRef.current ? 1.5 : 2.0;
      const kp = dt > 0 ? 1 - Math.exp(-dt / 0.036) : 0.25;
      st.scale += (targetScale - st.scale) * kp;
      st.scaleVel = 0;
      st.ty += (targetTy - st.ty) * kp;
      st.tyVel = 0;
      st.angle += (-0.55 - st.angle) * kp;
      st.omega *= Math.exp(-8 * dt);
    } else if (dt > 0) {
      const sub = 2;
      const h = dt / sub;
      const wn = (2 * Math.PI) / 0.92;
      const zeta = 0.20;
      const ws = (2 * Math.PI) / 0.46;
      const zetas = 0.34;
      for (let i = 0; i < sub; i++) {
        const aAng = -wn * wn * st.angle - 2 * zeta * wn * st.omega;
        st.omega += aAng * h;
        st.angle += st.omega * h;

        const ds = st.scale - 1;
        const aScale = -ws * ws * ds - 2 * zetas * ws * st.scaleVel;
        st.scaleVel += aScale * h;
        st.scale += st.scaleVel * h;

        const aTy = -ws * ws * st.ty - 2 * 0.65 * ws * st.tyVel;
        st.tyVel += aTy * h;
        st.ty += st.tyVel * h;
      }
    }

    const springSettled =
      !st.pressing &&
      Math.abs(st.angle) < 0.008 &&
      Math.abs(st.omega) < 0.01 &&
      Math.abs(st.scale - 1) < 0.0008 &&
      Math.abs(st.scaleVel) < 0.008 &&
      Math.abs(st.ty) < 0.02;

    const springEl = bouquetSpringRef.current;
    if (springEl) {
      if (springSettled) {
        st.angle = 0;
        st.omega = 0;
        st.scale = 1;
        st.scaleVel = 0;
        st.ty = 0;
        st.tyVel = 0;
        springEl.style.transform = "none";
        springEl.style.willChange = "auto";
      } else {
        springEl.style.willChange = "transform";
        springEl.style.transform = `translate3d(0, ${st.ty.toFixed(2)}px, 0) rotate(${st.angle.toFixed(3)}deg) scale(${st.scale.toFixed(4)})`;
      }
    }

    // 2. Live 60fps Canvas Watercolor Petals
    const canvas = petalCanvasRef.current;
    if (canvas) {
      const dpr = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
      if (st.dpr !== dpr || canvas.width !== 390 * dpr || canvas.height !== 708 * dpr) {
        st.dpr = dpr;
        canvas.width = 390 * dpr;
        canvas.height = 708 * dpr;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const keep: Petal[] = [];
        const drag = 0.42;
        const gravity = 26;

        for (const p of st.petals) {
          if (t < p.bornAt) {
            keep.push(p);
            continue;
          }
          const age = (t - p.bornAt) / 1000;
          if (age >= p.life) continue;

          const dx = (p.vx0 / drag) * (1 - Math.exp(-drag * age));
          const dy = p.vy0 * age + 0.5 * gravity * age * age;
          const ramp = smooth(age / 0.32);
          const sway = p.swAmp * Math.sin(p.swFreq * age + p.swPhase) * ramp;
          const x = p.x0 + dx + sway;
          const y = p.y0 + dy + 0.24 * p.swAmp * Math.cos(p.swFreq * 0.72 * age + p.swPhase) * ramp;

          if (y > 736 || x < -36 || x > 426) continue;
          keep.push(p);

          const fadeIn = smooth(age / 0.14);
          const fadeOut = 1 - smooth((age - p.life * 0.62) / (p.life * 0.38));
          const alpha = p.maxOp * fadeIn * fadeOut;
          if (alpha <= 0.008) continue;

          const sx = 0.32 + 0.68 * Math.pow(Math.abs(Math.cos(p.fx * age + p.fph)), 0.6);
          const sy = 0.32 + 0.68 * Math.pow(Math.abs(Math.cos(p.fy * age + p.fph * 1.63)), 0.6);

          ctx.globalAlpha = alpha;
          ctx.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr);
          ctx.rotate(((p.rot0 + p.vr * age) * Math.PI) / 180);
          ctx.scale(sx, sy);
          ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        }

        st.petals = keep;
      }
    }

    // 3. Auto-stop rAF loop when all petals have faded and spring has settled
    if (springSettled && st.petals.length === 0) {
      stopPhysicsLoop();
    }
  };

  const ensurePhysicsLoop = () => {
    if (env.rm || deadRef.current) return;
    if (!stopPhysicsRef.current) {
      physRef.current.lastT = null;
      stopPhysicsRef.current = loop(stepPhysics);
    }
  };

  const emitPetals = (count: number, spanMs: number) => {
    if (env.rm) return;
    const st = physRef.current;
    const t0 = now();
    const effCount = env.low ? Math.max(6, Math.round(count * 0.68)) : count;

    for (let i = 0; i < effCount; i++) {
      // Cluster ~35% of petals in the immediate pluck impulse, remainder smoothly across spanMs
      const uTime = i < Math.ceil(effCount * 0.35) ? (i / Math.max(1, effCount * 0.35)) * 0.22 : 0.18 + nextRnd() * 0.82;
      const bornAt = t0 + spanMs * clamp(uTime, 0, 1);

      // Elliptical crown spawn around (195, 145) within ±68 x ±58
      const r = Math.sqrt(nextRnd());
      const th = nextRnd() * Math.PI * 2;
      const ox = Math.cos(th) * r * 68;
      const oy = Math.sin(th) * r * 58;
      const x0 = 195 + ox;
      const y0 = 145 + oy;

      // Outward + upward breeze impulse (vx: ±35..95 px/s, vy: -55..15 px/s)
      const dirSign = Math.abs(ox) > 10 ? ( nextRnd() < 0.82 ? Math.sign(ox) : -Math.sign(ox) ) : (nextRnd() < 0.5 ? -1 : 1);
      const speedX = 35 + nextRnd() * 60;
      const vx0 = dirSign * speedX;
      const vy0 = -55 + nextRnd() * 70;

      const kind: PetalKind = nextRnd() < 0.46 ? "sakura" : "petal";
      const hueIdx = (i + Math.floor(nextRnd() * 2)) % BOTANICAL_PALETTE.length;
      const sprite = getWatercolorSprite(hueIdx, kind);
      const size = kind === "sakura" ? 11.5 + nextRnd() * 5.2 : 9.8 + nextRnd() * 4.8;

      st.petals.push({
        bornAt,
        life: 2.0 + nextRnd() * 1.3,
        sprite,
        size,
        maxOp: 0.82 + nextRnd() * 0.14,
        x0,
        y0,
        vx0,
        vy0,
        swAmp: 8 + nextRnd() * 10,
        swFreq: (0.32 + nextRnd() * 0.28) * Math.PI * 2,
        swPhase: nextRnd() * Math.PI * 2,
        rot0: nextRnd() * 360,
        vr: (nextRnd() < 0.5 ? -1 : 1) * (34 + nextRnd() * 62),
        fx: (0.24 + nextRnd() * 0.32) * Math.PI * 2,
        fy: (0.20 + nextRnd() * 0.26) * Math.PI * 2,
        fph: nextRnd() * Math.PI * 2,
      });
    }

    // Cap live petal pool against rapid repeated taps
    if (st.petals.length > 90) {
      st.petals = st.petals.slice(st.petals.length - 90);
    }
  };

  const kickBouquetSpring = (initial: boolean) => {
    if (env.rm) return;
    const st = physRef.current;
    st.pressing = false;

    if (initial) {
      st.scale = Math.min(st.scale, 0.962);
      st.scaleVel = 1.24;
      st.ty = Math.max(st.ty, 2.0);
      st.tyVel = -18;
      st.angle = -0.45;
      st.omega = -27.5;
      st.retapSign = 1;
    } else {
      const tNow = now();
      const sign = tNow - st.lastTapAt < 900 ? -st.retapSign : 1;
      st.retapSign = sign;
      st.scale = Math.min(st.scale, 0.97);
      st.scaleVel = 0.88;
      st.ty = Math.max(st.ty, 1.5);
      st.tyVel = -14;
      st.angle = -0.35 * sign;
      st.omega = -21.8 * sign;
    }
    st.lastTapAt = now();
    ensurePhysicsLoop();
    // Apply immediate frame so t=0ms captures the tactile press/kick without waiting a frame
    stepPhysics(now());
  };

  const handlePointerDown = () => {
    if (env.rm) return;
    physRef.current.pressing = true;
    ensurePhysicsLoop();
  };

  const handlePointerReleaseCancel = () => {
    if (!physRef.current.pressing) return;
    physRef.current.pressing = false;
    ensurePhysicsLoop();
  };

  const startBloomAndDawn = () => {
    if (bloomStartedRef.current) return;
    bloomStartedRef.current = true;
    if (root.current) loadImgs(root.current);

    const flags = { hudFlipped: false, dawnPhaseSet: false };
    if (env.rm) {
      setPhase("dawn");
      applyBloomTimeline(2850, flags);
      return;
    }

    setPhase("blooming");
    emitPetals(26, 650);
    kickBouquetSpring(true);

    stopTimelineRef.current = tween({
      dur: 2850,
      ease: E.linear,
      on: (_, p) => {
        if (!deadRef.current) applyBloomTimeline(p * 2850, flags);
      },
      done: () => {
        if (!deadRef.current) {
          applyBloomTimeline(2850, flags);
          setPhase("dawn");
        }
      },
    });
  };

  const handleBouquetTap = () => {
    if (!bloomStartedRef.current) {
      startBloomAndDawn();
      return;
    }
    if (env.rm) return;
    emitPetals(10, 260);
    kickBouquetSpring(false);
  };

  useEffect(() => {
    deadRef.current = false;
    const getClock = makeClock();
    clockRef.current = getClock;
    const sync = () => {
      const s = since(getClock());
      setClock(s);
      if (enteredRef.current) setDisplayDays(s.d);
    };
    sync();

    let minTimer: number | null = null;
    const schedule = () => {
      const ms = 60000 - (getClock() % 60000) + 20;
      minTimer = window.setTimeout(() => {
        sync();
        schedule();
      }, ms);
    };
    schedule();

    onTier((tier) => {
      if (deadRef.current || tier !== 0) return;
      physRef.current.pressing = false;
      physRef.current.petals = [];
      stopPhysicsLoop();
      if (bouquetSpringRef.current) {
        bouquetSpringRef.current.style.transform = "none";
        bouquetSpringRef.current.style.willChange = "auto";
      }
      const c = petalCanvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      if (bloomStartedRef.current) {
        stopTimelineRef.current?.();
        stopTimelineRef.current = null;
        applyBloomTimeline(2850, { hudFlipped: false, dawnPhaseSet: false });
        setPhase("dawn");
      }
    });

    return () => {
      deadRef.current = true;
      if (minTimer !== null) window.clearTimeout(minTimer);
      stopTimelineRef.current?.();
      stopPhysicsLoop();
    };
  }, []);

  useEffect(() => {
    if (root.current) loadImgs(root.current);
    register({
      enter: () => {
        if (enteredRef.current) return;
        enteredRef.current = true;
        if (root.current) loadImgs(root.current);
        const s = since(clockRef.current());
        setClock(s);
        tween({
          dur: 900,
          delay: 120,
          ease: E.out,
          on: (k) => setDisplayDays(Math.round(s.d * k)),
          done: () => setDisplayDays(since(clockRef.current()).d),
        });
      },
    });
  }, [register]);

  const t = TEXT.ending;
  const dateLabel = START_ISO.slice(0, 10).replaceAll("-", ".");
  const isDawn = phase === "dawn";

  return (
    <Screen
      id="ending"
      index={index}
      total={total}
      scaledStage
      hudTone={hudDark ? "dark" : "light"}
      sky={
        <div className="full-bleed-bg">
          {/* 全幅星夜群青底色 */}
          <div style={SKY_NIGHT_STYLE} />
          {/* 破晓前奏柔粉紫云雾光晕 */}
          <div ref={bgPreludeRef} style={BG_PRELUDE_STYLE} />
          {/* 无痕多朵晨雾水彩破晓暖香槟天空 */}
          <div ref={bgDawnRef} style={BG_DAWN_STYLE} />
        </div>
      }
    >
      <style dangerouslySetInnerHTML={{ __html: BREEZE_STYLE_TEXT }} />
      <div
        ref={root}
        onClick={() => {
          if (!bloomStartedRef.current) startBloomAndDawn();
        }}
        style={{
          position: "relative",
          width: 390,
          height: 708,
          cursor: phase === "init" ? "pointer" : "default",
        }}
      >
        {/* ========== BASE LAYER: Night Copy & Whisper ========== */}
        <div ref={nightBaseRef} aria-hidden={phase !== "init"} style={NIGHT_BASE_STYLE}>
          <div ref={nightGlowRef} style={NIGHT_GLOW_STYLE} />

          <div ref={whisperNightRef} className="micro-badge" style={WHISPER_BADGE_STYLE}>
            <span className="micro-ring">
              <span className="micro-dot" />
            </span>
            <span className="micro-label">{t.whisperNight}</span>
          </div>

          <div className="ep-ang" style={NIGHT_GROUP_STYLE}>
            <CountdownRow d={displayDays} h={clock.h} m={clock.m} dayColor="#FFFFFF" primary="#FFFFFF" />
            <div>
              <span className="l" style={{ marginLeft: 18, lineHeight: "34px", marginTop: 8 }}>
                <span className="ss-it" style={{ fontSize: 28.5 }}>I bought</span>{" "}
                <span className="geo-caps" style={{ fontSize: 26, marginLeft: 4 }}>FLOWERS</span>
              </span>
              <span className="l" style={{ marginLeft: 56, lineHeight: "34px" }}>
                <span className="ss-it" style={{ fontSize: 28.5 }}>thinking about</span>{" "}
                <span className="ss-rm" style={{ fontSize: 28.5, marginLeft: 3 }}>you.</span>
              </span>
              <span className="l" style={{ marginLeft: 10, lineHeight: "34px" }}>
                <span className="ss-it" style={{ fontSize: 28.5 }}>I mean,</span>{" "}
                <span className="geo-caps" style={{ fontSize: 26, marginLeft: 4 }}>I LOVE YOU.</span>
              </span>
            </div>
          </div>

          <p style={NIGHT_DATE_STYLE}>
            自 <span style={{ fontFamily: "var(--geo)", fontWeight: 600, fontSize: 15, letterSpacing: "0.08em" }}>{dateLabel}</span>
          </p>
        </div>

        {/* ========== DAWN LAYER: Staggered Dawn Calligraphy & Editorial Copy ========== */}
        <div ref={dawnLayerRef} aria-hidden={!isDawn} style={DAWN_LAYER_STYLE}>
          <p ref={dawnMsgRef} style={DAWN_MSG_STYLE}>
            {t.endingMessage}
          </p>

          <div ref={dawnCountRef} className="ep-ang" style={DAWN_COUNT_STYLE}>
            <CountdownRow d={displayDays} h={clock.h} m={clock.m} dayColor="#B84A62" primary="#10259E" />
          </div>

          <div ref={dawnUpperRef} className="ep-ang" style={DAWN_UPPER_STYLE}>
            <span className="l" style={{ marginLeft: 6, lineHeight: "34px" }}>
              <span className="ss-it" style={{ fontSize: 28.5 }}>Timeless</span>{" "}
              <span className="geo-caps" style={{ fontSize: 25, fontWeight: 750, marginLeft: 4, color: "#B84A62" }}>ELEGANCE,</span>
            </span>
            <span className="l" style={{ marginLeft: 28, lineHeight: "36px" }}>
              <span className="bo-rm" style={{ fontSize: 25.5 }}>FOREVER</span>{" "}
              <span className="pf-it" style={{ fontSize: 28.5, marginLeft: 4 }}>Romance —</span>
            </span>
          </div>

          <div ref={dawnLowerRef} className="ep-ang" style={DAWN_LOWER_STYLE}>
            <span className="l" style={{ marginLeft: 38, lineHeight: "33px" }}>
              <span className="ss-it" style={{ fontSize: 27 }}>endless as the</span>{" "}
              <span className="geo-caps" style={{ fontSize: 25.5, fontWeight: 800, marginLeft: 4, color: "#B84A62" }}>LOVE</span>
            </span>
            <span className="l" style={{ marginLeft: 8, lineHeight: "35px" }}>
              <span className="geo-caps" style={{ fontSize: 24.5, fontWeight: 750, color: "#B84A62" }}>I HOLD</span>{" "}
              <span className="pf-it" style={{ fontSize: 27, marginLeft: 4 }}>always, for</span>{" "}
              <span className="ss-rm" style={{ fontSize: 28, marginLeft: 3 }}>you.</span>
            </span>
          </div>

          <p ref={dawnDateRef} style={DAWN_DATE_STYLE}>
            自 <span style={{ fontFamily: "var(--geo)", fontWeight: 600, fontSize: 15, letterSpacing: "0.08em" }}>{dateLabel}</span>
          </p>
        </div>

        {/* ========== UNIFIED LIVING BOUQUET RIG (3 pixel-locked layers, stem pivot 50% 88%) ========== */}
        <div className="ending-bq-breeze" style={BOUQUET_OUTER_STYLE}>
          <div ref={bouquetSpringRef} style={BOUQUET_SPRING_STYLE}>
            <img
              ref={bouquetLinesRef}
              data-src={`${A}bouquet-lines@3x.webp`}
              alt="花束线稿"
              draggable={false}
              style={BOUQUET_LINES_STYLE}
            />
            <img
              ref={bouquetColorARef}
              data-src={`${A}bouquet-color-a@3x.webp`}
              alt=""
              draggable={false}
              style={BOUQUET_COLOR_A_STYLE}
            />
            <img
              ref={bouquetColorBRef}
              data-src={`${A}bouquet-color-b@3x.webp`}
              alt="破晓色彩花束"
              draggable={false}
              style={BOUQUET_COLOR_B_STYLE}
            />
          </div>
        </div>

        {/* ========== LIVE 60FPS WATERCOLOR PETALS CANVAS ========== */}
        <canvas ref={petalCanvasRef} width={390} height={708} style={PETAL_CANVAS_STYLE} />

        {/* ========== INTERACTIVE BOUQUET HITBOX (Initial Bloom + Dawn Re-tap) ========== */}
        <button
          type="button"
          aria-label={isDawn ? "轻触花束轻摇落瓣" : "轻触花束"}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerReleaseCancel}
          onPointerCancel={handlePointerReleaseCancel}
          onPointerLeave={handlePointerReleaseCancel}
          onClick={(e) => {
            e.stopPropagation();
            handleBouquetTap();
          }}
          style={HITBOX_BTN_STYLE}
        />
      </div>
    </Screen>
  );
}
