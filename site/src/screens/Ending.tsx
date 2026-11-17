"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, START_ISO, TEXT } from "@/config";
import { E, isVirtual, loadImgs, now, tween } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const A = `${BASE_PATH}/assets/`;
const START = Date.parse(START_ISO);
const SK_PATH =
  "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";
const SINGLE_PETAL = "M0,-5.5 C2.8,-3.5 3.6,1.5 0,5.5 C-3.6,1.5 -2.8,-3.5 0,-5.5 Z";

const PRELUDE_FLOWERS = [
  [68, 118, 16, -18, "#FFD6E4", 0.9],
  [318, 110, 18, 22, "#B8E4FF", 0.9],
  [48, 234, 15, 40, "#FFE6B8", 0.86],
  [342, 218, 14, -35, "#E4C8FF", 0.86],
  [82, 336, 14, 15, "#FFB8CF", 0.8],
  [312, 318, 15, -48, "#B8E4FF", 0.84],
  [124, 66, 13, 28, "#E4C8FF", 0.8],
  [286, 72, 14, -14, "#FFE6B8", 0.82],
] as const;

const PRELUDE_PETALS = [
  [102, 366, 0.85, 32, "#FFD6E4", 0.72],
  [292, 358, 0.8, -28, "#B8E4FF", 0.7],
  [88, 280, 0.75, 52, "#FFE6B8", 0.75],
  [300, 170, 0.75, -18, "#FFD6E4", 0.75],
] as const;

const DAWN_FLOWERS = [
  [66, 118, 16, -18, "#F29BB2", 0.84],
  [320, 108, 18, 22, "#76ADE0", 0.82],
  [48, 232, 15, 40, "#DFB468", 0.82],
  [342, 218, 14, -35, "#B796D9", 0.8],
  [82, 336, 14, 15, "#E8829D", 0.78],
  [312, 318, 15, -48, "#76ADE0", 0.78],
  [124, 66, 13, 28, "#B796D9", 0.76],
  [286, 72, 14, -14, "#DFB468", 0.78],
] as const;

const DAWN_PETALS = [
  [102, 366, 0.85, 32, "#F29BB2", 0.65],
  [292, 358, 0.8, -28, "#76ADE0", 0.65],
  [88, 280, 0.75, 52, "#DFB468", 0.65],
  [300, 170, 0.75, -18, "#F29BB2", 0.65],
] as const;

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

