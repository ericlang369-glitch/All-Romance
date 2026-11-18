"use client";
import { useEffect, useRef } from "react";
import { createOpening } from "@/lib/opening";
import { $, $$, Y, YB } from "@/lib/kit";
import { TEXT } from "@/config";
import { Screen, type ScreenProps } from "./common";

/** 底部流光垂线锚点：top 718 − 0.58·D（避让微信底部栏与安全区） */
const HINT_TOP = YB(718, -0.58, 36);

export default function Opening({
  register,
  onUnlock,
  onNext,
  index,
  total,
}: ScreenProps & { onUnlock: () => void; onNext: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = root.current!;
    const tap = $<HTMLButtonElement>(r, ".hintTap");
    const o = createOpening(
      {
        root: r, tree: art.current!, row: $(r, "#row"), burst: $(r, "#burst"), again: $(r, "#again"),
        input: $<HTMLInputElement>(r, "#passInput"), passLines: $$(r, "#passGrp .l"), titleLines: $$(r, "#title .grp .l"),
        hintLine: $(r, "#hintLine"), hintStreak: $(r, "#hintStreak"), canvas: $<HTMLCanvasElement>(r, "#gust"),
      },
      {
        onUnlock: () => {
          // S1：「向下」按钮解锁后才能点、才进 Tab 顺序
          tap.disabled = false;
          tap.tabIndex = 0;
          onUnlock();
        },
      },
    );
    register({ enter: () => {}, setActive: o.setActive });
    // 密码阶段轻触屏幕任意处都把焦点给输入框（弹出数字键盘）
    const focus = () => { if (!o.unlocked) $<HTMLInputElement>(r, "#passInput").focus(); };
    const sec = r.closest("section")!;
    sec.addEventListener("click", focus);
    // 按钮的 disabled 由这里直接改 DOM，所以点击也用原生监听（React 的 onClick 会按初始 props 一直当它是 disabled）
    const handleNext = () => onNext();
    tap.addEventListener("click", handleNext);
    return () => {
      sec.removeEventListener("click", focus);
      tap.removeEventListener("click", handleNext);
    };
  }, []);
  return (
    <Screen id="s-opening" index={index} total={total} art={<div id="tree" ref={art} />}>
      <div ref={root} className="full">
        <div id="pass">
          <div className="grp" id="passGrp" style={{ left: 104, top: Y(340) }}>
            <span className="l sub">我们开始的</span>
            <span className="l display" style={{ marginLeft: 36, fontSize: 36, lineHeight: "40px" }}>那一天</span>
          </div>
          <div id="row" />
          <div id="burst" />
          <p className="tilt note" id="again" style={{ top: Y(474) }}>再想想</p>
          <input id="passInput" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" aria-label="我们开始的那一天（4 位数字）" />
        </div>
        <div id="title">
          <div className="grp" style={{ left: 66, top: Y(332, -0.34) }}>
            <span className="l" style={{ lineHeight: "26px" }}>
              <span className="ss-it" style={{ fontSize: 20, color: "#6CCBF7" }}>Dear</span>
              <span className="geo-caps" style={{ fontSize: 19, marginLeft: 7, color: "#F0C288" }}>{TEXT.opening.enName}</span>
            </span>
            <span className="l" style={{ marginLeft: 24, marginTop: 2, lineHeight: "40px" }}>
              <span className="ep-display" style={{ fontSize: 34 }}>{TEXT.opening.zhName}</span>
              <span className="ep-sub" style={{ marginLeft: 10, color: "#F0C288", fontWeight: 600, fontSize: 12.5 }}>{TEXT.opening.dayTag}</span>
            </span>
            {TEXT.opening.lines.map((line, i) => (
              <span
                key={i}
                className="l ep-sub"
                style={{ marginLeft: 4 + i * 6, marginTop: i === 0 ? 12 : 2 }}
              >
                {line}
              </span>
            ))}
          </div>
          <div
            id="hintLine"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 194.5,
              top: `calc(${HINT_TOP} + 4px)`,
              width: 1,
              height: 44,
              overflow: "hidden",
              pointerEvents: "none",
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.24) 22%, rgba(255,255,255,0.24) 78%, rgba(255,255,255,0) 100%)",
            }}
          >
            <div
              id="hintStreak"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 1,
                height: 18,
                opacity: 0,
                transform: "translateY(-18px)",
                background:
                  "linear-gradient(to bottom, rgba(246,222,194,0) 0%, rgba(255,255,255,0.95) 65%, rgba(246,222,194,0) 100%)",
              }}
            />
          </div>
          <button
            type="button"
            className="hintTap"
            aria-label="向下翻页"
            disabled
            tabIndex={-1}
            style={{
              left: 115,
              top: `calc(${HINT_TOP} - 16px)`,
              width: 160,
              height: 88,
            }}
          />
        </div>
        <canvas id="gust" />
      </div>
    </Screen>
  );
}
