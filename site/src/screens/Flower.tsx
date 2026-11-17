"use client";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, TEXT } from "@/config";
import { createButterfly } from "@/lib/butterfly";
import { $, $$, XT, YB, YT, after, env, loadImgs, slideLines } from "@/lib/kit";
import { Screen, type ScreenProps } from "./common";

const A = `${BASE_PATH}/assets/`;
/** 对齐 02-C 校准构图：相框上沿落在 y=182（较初版下移 42px），蝴蝶停落中心 (261, 435) */
const FRAME_T = {
  transformOrigin: "195.05px 182px",
  transform: "translateY(calc(42px + var(--o) - var(--t))) scale(var(--fs))",
} as const;

type Ripple = { id: number; x: number; y: number };
type Mote = { id: number; x: number; y: number; size: number; mx: string; my: string };

/** 02 那束花：02-C 实拍校准彩墨点染扩散 + 青凤蝶停落微澜交互 */
export default function Flower({ register, index, total, onNext }: ScreenProps) {
  const art = useRef<HTMLDivElement>(null);
  const bfRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const [inkPct, setInkPct] = useState(0);
  const [settled, setSettled] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [motes, setMotes] = useState<Mote[]>([]);
  const [tappedOnce, setTappedOnce] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    const r = root.current!, bfg = bfRef.current!;
    const b = createButterfly($(bfg, ".bf"), $$(bfg, ".bf .w"), $(bfg, ".trail"));
    register({
      enter: () => {
        if (enteredRef.current) return;
        enteredRef.current = true;
        slideLines($$(r, ".grp .l"));
        loadImgs(art.current!);
        loadImgs(bfg);
        b.ready().then(() =>
          after(200, () => {
            b.fly();
            if (env.rm) {
              setInkPct(130);
              setSettled(true);
            } else {
              after(2150, () => {
                setInkPct(130);
                setSettled(true);
              });
            }
          }),
        );
      },
    });
  }, [register]);

  const spawnInteractive = () => {
    // 凤蝶中心在 02-C 校准坐标系为 (261, 435)，在 FRAME_T(+42px) 内等价 (261, 393)
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
    <Screen
      id="s-flower"
      index={index}
      total={total}
      art={
        <div ref={art} className="full" style={FRAME_T}>
          {/* 暗夜群青白线相框底 */}
          <img
            data-src={`${A}framed-bg@3x.webp`}
            alt=""
            style={{ position: "absolute", left: -20, top: 140, width: 430.1, height: 573.4 }}
          />
          {/* 02-C 晨雾暖香槟晕染遮罩 + 1:1 实拍水彩校准层 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -42,
              width: 390,
              height: 844,
              pointerEvents: "none",
              clipPath: `circle(${inkPct}% at 261px 435px)`,
              WebkitMaskImage: `url(${A}flower-mask-02c.webp)`,
              maskImage: `url(${A}flower-mask-02c.webp)`,
              WebkitMaskSize: "390px 844px",
              maskSize: "390px 844px",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              transition: "clip-path 1.65s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          >
            {/* 可见晨雾暖香槟光晕衬底 */}
            <img
              data-src={`${A}flower-mask-02c.webp`}
              alt=""
              style={{ position: "absolute", left: 0, top: 0, width: 390, height: 844 }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle 145px at 261px 435px, rgba(255,255,255,0.34) 0%, transparent 72%)",
              }}
            />
            <img
              data-src={`${A}framed-colored-real@3x.webp`}
              alt=""
              style={{ position: "absolute", left: -20, top: 182, width: 430.1, height: 573.4 }}
            />
            <img
              data-src={`${A}butterfly-colored-real@3x.webp`}
              alt=""
              style={{
                position: "absolute",
                left: 102,
                top: 284.5,
                width: 270,
                height: 262,
                filter: "drop-shadow(0 6px 14px rgba(10,36,80,0.22))",
              }}
            />
          </div>
        </div>
      }
      artPlain={
        <div ref={bfRef} className="full" style={FRAME_T}>
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
      }
    >
      <div ref={root} className="full">
        {/* 单行标题撞色 + 两行副标题 (-7deg) */}
        <div className="grp" style={{ left: XT(26), top: YT(54, 18) }}>
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

        {/* 青凤蝶停留位置交互热区 (中心 261, 435) */}
        <button
          type="button"
          aria-label="轻触青凤蝶泛起微澜"
          onClick={spawnInteractive}
          style={{
            position: "absolute",
            left: 190,
            top: 360,
            width: 142,
            height: 150,
            background: "transparent",
            border: 0,
            cursor: "pointer",
            zIndex: 18,
          }}
        />

        <p
          className="tilt-center-tight"
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
            fontFamily: "var(--sans)",
            fontWeight: 500,
            fontSize: 12,
            lineHeight: "20px",
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.72)",
            opacity: settled ? 1 : 0.78,
            transition: "opacity 0.6s ease",
          }}
        >
          {tappedOnce ? "指尖轻触 · 凤蝶再泛青碧微澜" : `${t.notePrefix}${t.noteHighlight}`}
        </p>
      </div>
    </Screen>
  );
}