/** 07 破晓花束：1:1 对齐 06-after-copy-options.png 定稿 3 & 06-scheme-B 破晓分镜 */
export function Ending({ register, index, total }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const clockRef = useRef<() => number>(() => Date.parse("2026-12-03T00:00:00+08:00"));
  const [phase, setPhase] = useState<"init" | "A" | "B">("init");
  const [displayDays, setDisplayDays] = useState(100);
  const [clock, setClock] = useState(() => since(Date.parse("2026-12-03T00:00:00+08:00")));

  useEffect(() => {
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
    return () => {
      if (minTimer !== null) window.clearTimeout(minTimer);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
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

  const triggerDawn = () => {
    if (phase !== "init") return;
    // 先点亮星夜粉蓝花束（防闪白），320ms 后暖香槟破晓光圈自花心漫开
    setPhase("A");
    timerRef.current = window.setTimeout(() => {
      setPhase("B");
    }, 320);
  };

  const t = TEXT.ending;
  const dateLabel = START_ISO.slice(0, 10).replaceAll("-", ".");
  const isPrelude = phase === "A";
  const isDawn = phase === "B";

  return (
    <Screen id="ending" index={index} total={total} hudTone={isDawn ? "dark" : "light"}>
      <div
        ref={root}
        onClick={triggerDawn}
        style={{
          position: "relative",
          width: 390,
          height: 844,
          overflow: "hidden",
          cursor: phase === "init" ? "pointer" : "default",
        }}
      >
        {/* ========== BASE LAYER: Night Init -> Prelude A (Starry Bloom) ========== */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 65% 50% at 50% 34%, rgba(56, 86, 232, 0.35) 0%, rgba(20, 48, 196, 0) 70%), radial-gradient(ellipse 80% 70% at 50% 50%, rgba(11,30,140,0) 45%, rgba(11,30,140,0.3) 100%), #1430C4",
            color: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          {/* Subtle Center Glow / Starry Prelude A Halo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle 120px at 50% 27%, rgba(255,255,255,0.08) 0%, transparent 72%)",
              pointerEvents: "none",
              opacity: isPrelude ? 0 : 1,
              transition: "opacity 0.4s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 76% 52% at 50% 28%, rgba(235,130,175,0.44) 0%, rgba(142,110,240,0.26) 42%, rgba(20,48,196,0) 76%), radial-gradient(circle 138px at 50% 27%, rgba(255,224,195,0.34) 0%, rgba(255,180,205,0.15) 55%, transparent 100%)",
              pointerEvents: "none",
              opacity: isPrelude || isDawn ? 1 : 0,
              transition: "opacity 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          />

          {/* Orbit Rings & Prelude Sakura */}
          <svg
            viewBox="0 0 390 480"
            style={{ position: "absolute", left: 0, top: 0, width: 390, height: 480, pointerEvents: "none" }}
          >
            <circle cx="195" cy="204" r="94" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
            <circle cx="195" cy="204" r="124" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
            <g style={{ opacity: isPrelude ? 1 : 0, transition: "opacity 0.45s ease" }}>
              <circle cx="195" cy="204" r="118" fill="none" stroke="rgba(255,220,232,0.32)" strokeWidth="1" />
              <circle cx="195" cy="204" r="158" fill="none" stroke="rgba(180,220,255,0.18)" strokeWidth="1" strokeDasharray="3 5" />
              {PRELUDE_FLOWERS.map(([x, y, s, r, c, o], idx) => (
                <g key={idx} transform={`translate(${x},${y}) rotate(${r}) scale(${(s / 18).toFixed(3)})`} opacity={o} fill={c}>
                  {[0, 72, 144, 216, 288].map((deg) => (
                    <path key={deg} d={SK_PATH} transform={`rotate(${deg})`} />
                  ))}
                  <circle r="2" />
                </g>
              ))}
              {PRELUDE_PETALS.map(([x, y, sc, r, c, o], idx) => (
                <g key={`p${idx}`} transform={`translate(${x},${y}) rotate(${r}) scale(${sc})`} opacity={o} fill={c}>
                  <path d={SINGLE_PETAL} />
                </g>
              ))}
            </g>
          </svg>

          {/* Top Bouquet (74, 50, 242x310): Line Art -> Starry Prelude Color A */}
          <img
            data-src={`${A}bouquet-lines@3x.webp`}
            alt="花束线稿"
            draggable={false}
            style={{
              position: "absolute",
              left: 74,
              top: 50,
              width: 242,
              height: 310,
              objectFit: "contain",
              pointerEvents: "none",
              opacity: isPrelude ? 0 : 1,
              transition: "opacity 0.45s ease",
            }}
          />
          <img
            data-src={`${A}bouquet-color-a@3x.webp`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: 74,
              top: 50,
              width: 242,
              height: 310,
              objectFit: "contain",
              pointerEvents: "none",
              opacity: isPrelude ? 1 : 0,
              transition: "opacity 0.45s ease",
            }}
          />

          {/* Subtle Prompt Under Bouquet Before Tap */}
          <p
            style={{
              position: "absolute",
              left: 0,
              width: 390,
              top: 378,
              textAlign: "center",
              whiteSpace: "nowrap",
              transform: "rotate(-8deg)",
              fontFamily: "var(--sans)",
              fontWeight: 500,
              fontSize: 12,
              letterSpacing: "0.18em",
              color: isPrelude ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.68)",
              transition: "color 0.35s ease",
              pointerEvents: "none",
            }}
          >
            {t.whisperNight}
          </p>

          {/* Night Live Counter + Night Chanel Copy (exact left=24, top=448, -8deg) */}
          <div className="ep-ang" style={{ left: 24, top: 448, transform: "rotate(-8deg)", color: "#FFFFFF" }}>
            <CountdownRow d={displayDays} h={clock.h} m={clock.m} dayColor="#FFFFFF" primary="#FFFFFF" />
            <div style={{ opacity: isPrelude ? 0.42 : 1, transition: "opacity 0.4s ease" }}>
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

          {/* Bottom-Right Date Stamp */}
          <p
            style={{
              position: "absolute",
              left: 212,
              top: 756,
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
            }}
          >
            自 <span style={{ fontFamily: "var(--geo)", fontWeight: 600, fontSize: 15, letterSpacing: "0.08em" }}>{dateLabel}</span>
          </p>
        </div>

        {/* ========== DAWN LAYER B: Radial Warm Champagne Expansion from Bouquet Center (195, 204) ========== */}
        <div
          aria-hidden={!isDawn}
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 85% 65% at 50% 34%, #FFFDF9 0%, #F7EFE2 58%, #EBE0CD 100%)",
            color: "#10259E",
            overflow: "hidden",
            clipPath: isDawn ? "circle(160% at 195px 204px)" : "circle(0% at 195px 204px)",
            transition: "clip-path 1.15s cubic-bezier(0.22, 0.61, 0.36, 1)",
            pointerEvents: isDawn ? "auto" : "none",
            zIndex: 8,
          }}
        >
          {/* Warm Rose-Champagne Center Glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle 165px at 50% 27%, rgba(255,205,216,0.52) 0%, rgba(245,220,175,0.26) 55%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Orbit Rings & Original 06-scheme-B Multicolor Sakura + 4 Petals */}
          <svg
            viewBox="0 0 390 480"
            style={{ position: "absolute", left: 0, top: 0, width: 390, height: 480, pointerEvents: "none" }}
          >
            <circle cx="195" cy="204" r="118" fill="none" stroke="rgba(184,74,98,0.20)" strokeWidth="1" />
            <circle cx="195" cy="204" r="158" fill="none" stroke="rgba(16,37,158,0.10)" strokeWidth="1" strokeDasharray="3 5" />
            {DAWN_FLOWERS.map(([x, y, s, r, c, o], idx) => (
              <g key={idx} transform={`translate(${x},${y}) rotate(${r}) scale(${(s / 18).toFixed(3)})`} opacity={o} fill={c}>
                {[0, 72, 144, 216, 288].map((deg) => (
                  <path key={deg} d={SK_PATH} transform={`rotate(${deg})`} />
                ))}
                <circle r="2" />
              </g>
            ))}
            {DAWN_PETALS.map(([x, y, sc, r, c, o], idx) => (
              <g key={`p${idx}`} transform={`translate(${x},${y}) rotate(${r}) scale(${sc})`} opacity={o} fill={c}>
                <path d={SINGLE_PETAL} />
              </g>
            ))}
          </svg>

          {/* Original 06-scheme-B Watercolor Bouquet */}
          <img
            data-src={`${A}bouquet-color-b@3x.webp`}
            alt="破晓色彩花束"
            draggable={false}
            style={{
              position: "absolute",
              left: 74,
              top: 50,
              width: 242,
              height: 310,
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />

          {/* Under-Flower Zhi Mang Xing Line (top: 378px, -8deg, #B84A62) */}
          <p
            style={{
              position: "absolute",
              left: 0,
              width: 390,
              top: 378,
              textAlign: "center",
              whiteSpace: "nowrap",
              transform: "rotate(-8deg)",
              fontFamily: "var(--zhimang)",
              fontSize: 22.5,
              letterSpacing: "0.12em",
              color: "#B84A62",
            }}
          >
            {t.endingMessage}
          </p>

          {/* Live Chinese Counter (left: 24, top: 448, -8deg, 100 in #B84A62) */}
          <div className="ep-ang" style={{ left: 24, top: 448, transform: "rotate(-8deg)", color: "#10259E" }}>
            <CountdownRow d={displayDays} h={clock.h} m={clock.m} dayColor="#B84A62" primary="#10259E" />
          </div>

          {/* Scheme C Upper Block (-8deg): Timeless ELEGANCE, / FOREVER Romance — */}
          <div className="ep-ang" style={{ left: 22, top: 510, transform: "rotate(-8deg)", color: "#10259E" }}>
            <span className="l" style={{ marginLeft: 6, lineHeight: "34px" }}>
              <span className="ss-it" style={{ fontSize: 28.5 }}>Timeless</span>{" "}
              <span className="geo-caps" style={{ fontSize: 25, fontWeight: 750, marginLeft: 4, color: "#B84A62" }}>ELEGANCE,</span>
            </span>
            <span className="l" style={{ marginLeft: 28, lineHeight: "36px" }}>
              <span className="bo-rm" style={{ fontSize: 25.5 }}>FOREVER</span>{" "}
              <span className="pf-it" style={{ fontSize: 28.5, marginLeft: 4 }}>Romance —</span>
            </span>
          </div>

          {/* Scheme C Lower Counter-Tilted Block (+4.5deg): endless as the LOVE / I HOLD always, for you. */}
          <div className="ep-ang" style={{ left: 28, top: 616, transform: "rotate(4.5deg)", color: "#10259E" }}>
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

          {/* Bottom-Right Date Stamp */}
          <p
            style={{
              position: "absolute",
              left: 212,
              top: 756,
              color: "rgba(16,37,158,0.62)",
              transform: "rotate(-14deg)",
              transformOrigin: "0 0",
              whiteSpace: "nowrap",
              fontFamily: "var(--sans)",
              fontWeight: 500,
              fontSize: 13,
              lineHeight: "20px",
              letterSpacing: "0.1em",
              pointerEvents: "none",
            }}
          >
            自 <span style={{ fontFamily: "var(--geo)", fontWeight: 600, fontSize: 15, letterSpacing: "0.08em" }}>{dateLabel}</span>
          </p>
        </div>

        {/* Interactive Bouquet Hitbox */}
        <button
          type="button"
          aria-label={isDawn ? "破晓花束已绽放" : "轻触花束迎来破晓"}
          onClick={(e) => {
            e.stopPropagation();
            triggerDawn();
          }}
          style={{
            position: "absolute",
            left: 60,
            top: 44,
            width: 270,
            height: 330,
            background: "transparent",
            border: 0,
            cursor: phase === "init" ? "pointer" : "default",
            zIndex: 14,
          }}
        />
      </div>
    </Screen>
  );
}
