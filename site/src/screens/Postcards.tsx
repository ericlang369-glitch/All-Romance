"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, PHOTOS, TEXT } from "@/config";
import { loadImgs } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const B = `${BASE_PATH}/assets/birds/`;
const P = `${BASE_PATH}/photos/`;

export function Postcards({
  register,
  index,
  total,
  modal,
  onNext,
}: ScreenProps & { modal: (on: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<0 | 1 | null>(null);

  useEffect(() => {
    register({
      enter: () => setEntered(true),
    });
  }, [register]);

  useEffect(() => {
    if (root.current) loadImgs(root.current);
  }, []);

  useEffect(() => {
    modal(lightboxIdx !== null);
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      else if (e.key === "ArrowLeft") setLightboxIdx(0);
      else if (e.key === "ArrowRight") setLightboxIdx(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, modal]);

  const t = TEXT.postcards;
  const cards = [
    { key: "p1", src: `${P}${PHOTOS.p1}`, label: "01 北京 · 南锣鼓巷", alt: "南锣鼓巷寄出的明信片 1:1 复刻" },
    { key: "p2", src: `${P}${PHOTOS.p2}`, label: "02 上海 · 19M工坊", alt: "上海 19M 工坊寄出的明信片 1:1 复刻" },
  ] as const;

  return (
    <Screen
      id="postcards"
      index={index}
      total={total}
      scaledStage
      overlay={
        lightboxIdx !== null ? (
          <div
            className="ep-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="明信片放大细读"
            onClick={() => setLightboxIdx(null)}
          >
            <button
              type="button"
              className="ep-close-btn"
              aria-label="关闭明信片大图"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx(null);
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              <img
                src={cards[lightboxIdx].src}
                alt={cards[lightboxIdx].alt}
                style={{
                  width: 358,
                  height: 239,
                  objectFit: "cover",
                  borderRadius: 3,
                  boxShadow: "0 24px 56px rgba(2, 6, 36, 0.78), 0 0 0 1px rgba(255, 255, 255, 0.14)",
                }}
              />

              {/* Dual-card switch pill */}
              <div
                style={{
                  display: "inline-flex",
                  padding: 3,
                  borderRadius: 999,
                  background: "rgba(18, 34, 120, 0.72)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  gap: 4,
                }}
              >
                {cards.map((c, idx) => {
                  const active = lightboxIdx === idx;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setLightboxIdx(idx as 0 | 1)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: 0,
                        cursor: "pointer",
                        fontFamily: "var(--sans)",
                        fontSize: 11,
                        fontWeight: active ? 600 : 500,
                        letterSpacing: "0.06em",
                        background: active ? "rgba(240, 194, 136, 0.92)" : "transparent",
                        color: active ? "#0F228C" : "rgba(255, 255, 255, 0.80)",
                        transition: "background 0.25s ease, color 0.25s ease",
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null
      }
    >
      <div ref={root} style={{ position: "relative", width: 390, height: 844, overflow: "hidden" }}>
        {/* Atmospheric mist-silver echo birds in open right margin (directly on pure #1430C4, zero blobs) */}
        <img
          data-src={`${B}s05-echo-birds@2x.webp`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: 278,
            top: 320,
            width: 112,
            height: 112,
            pointerEvents: "none",
            zIndex: 4,
            opacity: entered ? 0.92 : 0,
            transition: "opacity 1s ease 0.25s",
          }}
        />

        {/* Tilted Editorial Header (-7deg, #6CCBF7 x #F0C288) */}
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
          <span className="l"><span className="ep-display">{t.zhTitle}</span></span>
          <span className="l" style={{ marginLeft: 32, marginTop: 2, lineHeight: "22px" }}>
            <span className="ss-it" style={{ fontSize: 19, color: "#6CCBF7" }}>{t.enLeft}</span>
            <span className="geo-caps" style={{ fontSize: 16, marginLeft: 5, color: "#F0C288" }}>{t.enRight}</span>
          </span>
          <span
            className="l ep-sub"
            style={{ marginLeft: 6, marginTop: 6, color: "rgba(240, 194, 136, 0.90)", letterSpacing: "0.06em" }}
          >
            {t.routeCaption}
          </span>
        </div>

        {/* Restored Postcard 1: Beijing Nanluoguxiang (clean upper-left placement, zero overlap) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="放大查看北京南锣鼓巷明信片"
          onClick={() => setLightboxIdx(0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLightboxIdx(0);
            }
          }}
          style={{
            position: "absolute",
            left: 24,
            top: 202,
            width: 248,
            height: 165.3,
            borderRadius: 2,
            boxShadow: "0 14px 32px rgba(4, 10, 64, 0.56)",
            transform: entered ? "rotate(-2.2deg) translateY(0)" : "rotate(-2.2deg) translateY(16px)",
            opacity: entered ? 1 : 0,
            transition: "transform 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) 0.12s, opacity 0.85s ease 0.12s",
            cursor: "pointer",
            overflow: "hidden",
            zIndex: 8,
          }}
        >
          <img
            data-src={`${P}${PHOTOS.p1}`}
            alt={cards[0].alt}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {/* Restored Postcard 2: Shanghai 19M Upright (open lower-right placement, leaves room for escort birds) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="放大查看上海19M明信片"
          onClick={() => setLightboxIdx(1)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLightboxIdx(1);
            }
          }}
          style={{
            position: "absolute",
            left: 118,
            top: 438,
            width: 248,
            height: 165.3,
            borderRadius: 2,
            boxShadow: "0 16px 34px rgba(4, 10, 64, 0.58)",
            transform: entered ? "rotate(2deg) translateY(0)" : "rotate(2deg) translateY(18px)",
            opacity: entered ? 1 : 0,
            transition: "transform 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) 0.22s, opacity 0.85s ease 0.22s",
            cursor: "pointer",
            overflow: "hidden",
            zIndex: 9,
          }}
        >
          <img
            data-src={`${P}${PHOTOS.p2}`}
            alt={cards[1].alt}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
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
            top: 786,
            zIndex: 20,
            padding: "6px 14px",
            cursor: "pointer",
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.35s",
          }}
        >
          <span>{t.notePrefix}</span>
          <span style={{ color: "#F0C288" }}>{t.noteHighlight}</span>
        </p>
      </div>
    </Screen>
  );
}
