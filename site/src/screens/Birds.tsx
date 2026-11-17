"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, TEXT } from "@/config";
import { loadImgs } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const B = `${BASE_PATH}/assets/birds/`;

type Ripple = { id: number; x: number; y: number };

export function Birds({ register, index, total }: ScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    register({
      enter: () => setEntered(true),
    });
  }, [register]);

  useEffect(() => {
    if (root.current) loadImgs(root.current);
  }, []);

  const spawnRipple = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / (rect.width || 390)) * 390;
    const y = ((e.clientY - rect.top) / (rect.height || 844)) * 844;
    const id = nextId.current++;
    setRipples((prev) => [...prev.slice(-4), { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1400);
  };

  const t = TEXT.birds;

  return (
    <Screen id="birds" index={index} total={total}>
      <div
        ref={root}
        onPointerDown={spawnRipple}
        style={{ position: "relative", width: 390, height: 844, overflow: "hidden", cursor: "pointer" }}
      >
        {/* R1 Translucent Silk Organza Wind-Ribbon + Far Mist-Ink Birds */}
        <img
          data-src={`${B}s04-r1-ribbon-bg@2x.png`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: 390,
            height: 844,
            objectFit: "cover",
            pointerEvents: "none",
            opacity: entered ? 1 : 0,
            transition: "opacity 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        />

        {/* 3-Frame GPU Stop-Motion Lesage Embroidery Wingbeat Flock */}
        {[1, 2, 3].map((f) => (
          <img
            key={f}
            className={`bird-sprite-f${f}`}
            data-src={`${B}s04-r1-flock-f${f}@2x.png`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: 390,
              height: 844,
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Interactive Pearl Wind-Ripples on Tap */}
        {ripples.map((r) => (
          <div key={r.id} style={{ position: "absolute", left: r.x, top: r.y, pointerEvents: "none", zIndex: 12 }}>
            <span
              className="ep-ripple"
              style={{
                width: 84,
                height: 84,
                border: "1px solid rgba(108, 203, 247, 0.62)",
              }}
            />
            <span
              className="ep-ripple"
              style={{
                width: 52,
                height: 52,
                border: "1px solid rgba(240, 194, 136, 0.56)",
                animationDelay: "120ms",
              }}
            />
          </div>
        ))}

        {/* Tilted Editorial Header (-7deg, #6CCBF7 x #F0C288) */}
        <div
          className="ep-ang"
          style={{
            left: 24,
            top: 46,
            transform: "rotate(-7deg)",
            zIndex: 15,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) 0.1s",
          }}
        >
          <span className="l"><span className="ep-display">{t.zhTitle}</span></span>
          <span className="l" style={{ marginLeft: 34, marginTop: 2, lineHeight: "22px" }}>
            <span className="ss-it" style={{ fontSize: 19, color: "#6CCBF7" }}>{t.enLeft}</span>
            <span className="geo-caps" style={{ fontSize: 16, marginLeft: 5, color: "#F0C288" }}>{t.enRight}</span>
          </span>
          <span className="l ep-sub" style={{ marginLeft: 4, marginTop: 6 }}>{t.sub1}</span>
          <span className="l ep-sub" style={{ marginLeft: 10 }}>
            {t.sub2Prefix}<span style={{ color: "#6CCBF7", fontWeight: 600 }}>{t.sub2Ice}</span>{t.sub2Mid}<span style={{ color: "#F0C288", fontWeight: 600 }}>{t.sub2Gold}</span>{t.sub2End}
          </span>
          <span className="l ep-sub" style={{ marginLeft: 16 }}>
            {t.sub3Prefix}<span style={{ color: "#F0C288", fontWeight: 600 }}>{t.sub3Gold}</span>{t.sub3End}
          </span>
        </div>

        {/* Bottom Whisper */}
        <p
          className="tilt-center-tight ep-note"
          style={{
            top: 786,
            zIndex: 15,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.35s",
          }}
        >
          <span>{t.notePrefix}</span>
          <span style={{ color: "#6CCBF7" }}>{t.noteIce}</span>
          <span>{t.noteMid}</span>
          <span style={{ color: "#F0C288" }}>{t.noteGold}</span>
        </p>
      </div>
    </Screen>
  );
}
