import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BASE_PATH } from "@/config";

export type ScreenCtl = { enter: () => void; setActive?: (on: boolean) => void };
export type ScreenProps = { register: (ctl: ScreenCtl) => void; index?: number; total?: number; onNext?: () => void };

export function Hud({ index, total, tone = "light", className = "" }: { index: number; total: number; tone?: "light" | "dark"; className?: string }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={`hud ${tone === "dark" ? "hud-dark" : ""} ${className}`.trim()} aria-hidden="true">
      <span className="hud-date">0825 — 1203</span>
      <span className="hud-idx">{pad(index)} / {pad(total)}</span>
    </div>
  );
}

/** 共享天空：把这一屏的底色/光晕送进 Site 里的 #sky-{index} 槽位，由 Site 按滚动进度做视差 + 溶解，屏与屏之间不再有切边 */
function SkyPortal({ index, children }: { index?: number; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (index) setHost(document.getElementById(`sky-${index}`));
  }, [index]);
  return host ? createPortal(children, host) : null;
}

/**
 * 一屏（spec §6）：
 * - .shift 做屏间斜推的横移（plan §3b）；整屏 overflow:hidden，上一屏的出血画不进下一屏（G2）。
 * - .stage 是 390 宽的设计坐标，放在列中间（x' = colL + x + dx），不缩放；竖直方向各元素自己按 y + a·D + o 排。
 * - art：带出血的插图（树、02 相框），放在列容器里；宽屏时列边 48px 羽化淡出（§6.3）。artPlain 同列容器但不羽化。
 * - sky：整屏背景（底色、光晕、丝带），不跟屏走，进共享天空层。
 */
export function Screen({
  id,
  children,
  overlay,
  bg,
  sky,
  art,
  artPlain,
  index,
  total,
  showHud = false,
  hudTone = "light",
  scaledStage = false,
}: {
  id: string;
  children: ReactNode;
  overlay?: ReactNode;
  bg?: ReactNode;
  sky?: ReactNode;
  art?: ReactNode;
  artPlain?: ReactNode;
  index?: number;
  total?: number;
  showHud?: boolean;
  hudTone?: "light" | "dark";
  scaledStage?: boolean;
}) {
  void total;
  void showHud;
  void hudTone;
  const stageContent = children;
  return (
    <section className="screen" id={id}>
      {sky && <SkyPortal index={index}>{sky}</SkyPortal>}
      <div className="shift">
        {bg}
        {art && <div className="col feather"><div className="cs">{art}</div></div>}
        {artPlain && <div className="col"><div className="cs">{artPlain}</div></div>}
        <div className="stage">
          {scaledStage ? <div className="design-canvas">{stageContent}</div> : stageContent}
        </div>
        {overlay}
      </div>
    </section>
  );
}

/** 占位框 / 真图：src 为 null 时显示虚线框和文字。真图按屏加载（data-src，G6） */
export function Photo({ src, label }: { src: string | null; label: string }) {
  return src ? <img className="photo" data-src={`${BASE_PATH}/photos/${src}`} alt="" draggable={false} /> : <span>{label}</span>;
}
