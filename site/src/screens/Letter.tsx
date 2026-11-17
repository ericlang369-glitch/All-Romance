"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, PHOTOS, TEXT } from "@/config";
import { Y, YB, loadImgs } from "@/lib/kit";
import { Photo, Screen, type ScreenProps } from "./common";

const SK_PATH =
  "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";

const SAKURA_ITEMS = [
  // Outer cool moon-white blossoms
  { x: 306, y: 186, size: 15, rot: -16, fill: "#FFFFFF", op: 0.56, blur: 0 },
  { x: 46, y: 274, size: 14, rot: 22, fill: "#CFD8FF", op: 0.44, blur: 0.8 },
  { x: 350, y: 298, size: 13, rot: 34, fill: "#FFFFFF", op: 0.52, blur: 0 },
  { x: 32, y: 422, size: 17, rot: -26, fill: "#CFD8FF", op: 0.38, blur: 1.2 },
  { x: 358, y: 446, size: 16, rot: 14, fill: "#FFFFFF", op: 0.40, blur: 1.1 },
  // Inner warm candlelight blossoms (centripetal toward E1 halo)
  { x: 76, y: 318, size: 11.5, rot: -12, fill: "#FFE6D2", op: 0.72, blur: 0 },
  { x: 318, y: 340, size: 12, rot: 18, fill: "#FFD8E4", op: 0.74, blur: 0 },
  { x: 64, y: 506, size: 11, rot: 28, fill: "#FFE6D2", op: 0.68, blur: 0 },
  { x: 332, y: 522, size: 11.5, rot: -20, fill: "#FFD8E4", op: 0.72, blur: 0 },
  { x: 96, y: 604, size: 10.5, rot: 12, fill: "#FFE6D2", op: 0.60, blur: 0 },
  { x: 298, y: 608, size: 10.5, rot: -30, fill: "#FFFFFF", op: 0.56, blur: 0 },
];

