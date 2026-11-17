"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, PHOTOS, TEXT } from "@/config";
import { loadImgs } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const P = `${BASE_PATH}/photos/`;

const SK_PATH =
  "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";
const SINGLE_PETAL =
  "M0 0 C 1.8 -2.3, 2.6 -5.5, 2.1 -8.5 C 1.8 -10.1, 0.9 -10.7, 0.35 -10.2 L 0 -9.0 L -0.45 -10.3 C -1.05 -10.6, -1.9 -9.8, -2.0 -8.0 C -2.2 -5.0, -1.2 -2.2, 0 0 Z";

const SAKURA_BLOOMS = [
  { kind: "bloom" as const, x: 298, y: 174, size: 16, rot: -18, fill: "#FFE8F0", op: 0.38, blur: 1.3 },
  { kind: "bloom" as const, x: 354, y: 386, size: 12, rot: 22, fill: "#FFFFFF", op: 0.56, blur: 0 },
  { kind: "bloom" as const, x: 44, y: 476, size: 13, rot: -24, fill: "#FFE5CC", op: 0.58, blur: 0 },
  { kind: "petal" as const, x: 76, y: 548, size: 11.5, rot: 48, fill: "#FFD6E4", op: 0.54, blur: 0 },
  { kind: "bloom" as const, x: 28, y: 598, size: 17, rot: -12, fill: "#F6DEC2", op: 0.36, blur: 1.4 },
  { kind: "bloom" as const, x: 356, y: 542, size: 11.5, rot: 16, fill: "#FFE8F0", op: 0.52, blur: 0 },
  { kind: "petal" as const, x: 336, y: 646, size: 11.5, rot: -54, fill: "#FFE2C0", op: 0.54, blur: 0 },
  { kind: "bloom" as const, x: 164, y: 654, size: 9.5, rot: 15, fill: "#FFFFFF", op: 0.52, blur: 0 },
  { kind: "petal" as const, x: 362, y: 464, size: 10, rot: 62, fill: "#FFE5CC", op: 0.48, blur: 0 },
];

const GLOW_DOTS = [
  { x: 258, y: 192, r: 0.95, fill: "#FFD6E4", op: 0.68 },
  { x: 366, y: 414, r: 0.85, fill: "#F6DEC2", op: 0.64 },
  { x: 54, y: 514, r: 1.05, fill: "#FFE5CC", op: 0.72 },
  { x: 220, y: 636, r: 0.8, fill: "#FFD6E4", op: 0.62 },
  { x: 344, y: 608, r: 0.9, fill: "#F6DEC2", op: 0.66 },
];

