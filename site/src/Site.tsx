"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_PATH, CAMERA_LEVEL, SHOW_LETTER } from "@/config";
import { E, L, clamp, commitTier, computeLayout, env, frameStats, isVirtual, lerp, loadImgs, pokeMonitor, tween } from "@/lib/kit";
import type { ScreenCtl } from "@/screens/common";
import Opening from "@/screens/Opening";
import Flower from "@/screens/Flower";
import { Letter } from "@/screens/Letter";
import { Birds } from "@/screens/Birds";
import { Postcards } from "@/screens/Postcards";
import { Photos } from "@/screens/Photos";
import { Ending } from "@/screens/Ending";

const TAN7 = Math.tan((7 * Math.PI) / 180);
const CAM = { 1: { rot: -1.2, zoom: 0.022 }, 2: { rot: -2.6, zoom: 0.04 } }; // plan §3c：F1 / F2
const SCREENS = ["opening", "flower", ...(SHOW_LETTER ? ["letter"] : []), "birds", "postcards", "photos", "ending"] as const;
const BIRDS_IDX = SCREENS.indexOf("birds");
const POSTCARDS_IDX = SCREENS.indexOf("postcards");
const B_DIR = `${BASE_PATH}/assets/birds/`;

function EscortBirdsOverlay({
  scrollerRef,
  modalOpen,
}: {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  modalOpen: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const blueRef = useRef<HTMLDivElement>(null);
  const amberRef = useRef<HTMLDivElement>(null);
  const [flapping, setFlapping] = useState(false);
  const flapRef = useRef(false);

  const syncPosition = useCallback(() => {
    const sc = scrollerRef.current;
    const wrap = wrapRef.current;
    if (!sc || !wrap) return;
    const H = L.H || sc.clientHeight || 844;
    const p = sc.scrollTop / H;
    const inBand = p >= BIRDS_IDX - 0.8 && p <= POSTCARDS_IDX + 0.8 && !modalOpen;

    wrap.style.visibility = inBand ? "visible" : "hidden";
    if (!inBand) return;

    const sstep = (e0: number, e1: number, x: number) => {
      const k = clamp((x - e0) / (e1 - e0), 0, 1);
      return k * k * (3 - 2 * k);
    };
    const fadeOp =
      p < BIRDS_IDX - 0.15
        ? sstep(BIRDS_IDX - 0.8, BIRDS_IDX - 0.15, p)
        : p > POSTCARDS_IDX + 0.15
          ? 1 - sstep(POSTCARDS_IDX + 0.15, POSTCARDS_IDX + 0.8, p)
          : 1;
    wrap.style.opacity = fadeOp.toFixed(3);

    const t = clamp(p - BIRDS_IDX, 0, 1);
    const eT = t * t * (3 - 2 * t);
    const arc = Math.sin(eT * Math.PI);

    const isFly = t > 0.04 && t < 0.94;
    if (isFly !== flapRef.current) {
      flapRef.current = isFly;
      setFlapping(isFly);
    }

    const localShift04 = (BIRDS_IDX - p) * H;
    const localShift05 = (POSTCARDS_IDX - p) * H;

    if (blueRef.current) {
      const bx = 168 + (334 - 168) * eT + 26 * arc;
      const by =
        p <= BIRDS_IDX
          ? 642 + localShift04
          : p >= POSTCARDS_IDX
            ? 244 + localShift05
            : lerp(642, 244, eT) - 38 * arc;
      const brot = -22 + 4 * eT - 10 * arc;
      blueRef.current.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) rotate(${brot.toFixed(1)}deg)`;
    }

    if (amberRef.current) {
      const ax = 88 + (58 - 88) * eT - 24 * arc;
      const ay =
        p <= BIRDS_IDX
          ? 676 + localShift04
          : p >= POSTCARDS_IDX
            ? 550 + localShift05
            : lerp(676, 550, eT) + 20 * arc;
      const arot = -26 + 10 * eT - 8 * arc;
      amberRef.current.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) rotate(${arot.toFixed(1)}deg)`;
    }
  }, [scrollerRef, modalOpen]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    syncPosition();
    sc.addEventListener("scroll", syncPosition, { passive: true });
    window.addEventListener("resize", syncPosition);
    window.addEventListener("xiyu-scroll", syncPosition);
    return () => {
      sc.removeEventListener("scroll", syncPosition);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("xiyu-scroll", syncPosition);
    };
  }, [scrollerRef, syncPosition]);

  return (
    <div ref={wrapRef} className="escort-layer" style={{ visibility: "hidden", opacity: 0 }}>
      <div className="col" style={{ overflow: "visible" }}>
        <div className="cs" style={{ overflow: "visible" }}>
          <div ref={blueRef} className="escort-pair-unit" data-flapping={flapping ? "1" : "0"}>
            <img src={`${B_DIR}wake-blue@3x.png`} alt="" draggable={false} style={{ position: "absolute", left: -42, top: 51, width: 100, height: 60 }} />
            <img className="bird-f1" src={`${B_DIR}escort-blue-f1@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f2" src={`${B_DIR}escort-blue-f2@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f3" src={`${B_DIR}escort-blue-f3@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
          </div>
          <div ref={amberRef} className="escort-pair-unit" data-flapping={flapping ? "1" : "0"}>
            <img src={`${B_DIR}wake-amber@3x.png`} alt="" draggable={false} style={{ position: "absolute", left: -42, top: 51, width: 100, height: 60 }} />
            <img className="bird-f1" src={`${B_DIR}escort-amber-f1@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f2" src={`${B_DIR}escort-amber-f2@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f3" src={`${B_DIR}escort-amber-f3@3x.png`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
/** 锁定（密码门、彩蛋展开）时不许滚动的按键（S1） */
const SCROLL_KEYS = new Set([" ", "Spacebar", "PageDown", "PageUp", "End", "Home", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]);

export default function Site() {
  const ctls = useRef<(ScreenCtl | null)[]>(SCREENS.map(() => null));
  const entered = useRef<boolean[]>(SCREENS.map((_, i) => i === 0));
  const scroller = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const lensMain = useRef<HTMLDivElement>(null);
  const state = useRef({ ready: false, unlocked: false, locked: true, lockTop: 0, modal: -1 });
  const regs = useRef(SCREENS.map((_, i) => (c: ScreenCtl) => (ctls.current[i] = c)));

  const sections = () => [...scroller.current!.querySelectorAll<HTMLElement>(":scope > .screen")];
  /** 只让「当前能用」的屏可聚焦、可点：解锁前只有第 1 屏；彩蛋展开时只有彩蛋层（S1、M2） */
  const applyInert = useCallback(() => {
    const st = state.current;
    sections().forEach((s, i) => {
      const off = (!st.unlocked && i > 0) || (st.modal >= 0 && i !== st.modal);
      s.inert = off;
      if (off) s.setAttribute("aria-hidden", "true");
      else s.removeAttribute("aria-hidden");
    });
  }, []);
  const lock = useCallback((on: boolean) => {
    const h = document.documentElement, st = state.current;
    st.locked = on;
    st.lockTop = scroller.current!.scrollTop;
    if (on) h.dataset.scroll = "locked";
    else delete h.dataset.scroll;
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  /** 放大弹窗 / 彩蛋：展开时锁滚动，别的屏全部 inert */
  const makeModal = useCallback(
    (name: (typeof SCREENS)[number]) => (on: boolean) => {
      state.current.modal = on ? SCREENS.indexOf(name) : -1;
      setModalOpen(on);
      lock(on);
      applyInert();
    },
    [lock, applyInert],
  );
  const modalLetter = useCallback((on: boolean) => makeModal("letter")(on), [makeModal]);
  const modalPostcards = useCallback((on: boolean) => makeModal("postcards")(on), [makeModal]);
  const modalPhotos = useCallback((on: boolean) => makeModal("photos")(on), [makeModal]);

  const preload = useCallback((k: number) => {
    const s = sections()[k];
    if (s) loadImgs(s);
  }, []);

  /* 屏间镜头（plan §3）：原生滚动 + scroll-snap，不接管手势；每帧按滚动进度 s 写横移和镜头的 rotate/scale */
  const update = useCallback(() => {
    const sc = scroller.current!, H = L.H || 1, p = sc.scrollTop / H;
    const i = Math.floor(p + 1e-4), s = clamp(p - i, 0, 1), moving = s > 1e-4 && s < 1 - 1e-4;
    const lv = Math.min(CAMERA_LEVEL, env.tier) as 0 | 1 | 2; // 档 2 = F2，档 1 = F1，档 0 = 竖直吸附（§10.9）
    sc.querySelectorAll<HTMLElement>(":scope > .screen > .shift").forEach((sh, k) => {
      const d = k - p;
      sh.style.transform = lv && moving && Math.abs(d) < 1 ? `translateX(${(d * H * TAN7).toFixed(2)}px)` : "none";
    });
    const e = Math.sin(Math.PI * s) ** 2;
    rig.current!.style.transform = lv && moving && e > 1e-6 ? `rotate(${(CAM[lv].rot * e).toFixed(4)}deg) scale(${(1 + CAM[lv].zoom * e).toFixed(5)})` : "none";
    lensMain.current!.style.opacity = clamp(p, 0, 1).toFixed(3); // 第 1 屏用弱暗角，往后换成正常暗角
    ctls.current[0]?.setActive?.(p < 1 - 1e-3);
    if (!state.current.ready || !state.current.unlocked) return;
    for (let k = 1; k < SCREENS.length; k++) {
      if (!entered.current[k] && p >= k - 1 + 0.6) { // §3d：滚动进度 s ≥ 0.6 触发入场，每屏只一次
        entered.current[k] = true;
        ctls.current[k]?.enter();
        preload(k + 1); // 进了第 k 屏就预取下一屏（G6）
      }
    }
  }, [preload]);

  const goNext = useCallback(() => {
    const sc = scroller.current!, st = state.current;
    if (!st.unlocked || st.locked) return; // S1：没输对密码前，任何方式都不能往下走
    const i = Math.round(sc.scrollTop / L.H);
    if (i >= SCREENS.length - 1) return;
    if (isVirtual()) smoothTo(sc, (i + 1) * L.H, update);
    else sections()[i + 1].scrollIntoView({ behavior: env.rm ? "auto" : "smooth" });
  }, [update]);

  useEffect(() => {
    const h = document.documentElement, st = state.current;
    const sc = scroller.current!;
    lock(true);
    applyInert();

    // spec §6：H 取首次加载的 100svh，只在旋转（宽度变化）时重算；键盘、地址栏都不重排（G3）
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const read = () => ({ W: h.clientWidth || innerWidth, H: probe.offsetHeight || innerHeight });
    let cur = read();
    const apply = () => {
      const idx = Math.round(sc.scrollTop / (L.H || 1));
      computeLayout(cur.W, cur.H);
      sc.scrollTop = idx * L.H;
      st.lockTop = sc.scrollTop;
      update();
    };
    computeLayout(cur.W, cur.H);
    update();
    const onResize = () => {
      const n = read();
      if (n.W === cur.W) return; // 只有宽度变了（旋转、电脑窗口改宽）才重排
      cur = n;
      apply();
    };
    const onOrient = () => setTimeout(() => { cur = read(); apply(); }, 350);
    addEventListener("resize", onResize);
    addEventListener("orientationchange", onOrient);

    // 滚动：scroll 里只记一笔，rAF 里读 scrollTop、只写 transform（§3g 的 JS 写法）
    let pending = false, settle = 0;
    const onScroll = () => {
      if (st.locked && Math.abs(sc.scrollTop - st.lockTop) > 0.5) { sc.scrollTop = st.lockTop; return; } // S1：锁定时谁也滚不动（含 scrollIntoView、焦点跳转）
      pokeMonitor();
      clearTimeout(settle);
      settle = window.setTimeout(onSettle, 160);
      if (pending || isVirtual()) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; update(); });
    };
    // 吸附稳定后才把判定出的档位落地（§10.9「切档时机」）
    const onSettle = () => {
      const p = sc.scrollTop / L.H;
      if (st.locked || Math.abs(p - Math.round(p)) > 0.002) return;
      if (commitTier()) update();
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    // S1：锁定期间挡住所有能翻页的按键（输入框里的数字和退格不受影响）
    const onKey = (e: KeyboardEvent) => {
      if (st.locked && SCROLL_KEYS.has(e.key)) e.preventDefault();
    };
    addEventListener("keydown", onKey, true);

    // 录屏接口：scripts/record.mjs 逐帧设置滚动位置
    const w = window as unknown as Record<string, unknown>;
    w.__scrollTo = (y: number) => { if (st.locked) return; sc.scrollTop = y; update(); };
    w.__screens = SCREENS;
    w.__settle = onSettle;
    w.__frames = frameStats;

    // §10.8：字体就绪后才开始各屏入场
    document.fonts.ready.then(() => {
      st.ready = true;
      h.dataset.ready = "";
      update();
    });
    return () => {
      removeEventListener("resize", onResize); removeEventListener("orientationchange", onOrient);
      removeEventListener("keydown", onKey, true); sc.removeEventListener("scroll", onScroll);
    };
  }, [lock, update, applyInert]);

  const onUnlock = useCallback(() => {
    const st = state.current;
    st.unlocked = true;
    lock(false);
    applyInert();
    document.documentElement.dataset.unlocked = "";
    preload(1);
    commitTier(); // 开场静止点：判定档在这里落地
    update();
  }, [lock, applyInert, preload, update]);

  return (
    <div id="frame">
      <div id="camera">
        <div className="rig" ref={rig}>
          <div className="lens soft" />
          <div className="lens main" ref={lensMain} />
          <div className="lens sides" />
          <div id="scroller" ref={scroller}>
            {SCREENS.map((name, i) => {
              const register = regs.current[i];
              const idx = i + 1;
              const tot = SCREENS.length;
              switch (name) {
                case "opening": return <Opening key={name} register={register} index={idx} total={tot} onUnlock={onUnlock} onNext={goNext} />;
                case "flower": return <Flower key={name} register={register} index={idx} total={tot} />;
                case "letter": return <Letter key={name} register={register} index={idx} total={tot} modal={modalLetter} />;
                case "birds": return <Birds key={name} register={register} index={idx} total={tot} />;
                case "postcards": return <Postcards key={name} register={register} index={idx} total={tot} modal={modalPostcards} />;
                case "photos": return <Photos key={name} register={register} index={idx} total={tot} modal={modalPhotos} />;
                case "ending": return <Ending key={name} register={register} index={idx} total={tot} />;
              }
            })}
          </div>
          <EscortBirdsOverlay scrollerRef={scroller} modalOpen={modalOpen} />
        </div>
      </div>
    </div>
  );
}

/** 录屏模式下「轻触 · 向下」用虚拟时钟做平滑滚动（真机用原生 scrollIntoView） */
function smoothTo(sc: HTMLElement, y: number, update: () => void) {
  const y0 = sc.scrollTop;
  tween({ dur: 620, ease: E.out, on: (k) => { sc.scrollTop = lerp(y0, y, k); update(); window.dispatchEvent(new Event("xiyu-scroll")); } });
}
