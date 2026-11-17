"use client";
import { useEffect, useRef, useState } from "react";
import { ASSET_BASE, TEXT } from "@/config";
import { createButterfly } from "@/lib/butterfly";
import { $, $$, E, after, env, loadImgs, slideLines, tween } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const A = `${ASSET_BASE}/assets/`;
/** 对齐 02-C 校准构图：适配 708p 画布净上移 62px 并等比缩放 0.89，相框落在 y=120..630.3，蝴蝶停落中心 (253.7, 345.2) */
const FRAME_T = {
  transform: "translateY(-20px) scale(0.89)",
  transformOrigin: "195px 140px",
} as const;

const MASK_WRAP_STYLE = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 390,
  height: 708,
  pointerEvents: "none",
  zIndex: 2,
  opacity: 0,
  WebkitMaskImage: "radial-gradient(circle at 261px 373px, transparent 0px, transparent 1px)",
  maskImage: "radial-gradient(circle at 261px 373px, transparent 0px, transparent 1px)",
} as const;

type Ripple = { id: number; x: number; y: number };
type Mote = { id: number; x: number; y: number; size: number; mx: string; my: string };

/** 02 那束花：02-C 实拍校准彩墨点染扩散 + 青凤蝶停落微澜交互 */
export default function Flower({ register, index, total, onNext }: ScreenProps) {
  const maskWrapRef = useRef<HTMLDivElement>(null);
  const bfRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const [settled, setSettled] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [motes, setMotes] = useState<Mote[]>([]);
  const [tappedOnce, setTappedOnce] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    let dead = false;
    let stopDiff: (() => void) | undefined;
    const r = root.current!, bfg = bfRef.current!;
    const b = createButterfly($(bfg, ".bf"), $$(bfg, ".bf .w"), $(bfg, ".trail"));

    const applyMask = (rad: number, mistOp: number) => {
      const el = maskWrapRef.current;
      if (!el) return;
      const grad =
        rad <= 0.1
          ? "radial-gradient(circle at 261px 373px, transparent 0px, transparent 1px)"
          : `radial-gradient(circle at 261px 373px, #000 0px, #000 ${(rad * 0.56).toFixed(1)}px, rgba(0,0,0,0.45) ${(rad * 0.8).toFixed(1)}px, transparent ${rad.toFixed(1)}px)`;
      el.style.webkitMaskImage = grad;
      el.style.maskImage = grad;
      el.style.opacity = mistOp.toFixed(3);
    };

    register({
      enter: () => {
        if (enteredRef.current) return;
        enteredRef.current = true;
        slideLines($$(r, ".grp .l"));
        Promise.all([loadImgs(r), b.ready()]).then(() => {
          if (dead) return;
          after(200, () => {
            if (dead) return;
            b.fly();
            if (env.rm) {
              applyMask(540, 1);
              setSettled(true);
            } else {
              after(2150, () => {
                if (dead) return;
                let settledSet = false;
                stopDiff = tween({
                  dur: 3800,
                  delay: 350,
                  ease: E.inout,
                  on: (k, p) => {
                    if (dead) return;
                    const rad = 540 * k;
                    const mistOp = Math.min(1, (p * 3800) / 900);
                    applyMask(rad, mistOp);
                    if (!settledSet && p * 3800 >= 450) {
                      settledSet = true;
                      setSettled(true);
                    }
                  },
                  done: () => {
                    if (dead) return;
                    applyMask(540, 1);
                    if (!settledSet) setSettled(true);
                  },
                });
              });
            }
          });
        });
      },
    });
    return () => {
      dead = true;
      stopDiff?.();
    };
  }, [register]);

  const spawnInteractive = () => {
    // 凤蝶中心在 02-C 校准坐标系为 (261, 373)，在 FRAME_T(-20px) 内等价 (261, 393)
    const cx = 261;
    const cy = 393;
    setTappedOnce(true);
    const id = nextId.current++;
    setRipples((prev) => [...prev.slice(-3), { id, x: cx, y: cy }]);
    const newMotes: Mote[] = [
      { id: nextId.current++, x: cx, y: cy, size: 4.5, mx: "-45px", my: "-39px" },
      { id: nextId.current++, x: cx, y: cy, size: 4, mx: "44px", my: "-35px" },
      { id: nextId.current++, x: cx, y: cy, size: 3.8, mx: "27px", my: "45px" },
      { id: nextId.current++, x: cx, y: cy, size: 4.8, mx: "-31px", my: "37px" },
      { id: nextId.current++, x: cx, y: cy, size: 3.6, mx: "-5px", my: "-67px" },
    ];
    setMotes((prev) => [...prev.slice(-10), ...newMotes]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((item) => item.id !== id));
      setMotes((prev) => prev.filter((m) => !newMotes.some((nm) => nm.id === m.id)));
      setTappedOnce(false);
    }, 1550);
  };

  const t = TEXT.flower;

  return (
    <Screen id="s-flower" index={index} total={total} scaledStage>
      <div ref={root} className="full">
        {/* 暗夜群青白线相框底（首帧立即可见，绝不依赖懒加载） */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, ...FRAME_T }}>
          <img
            src={`${A}framed-bg@3x.webp`}
            alt=""
            decoding="sync"
            draggable={false}
            style={{ position: "absolute", left: -20, top: 140, width: 430.1, height: 573.4 }}
          />
        </div>

        {/* 外层 390x708 缩放(0.89)与左右边缘 18px 羽化 + 中层 3.8s 扩散径向遮罩 + 内层 02-C 晨雾水彩轮廓遮罩 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 390,
            height: 708,
            transform: "scale(0.89)",
            transformOrigin: "195px 120px",
            pointerEvents: "none",
            zIndex: 2,
            WebkitMaskImage: "linear-gradient(90deg, transparent 0px, #000 18px, #000 372px, transparent 390px)",
            maskImage: "linear-gradient(90deg, transparent 0px, #000 18px, #000 372px, transparent 390px)",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        >
          <div ref={maskWrapRef} style={MASK_WRAP_STYLE}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                WebkitMaskImage: `url(${A}flower-mask-02c.webp)`,
                maskImage: `url(${A}flower-mask-02c.webp)`,
                WebkitMaskPosition: "0px -62px",
                maskPosition: "0px -62px",
                WebkitMaskSize: "390px 844px",
                maskSize: "390px 844px",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
              }}
            >
              {/* 可见晨雾暖香槟光晕衬底 */}
              <img
                data-src={`${A}flower-mask-02c.webp`}
                alt=""
                draggable={false}
                style={{ position: "absolute", left: 0, top: -62, width: 390, height: 844 }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle 145px at 261px 373px, rgba(255,255,255,0.34) 0%, transparent 72%)",
                }}
              />
              <img
                data-src={`${A}framed-colored-real@3x.webp`}
                alt=""
                draggable={false}
                style={{ position: "absolute", left: -20, top: 120, width: 430.1, height: 573.4 }}
              />
              <img
                data-src={`${A}butterfly-colored-real@3x.webp`}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: 102,
                  top: 222.5,
                  width: 270,
                  height: 262,
                  filter: "drop-shadow(0 6px 14px rgba(10,36,80,0.22))",
                }}
              />
            </div>
          </div>
        </div>

        {/* 白描蝴蝶飞入、光点拖尾与轻触水波微澜层 */}
        <div ref={bfRef} className="full" style={{ pointerEvents: "none", zIndex: 4, ...FRAME_T }}>
          <div className="trail" style={{ opacity: settled ? 0.25 : 1, transition: "opacity 0.8s ease" }} />
          {/* 用外层 wrapper 隐藏停稳后的白描蝴蝶，避开 butterfly.ts finish() 强制重写 .bf opacity=1 */}
          <div style={{ position: "absolute", inset: 0, opacity: settled ? 0 : 1, transition: "opacity 0.65s ease", pointerEvents: "none" }}>
            <div className="bf">
              <img className="w" data-src={`${A}butterfly-wing-left@3x.webp`} alt="" />
              <img className="w" data-src={`${A}butterfly-wing-right@3x.webp`} alt="" />
              <img data-src={`${A}butterfly-body@3x.webp`} alt="" />
            </div>
          </div>

          {ripples.map((rp) => (
            <div key={rp.id} style={{ position: "absolute", left: rp.x, top: rp.y, pointerEvents: "none", zIndex: 14 }}>
              <span className="ep-ripple" style={{ width: 92, height: 92, border: "1.2px solid rgba(72,206,196,0.62)" }} />
              <span className="ep-ripple" style={{ width: 144, height: 144, border: "1px solid rgba(142,216,242,0.44)", animationDelay: "120ms" }} />
              <span className="ep-ripple" style={{ width: 204, height: 204, border: "1px dashed rgba(255,255,255,0.44)", animationDelay: "220ms" }} />
            </div>
          ))}
          {motes.map((m, i) => {
            const colors = ["#52C5BE", "#84D0D8", "#FFFFFF", "#A69ECE", "#F5E5C4"];
            const col = colors[i % colors.length];
            return (
              <span
                key={m.id}
                className="bf-mote"
                style={
                  {
                    left: m.x,
                    top: m.y,
                    width: m.size,
                    height: m.size,
                    background: `radial-gradient(circle, ${col} 0%, ${col} 65%, transparent 100%)`,
                    "--mx": m.mx,
                    "--my": m.my,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>

        {/* 单行标题撞色 + 两行副标题 (-7deg) */}
        <div className="grp" style={{ left: 22, top: 26, zIndex: 15 }}>
          <span className="l pre" style={{ lineHeight: "38px", whiteSpace: "nowrap" }}>
            <span
              style={{
                fontFamily: "var(--serif)",
                fontWeight: 700,
                fontSize: 35,
                lineHeight: "38px",
                letterSpacing: "0.06em",
                color: "#FFFFFF",
              }}
            >
              {t.zhTitle}
            </span>
            <span className="ss-it" style={{ fontSize: 21, color: "#CFD8FF", marginLeft: 8 }}>{t.enLeft}</span>
            <span className="geo-caps" style={{ fontSize: 19, marginLeft: 4, color: "#FFD6E4" }}>{t.enRight}</span>
          </span>
          <span
            className="l pre"
            style={{
              marginLeft: 10,
              marginTop: 8,
              fontFamily: "var(--sans)",
              fontWeight: 500,
              fontSize: 11.8,
              lineHeight: "19px",
              letterSpacing: "0.035em",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            {t.sub1}
          </span>
          <span
            className="l pre"
            style={{
              marginLeft: 20,
              fontFamily: "var(--sans)",
              fontWeight: 500,
              fontSize: 11.8,
              lineHeight: "19px",
              letterSpacing: "0.035em",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            {t.sub2}
          </span>
        </div>

        {/* 青凤蝶停留位置交互热区 (中心 253.7, 345.2) */}
        <button
          type="button"
          aria-label="轻触青凤蝶泛起微澜"
          onClick={spawnInteractive}
          style={{
            position: "absolute",
            left: 183,
            top: 270,
            width: 142,
            height: 150,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            zIndex: 18,
          }}
        />
      </div>
    </Screen>
  );
}