export function Photos({
  register,
  index,
  total,
  modal,
}: ScreenProps & { modal: (on: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [easterOpen, setEasterOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<{ src: string; caption?: string; aspect: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    register({
      enter: () => setEntered(true),
    });
  }, [register]);

  useEffect(() => {
    if (root.current) loadImgs(root.current);
  }, []);

  const isModalOpen = easterOpen || zoomSrc !== null;

  useEffect(() => {
    modal(isModalOpen);
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomSrc) setZoomSrc(null);
        else setEasterOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen, zoomSrc, modal]);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    startPt.current = null;
  };

  const beginHold = (e: React.PointerEvent) => {
    clearHold();
    suppressClick.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setEasterOpen(true);
    }, 600);
  };

  const moveHold = (e: React.PointerEvent) => {
    if (!startPt.current) return;
    if (Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > 10) {
      clearHold();
    }
  };

  const t = TEXT.photos;

  return (
    <Screen
      id="photos"
      index={index}
      total={total}
      overlay={
        <>
          {easterOpen && (
            <div
              className="ep-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="对照彩蛋"
              onClick={() => setEasterOpen(false)}
            >
              <button
                type="button"
                className="ep-close-btn"
                aria-label="关闭彩蛋"
                onClick={(e) => {
                  e.stopPropagation();
                  setEasterOpen(false);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>

              {/* Left Comparison Polaroid: Cat meme */}
              <div
                className="ee-card"
                role="button"
                tabIndex={0}
                aria-label={t.eggCatCaption}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomSrc({ src: `${P}${PHOTOS.catFull}`, caption: t.eggCatCaption, aspect: 737 / 1024 });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoomSrc({ src: `${P}${PHOTOS.catFull}`, caption: t.eggCatCaption, aspect: 737 / 1024 });
                  }
                }}
                style={{ left: 16, top: 262, transform: "rotate(-2.2deg)" }}
              >
                <div className="washi" style={{ left: 14, top: -6, width: 40, backgroundColor: "rgba(255,214,228,0.74)", transform: "rotate(-12deg)" }} />
                <img
                  className="pol-photo"
                  src={`${P}${PHOTOS.catFull}`}
                  alt={t.eggCatCaption}
                  draggable={false}
                  style={{ width: 160, height: 222, objectFit: "cover" }}
                />
                <div className="ee-cap">{t.eggCatCaption}</div>
              </div>

              {/* Right Comparison Polaroid: GD / T.O.P */}
              <div
                className="ee-card"
                role="button"
                tabIndex={0}
                aria-label={t.eggGdCaption}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomSrc({ src: `${P}${PHOTOS.gdFull}`, caption: t.eggGdCaption, aspect: 767 / 1024 });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoomSrc({ src: `${P}${PHOTOS.gdFull}`, caption: t.eggGdCaption, aspect: 767 / 1024 });
                  }
                }}
                style={{ left: 202, top: 278, transform: "rotate(2.2deg)" }}
              >
                <div className="washi" style={{ right: 14, top: -6, width: 40, backgroundColor: "rgba(246,222,194,0.76)", transform: "rotate(12deg)" }} />
                <img
                  className="pol-photo"
                  src={`${P}${PHOTOS.gdFull}`}
                  alt={t.eggGdCaption}
                  draggable={false}
                  style={{ width: 160, height: 214, objectFit: "cover" }}
                />
                <div className="ee-cap">{t.eggGdCaption}</div>
              </div>
            </div>
          )}

          {zoomSrc && (
            <div
              className="ep-modal-backdrop"
              style={{ zIndex: 50 }}
              role="dialog"
              aria-modal="true"
              aria-label="放大相片"
              onClick={() => setZoomSrc(null)}
            >
              <button
                type="button"
                className="ep-close-btn"
                aria-label="关闭放大相片"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomSrc(null);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "linear-gradient(166deg, #FDFBF6 0%, #F7EFE3 62%, #EFE3D2 100%)",
                  padding: zoomSrc.caption ? "10px 10px 0" : 10,
                  borderRadius: 3,
                  boxShadow: "0 24px 58px rgba(2, 6, 36, 0.78)",
                  maxWidth: 336,
                }}
              >
                <img
                  src={zoomSrc.src}
                  alt={zoomSrc.caption || ""}
                  style={{
                    display: "block",
                    width: Math.min(316, Math.round(450 * zoomSrc.aspect)),
                    height: "auto",
                    maxHeight: 490,
                    borderRadius: 1,
                    objectFit: "contain",
                  }}
                />
                {zoomSrc.caption && <div className="ee-cap" style={{ height: 42, fontSize: 13 }}>{zoomSrc.caption}</div>}
              </div>
            </div>
          )}
        </>
      }
    >
      <div ref={root} style={{ position: "relative", width: 390, height: 844, overflow: "hidden" }}>
        {/* 05-B Warm Champagne Dawn Prelude Ambient Glow (Zero Left Axis) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 100% 44% at 50% 98%, rgba(255,227,191,0.36) 0%, rgba(245,217,230,0.16) 46%, rgba(20,48,196,0) 80%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Scattered Depth-of-Field Sakura Blossoms, Single Petals & Micro Glow Dots */}
        <svg viewBox="0 0 390 844" style={{ position: "absolute", inset: 0, width: 390, height: 844, pointerEvents: "none", zIndex: 4 }}>
          {SAKURA_BLOOMS.map((s, idx) =>
            s.kind === "bloom" ? (
              <g
                key={idx}
                transform={`translate(${s.x},${s.y}) rotate(${s.rot}) scale(${(s.size / 18).toFixed(3)})`}
                opacity={s.op}
                fill={s.fill}
                style={s.blur > 0 ? { filter: `blur(${s.blur}px)` } : undefined}
              >
                {[0, 72, 144, 216, 288].map((r) => (
                  <path key={r} d={SK_PATH} transform={`rotate(${r})`} />
                ))}
                <circle r="2" />
              </g>
            ) : (
              <g
                key={idx}
                transform={`translate(${s.x},${s.y}) rotate(${s.rot}) scale(${(s.size / 10.6).toFixed(3)})`}
                opacity={s.op}
                fill={s.fill}
              >
                <path d={SINGLE_PETAL} transform="translate(0,5.3)" />
              </g>
            )
          )}
          {GLOW_DOTS.map((d, idx) => (
            <g key={`d${idx}`} transform={`translate(${d.x},${d.y})`}>
              <circle r={(d.r * 2.9).toFixed(2)} fill={d.fill} opacity={(d.op * 0.28).toFixed(2)} />
              <circle r={d.r.toFixed(2)} fill={d.fill} opacity={d.op} />
            </g>
          ))}
        </svg>

        {/* Tilted Header & Locked 100-Day Letter Subtitles */}
        <div
          className="ep-ang"
          style={{
            left: 24,
            top: 46,
            transform: "rotate(-7deg)",
            zIndex: 15,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.08s",
          }}
        >
          <span className="l" style={{ lineHeight: "36px" }}>
            <span className="ep-display">{t.zhTitle}</span>
            <span className="ss-it" style={{ fontSize: 19.5, color: "#CFD8FF", marginLeft: 8 }}>{t.enLeft}</span>
            <span className="geo-caps" style={{ fontSize: 17, marginLeft: 4, color: "#FFD6E4" }}>{t.enRight}</span>
          </span>
          <span className="l ep-sub" style={{ marginLeft: 4, marginTop: 7 }}>{t.sub1}</span>
          <span className="l ep-sub" style={{ marginLeft: 10 }}>{t.sub2}</span>
        </div>

        {/* Card 1: PAILEPAI FLIGHTS full uncropped vertical strip */}
        <div
          className="pol-card"
          role="button"
          tabIndex={0}
          aria-label="放大查看三格飞机拍立得"
          onClick={() => setZoomSrc({ src: `${P}${PHOTOS.pailepai}`, aspect: 686 / 1024 })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setZoomSrc({ src: `${P}${PHOTOS.pailepai}`, aspect: 686 / 1024 });
            }
          }}
          style={{
            left: 16,
            top: 162,
            width: 184,
            padding: 6,
            transform: entered ? "rotate(-2.6deg)" : "rotate(-2.6deg) translateY(16px)",
            opacity: entered ? 1 : 0,
            transitionDelay: "0.10s",
            zIndex: 6,
          }}
        >
          <div className="washi" style={{ left: 14, top: -6, width: 44, backgroundColor: "rgba(246,222,194,0.78)", transform: "rotate(-15deg)" }} />
          <img
            className="pol-photo"
            data-src={`${P}${PHOTOS.pailepai}`}
            alt="PAILEPAI FLIGHTS 拍立得"
            draggable={false}
            style={{ width: 172, height: 257, objectFit: "cover" }}
          />
        </div>

        {/* Card 2: Cat Mouth-Cover bottom remake only + 20px pure blank ivory chin */}
        <div
          className="pol-card"
          role="button"
          tabIndex={0}
          aria-label="长按开启小嘴抹了蜜对照彩蛋"
          onPointerDown={beginHold}
          onPointerMove={moveHold}
          onPointerUp={clearHold}
          onPointerCancel={clearHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (!suppressClick.current) {
              setZoomSrc({ src: `${P}${PHOTOS.catRemake}`, aspect: 737 / 502 });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEasterOpen(true);
            }
          }}
          style={{
            left: 200,
            top: 216,
            width: 174,
            padding: "7px 7px 20px",
            transform: entered ? "rotate(3.2deg)" : "rotate(3.2deg) translateY(18px)",
            opacity: entered ? 1 : 0,
            transitionDelay: "0.18s",
            zIndex: 7,
          }}
        >
          <div className="washi" style={{ right: 14, top: -6, width: 42, backgroundColor: "rgba(255,214,228,0.74)", transform: "rotate(13deg)" }} />
          <img
            className="pol-photo"
            data-src={`${P}${PHOTOS.catRemake}`}
            alt="捂嘴拍立得"
            draggable={false}
            style={{ width: 160, height: 109, objectFit: "cover", objectPosition: "center center" }}
          />
        </div>

        {/* Card 3: GD & T.O.P Pointing bottom remake only + 22px pure blank ivory chin */}
        <div
          className="pol-card"
          role="button"
          tabIndex={0}
          aria-label="长按开启霸道黑老大守护我对照彩蛋"
          onPointerDown={beginHold}
          onPointerMove={moveHold}
          onPointerUp={clearHold}
          onPointerCancel={clearHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => {
            if (!suppressClick.current) {
              setZoomSrc({ src: `${P}${PHOTOS.gdRemake}`, aspect: 767 / 510 });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEasterOpen(true);
            }
          }}
          style={{
            left: 118,
            top: 454,
            width: 214,
            padding: "7px 7px 22px",
            transform: entered ? "rotate(-2.2deg)" : "rotate(-2.2deg) translateY(20px)",
            opacity: entered ? 1 : 0,
            transitionDelay: "0.26s",
            zIndex: 8,
          }}
        >
          <div className="washi" style={{ right: 16, top: -6, width: 44, backgroundColor: "rgba(207,216,255,0.78)", transform: "rotate(-11deg)" }} />
          <img
            className="pol-photo"
            data-src={`${P}${PHOTOS.gdRemake}`}
            alt="比枪守护拍立得"
            draggable={false}
            style={{ width: 200, height: 133, objectFit: "cover", objectPosition: "center center" }}
          />
        </div>

        {/* Inter-card deep-blue gap breathing micro-badge */}
        <button
          type="button"
          className="micro-badge"
          aria-label="打开对照彩蛋"
          onClick={() => setEasterOpen(true)}
          style={{
            left: 240,
            top: 394,
            transform: "rotate(-3deg)",
            zIndex: 12,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.3s",
          }}
        >
          <span className="micro-ring"><span className="micro-dot" /></span>
          <span className="micro-label">{t.badge}</span>
        </button>

        {/* Two-line understated Zhi Mang Xing quote over bottom warm champagne glow */}
        <div
          className="ep-ang"
          style={{
            left: 48,
            top: 696,
            transform: "rotate(-4.5deg)",
            zIndex: 15,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.85s ease 0.34s",
          }}
        >
          <span
            className="l"
            style={{
              fontFamily: "var(--zhimang)",
              fontSize: 22,
              lineHeight: "29px",
              letterSpacing: "0.04em",
              color: "#F6DEC2",
              textShadow: "0 2px 12px rgba(8,18,90,0.34)",
            }}
          >
            {t.couplet1}
          </span>
          <span
            className="l"
            style={{
              marginLeft: 54,
              fontFamily: "var(--zhimang)",
              fontSize: 22,
              lineHeight: "29px",
              letterSpacing: "0.04em",
              color: "#FFF1E6",
              textShadow: "0 2px 12px rgba(8,18,90,0.34)",
            }}
          >
            {t.couplet2}
          </span>
        </div>
      </div>
    </Screen>
  );
}
