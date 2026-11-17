"use client";
import { useEffect, useRef } from "react";
import { createOpening } from "@/lib/opening";
import { $, $$, Y, YB } from "@/lib/kit";
import { TEXT } from "@/config";
import { Screen, type ScreenProps } from "./common";

/** 「轻触 · 向下」：top 718 − D（避让微信底部栏，§6.2），离底边 ≥ safe-bottom + 44 */
const HINT_TOP = YB(718, -1, 36);

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
        root: r, tree: art.current!, calm: $(r, "#calm"), row: $(r, "#row"), burst: $(r, "#burst"), again: $(r, "#again"),
        input: $<HTMLInputElement>(r, "#passInput"), passLines: $$(r, "#passGrp .l"), titleLines: $$(r, "#title .grp .l"),
        hintTxt: $(r, "#hintTxt"), hintLine: $(r, "#hintLine"), canvas: $<HTMLCanvasElement>(r, "#gust"),
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
    tap.addEventListener("click", () => onNext());
    return () => sec.removeEventListener("click", focus);
  }, []);
  return (
    <Screen id="s-opening" index={index} total={total} art={<div id="tree" ref={art} />}>
      <div ref={root} className="full">
        <div id="calm" />
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
          <div className="grp" style={{ left: 36, top: Y(366) }}>
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
          <p className="tilt note" id="hintTxt" style={{ top: HINT_TOP }}>{TEXT.opening.hint}</p>
          <div id="hintLine" style={{ position: "absolute", left: 194.5, top: `calc(${HINT_TOP} + 34px)`, width: 1, height: 24, background: "var(--line)" }} />
          <button className="hintTap" aria-label="向下" disabled tabIndex={-1} style={{ top: `calc(${HINT_TOP} - 24px)` }} />
        </div>
        <canvas id="gust" />
      </div>
    </Screen>
  );
}