export function Letter({
  register,
  index,
  total,
  modal,
  onNext,
}: ScreenProps & { modal: (on: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    register({
      enter: () => setEntered(true),
    });
  }, [register]);

  useEffect(() => {
    if (root.current) loadImgs(root.current);
  }, []);

  useEffect(() => {
    modal(zoomOpen);
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, modal]);

  const t = TEXT.letter;

  return (
    <Screen
      id="letter"
      index={index}
      total={total}
      overlay={
        zoomOpen ? (
          <div
            className="ep-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="信笺放大阅读"
            onClick={() => setZoomOpen(false)}
          >
            <button
              type="button"
              className="ep-close-btn"
              aria-label="关闭信笺大图"
              onClick={(e) => {
                e.stopPropagation();
                setZoomOpen(false);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 332,
                maxHeight: "76%",
                borderRadius: 4,
                background: "linear-gradient(172deg, #FCF8EE 0%, #F5ECDA 100%)",
                boxShadow: "0 24px 60px rgba(2, 6, 36, 0.72), inset 0 0 0 1px rgba(20, 48, 196, 0.08)",
                padding: PHOTOS.letter ? 10 : "28px 24px 30px",
                color: "#2E3556",
                overflowY: "auto",
              }}
            >
              {PHOTOS.letter ? (
                <img
                  src={`${BASE_PATH}/photos/${PHOTOS.letter}`}
                  alt="你的手写信"
                  style={{ display: "block", width: "100%", height: "auto", borderRadius: 2 }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid rgba(18, 42, 130, 0.14)", paddingBottom: 10 }}>
                    <span style={{ fontFamily: "var(--latin)", fontStyle: "italic", fontWeight: 700, fontSize: 15, color: "#10259E" }}>
                      To Eric, from You
                    </span>
                    <span style={{ fontFamily: "var(--geo)", fontSize: 10, letterSpacing: "0.14em", color: "rgba(16, 37, 158, 0.56)" }}>
                      手写信原图位
                    </span>
                  </div>
                  <div
                    style={{
                      minHeight: 270,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 18,
                      backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 35px, rgba(16, 37, 158, 0.08) 35px 36px)",
                      padding: "6px 4px",
                    }}
                  >
                    <p style={{ fontFamily: "var(--serif)", fontSize: 15, lineHeight: "36px", color: "#273164" }}>
                      八月二十五日那天之后，这一页留给你亲手写下的回信。
                    </p>
                    <p style={{ fontFamily: "var(--sans)", fontSize: 11.5, lineHeight: "22px", color: "rgba(39, 49, 100, 0.68)" }}>
                      拍照放入后填入 src/config.ts 的 PHOTOS.letter，这里会直接铺展你的真迹大图。
                    </p>
                  </div>
                  <p style={{ textAlign: "right", fontFamily: "var(--zhimang)", fontSize: 22, color: "#10259E" }}>
                    {t.couplet}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null
      }
    >
      <div ref={root} style={{ position: "relative", width: 390, height: 844, overflow: "hidden" }}>
        {/* Warm Champagne Candlelight Center Halo behind E1 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 452,
            width: 440,
            height: 440,
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle at 50% 48%, rgba(255, 232, 198, 0.40) 0%, rgba(255, 214, 228, 0.16) 40%, rgba(20, 48, 196, 0) 72%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Centripetal Screen-01 Depth-of-Field 5-Petal Sakura Blossoms (Zero Circle Bokeh) */}
        <svg viewBox="0 0 390 844" style={{ position: "absolute", inset: 0, width: 390, height: 844, pointerEvents: "none", zIndex: 4 }}>
          {SAKURA_ITEMS.map((s, idx) => (
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
          ))}
        </svg>

        {/* E1 Realistic Fine-Line Open-Pocket Envelope + Sliding Cotton Paper Letter */}
        <div
          role="button"
          tabIndex={0}
          aria-label="轻触展开你的信"
          onClick={() => setZoomOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setZoomOpen(true);
            }
          }}
          style={{
            position: "absolute",
            left: 55,
            top: 264,
            width: 280,
            height: 332,
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          {/* Back Open Pocket */}
          <img
            data-src={`${BASE_PATH}/assets/envelope-back@2x.webp`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: 0,
              top: 30,
              width: 280,
              height: 302,
              objectFit: "contain",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {/* Emerging Cotton Paper Letter Sheet / Real Letter Photo */}
          <div
            style={{
              position: "absolute",
              left: 29,
              top: 106,
              width: 222,
              height: 196,
              borderRadius: 2,
              background: "linear-gradient(170deg, #FCF8EE 0%, #F4EBD7 100%)",
              boxShadow: "0 8px 22px rgba(8, 16, 70, 0.28), inset 0 0 0 0.5px rgba(255, 255, 255, 0.85)",
              overflow: "hidden",
              zIndex: 2,
              transform: entered ? "translateY(-64px)" : "translateY(28px)",
              transition: "transform 1.15s cubic-bezier(0.22, 0.61, 0.36, 1) 0.15s",
            }}
          >
            {PHOTOS.letter ? (
              <Photo src={PHOTOS.letter} label="" />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "16px 16px 14px",
                  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 24px, rgba(16, 37, 158, 0.08) 24px 25px)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--latin)", fontStyle: "italic", fontWeight: 700, fontSize: 11.5, color: "#10259E" }}>
                    From You,
                  </span>
                  <span style={{ fontFamily: "var(--geo)", fontSize: 8.5, letterSpacing: "0.14em", color: "rgba(16, 37, 158, 0.5)" }}>
                    手写信原图位
                  </span>
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 11.5, lineHeight: "24px", color: "rgba(32, 42, 92, 0.78)" }}>
                  留给你的手写信真迹，
                  <br />
                  轻触即可展开细读。
                </div>
                <span style={{ fontFamily: "var(--zhimang)", fontSize: 16, color: "#10259E", alignSelf: "flex-end" }}>
                  陈玺羽
                </span>
              </div>
            )}
          </div>

          {/* Front Translucent V-Flap Cutout */}
          <img
            data-src={`${BASE_PATH}/assets/envelope-front@2x.webp`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: 0,
              top: 30,
              width: 280,
              height: 302,
              objectFit: "contain",
              pointerEvents: "none",
              zIndex: 3,
            }}
          />
        </div>

        {/* Tilted Editorial Header (-8deg) */}
        <div
          className="ep-ang"
          style={{
            left: 24,
            top: 52,
            transform: "rotate(-8deg)",
            zIndex: 15,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.08s",
          }}
        >
          <span className="l ss-it" style={{ fontSize: 15.5, color: "#FFD6E4", letterSpacing: "0.02em" }}>
            {t.enTop}
          </span>
          <span className="l" style={{ marginTop: 2, lineHeight: "36px" }}>
            <span className="ep-display">{t.zhTitle}</span>
            <span className="ss-it" style={{ fontSize: 17, color: "#CFD8FF", marginLeft: 8 }}>{t.enTail}</span>
          </span>
          <span className="l ep-sub" style={{ marginLeft: 4, marginTop: 7 }}>{t.sub1}</span>
          <span className="l ep-sub" style={{ marginLeft: 10 }}>{t.sub2}</span>
        </div>

        {/* Bottom Zhi Mang Xing Signature Couplet */}
        <div
          className="ep-ang"
          style={{
            left: "50%",
            top: Y(668, -0.5),
            transform: "translateX(-50%) rotate(-5deg)",
            zIndex: 15,
            textAlign: "center",
            opacity: entered ? 1 : 0,
            transition: "opacity 0.85s ease 0.25s",
          }}
        >
          <span style={{ fontFamily: "var(--zhimang)", fontSize: 22, color: "#F6DEC2", letterSpacing: "0.06em" }}>
            {t.couplet}
          </span>
        </div>

        {/* Bottom Whisper */}
        <p
          className="tilt-center-tight ep-note"
          role="button"
          tabIndex={0}
          aria-label="继续前往下一页"
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onNext?.();
            }
          }}
          style={{
            top: YB(764, -1, 36),
            zIndex: 20,
            padding: "8px 16px",
            cursor: "pointer",
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.35s",
          }}
        >
          {t.hint}
        </p>
      </div>
    </Screen>
  );
}
