"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_PATH, CAMERA_LEVEL, SHOW_LETTER } from "@/config";
import { E, L, clamp, commitTier, computeLayout, env, frameStats, lerp, loadImgs, onLayout, pokeMonitor, tween } from "@/lib/kit";
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
  progressRef,
  modalOpen,
}: {
  progressRef: React.MutableRefObject<number>;
  modalOpen: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const blueRef = useRef<HTMLDivElement>(null);
  const amberRef = useRef<HTMLDivElement>(null);
  const [flapping, setFlapping] = useState(false);
  const flapRef = useRef(false);

  const syncPosition = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const H = L.H || 708;
    const p = progressRef.current;
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
    const ss = L.ss || 1;
    const mapX = (x: number) => 195 + (x - 195) * ss;
    const mapY = (y: number) => H * 0.5 + (y - 354) * ss;

    if (blueRef.current) {
      const bx = mapX(lerp(168, 336, eT) + 26 * arc);
      const by =
        p <= BIRDS_IDX
          ? mapY(540) + localShift04
          : p >= POSTCARDS_IDX
            ? mapY(198) + localShift05
            : mapY(lerp(540, 198, eT) - 34 * arc);
      const brot = -22 + 4 * eT - 10 * arc;
      blueRef.current.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) rotate(${brot.toFixed(1)}deg) scale(${ss.toFixed(3)})`;
    }

    if (amberRef.current) {
      const ax = mapX(lerp(88, 56, eT) - 24 * arc);
      const ay =
        p <= BIRDS_IDX
          ? mapY(568) + localShift04
          : p >= POSTCARDS_IDX
            ? mapY(462) + localShift05
            : mapY(lerp(568, 462, eT) + 18 * arc);
      const arot = -26 + 10 * eT - 8 * arc;
      amberRef.current.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) rotate(${arot.toFixed(1)}deg) scale(${ss.toFixed(3)})`;
    }
  }, [progressRef, modalOpen]);

  useEffect(() => {
    syncPosition();
    const offLayout = onLayout(syncPosition);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("xiyu-scroll", syncPosition);
    return () => {
      offLayout();
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("xiyu-scroll", syncPosition);
    };
  }, [syncPosition]);

  return (
    <div ref={wrapRef} className="escort-layer" style={{ visibility: "hidden", opacity: 0 }}>
      <div className="col" style={{ overflow: "visible" }}>
        <div className="cs" style={{ overflow: "visible" }}>
          <div ref={blueRef} className="escort-pair-unit" data-flapping={flapping ? "1" : "0"}>
            <img src={`${B_DIR}wake-blue@3x.webp`} alt="" draggable={false} style={{ position: "absolute", left: -42, top: 51, width: 100, height: 60 }} />
            <img className="bird-f1" src={`${B_DIR}escort-blue-f1@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f2" src={`${B_DIR}escort-blue-f2@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f3" src={`${B_DIR}escort-blue-f3@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
          </div>
          <div ref={amberRef} className="escort-pair-unit" data-flapping={flapping ? "1" : "0"}>
            <img src={`${B_DIR}wake-amber@3x.webp`} alt="" draggable={false} style={{ position: "absolute", left: -42, top: 51, width: 100, height: 60 }} />
            <img className="bird-f1" src={`${B_DIR}escort-amber-f1@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f2" src={`${B_DIR}escort-amber-f2@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
            <img className="bird-f3" src={`${B_DIR}escort-amber-f3@3x.webp`} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: 140, height: 140 }} />
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
  const frameRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const lensMain = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const stopSnapRef = useRef<(() => void) | null>(null);
  const state = useRef({ ready: false, unlocked: false, locked: true, modal: -1 });
  const regs = useRef(SCREENS.map((_, i) => (c: ScreenCtl) => (ctls.current[i] = c)));

  const sections = () => (trackRef.current ? [...trackRef.current.querySelectorAll<HTMLElement>(":scope > .screen")] : []);
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
    const h = document.documentElement;
    state.current.locked = on;
    if (on) {
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      h.dataset.scroll = "locked";
    } else {
      delete h.dataset.scroll;
    }
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

  const preload = useCallback((k: number): Promise<void> => {
    const s = trackRef.current ? sections()[k] : undefined;
    return s ? loadImgs(s) : Promise.resolve();
  }, []);

  /* 60fps 虚拟 GPU Deck（translate3d）：每帧按连续进度 progressRef 写横移和镜头的 rotate/scale */
  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const H = L.H || 1;
    const p = clamp(progressRef.current, 0, SCREENS.length - 1);
    const i = Math.floor(p + 1e-4), s = clamp(p - i, 0, 1), moving = s > 1e-4 && s < 1 - 1e-4;
    const lv = Math.min(CAMERA_LEVEL, env.tier) as 0 | 1 | 2; // 档 2 = F2，档 1 = F1，档 0 = 竖直吸附（§10.9）
    track.querySelectorAll<HTMLElement>(":scope > .screen > .shift").forEach((sh, k) => {
      const d = k - p;
      sh.style.transform = lv && moving && Math.abs(d) < 1 ? `translateX(${(d * H * TAN7).toFixed(2)}px)` : "none";
    });
    const e = Math.sin(Math.PI * s) ** 2;
    rig.current!.style.transform = lv && moving && e > 1e-6 ? `rotate(${(CAM[lv].rot * e).toFixed(4)}deg) scale(${(1 + CAM[lv].zoom * e).toFixed(5)})` : "none";
    lensMain.current!.style.opacity = clamp(p, 0, 1).toFixed(3); // 第 1 屏用弱暗角，往后换成正常暗角
    ctls.current[0]?.setActive?.(p < 1 - 1e-3);
    if (!state.current.ready || !state.current.unlocked) return;
    for (let k = 1; k < SCREENS.length; k++) {
      if (!entered.current[k] && p >= k - 0.45) {
        entered.current[k] = true;
        ctls.current[k]?.enter();
        preload(k + 1); // 进了第 k 屏就预取下一屏（G6）
      }
    }
  }, [preload]);

  const setProgress = useCallback(
    (nextP: number) => {
      progressRef.current = nextP;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(0, ${(-nextP * (L.H || 1)).toFixed(2)}px, 0)`;
      }
      if (scroller.current) {
        scroller.current.dataset.page = String(clamp(Math.round(nextP), 0, SCREENS.length - 1));
        scroller.current.dataset.progress = nextP.toFixed(4);
      }
      update();
      window.dispatchEvent(new Event("xiyu-scroll"));
    },
    [update],
  );

  // 吸附稳定后才把判定出的档位落地（§10.9「切档时机」）
  const onSettle = useCallback(() => {
    const p = progressRef.current;
    if (state.current.locked || Math.abs(p - Math.round(p)) > 0.002) return;
    if (commitTier()) update();
  }, [update]);

  const goTo = useCallback(
    (targetIdx: number, durOverride?: number) => {
      const maxIdx = SCREENS.length - 1;
      const nextIdx = clamp(targetIdx, 0, maxIdx);
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      preload(nextIdx);
      const p0 = progressRef.current;
      if (env.rm || Math.abs(nextIdx - p0) < 1e-4) {
        setProgress(nextIdx);
        onSettle();
        return;
      }
      const dur = durOverride ?? clamp(Math.round(300 + Math.abs(nextIdx - p0) * 190), 320, 520);
      pokeMonitor();
      stopSnapRef.current = tween({
        dur,
        ease: E.out,
        on: (k) => {
          pokeMonitor();
          setProgress(lerp(p0, nextIdx, k));
        },
        done: () => {
          stopSnapRef.current = null;
          setProgress(nextIdx);
          onSettle();
        },
      });
    },
    [onSettle, preload, setProgress],
  );

  const goNext = useCallback(() => {
    const st = state.current;
    if (!st.unlocked || st.locked) return; // S1：没输对密码前，任何方式都不能往下走
    goTo(Math.round(progressRef.current) + 1);
  }, [goTo]);

  useEffect(() => {
    const h = document.documentElement, st = state.current;
    const frame = frameRef.current!;
    let dead = false;
    lock(true);
    applyInert();

    // spec §6：H 取 min(100svh, innerHeight)，在宽度变化或微信底栏伸缩时重算；键盘弹出不重排（G3）
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const read = () => ({ W: h.clientWidth || innerWidth, H: Math.min(probe.offsetHeight || innerHeight, innerHeight) });
    let cur = read();
    const apply = () => {
      const curP = clamp(Math.round(progressRef.current), 0, SCREENS.length - 1);
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      computeLayout(cur.W, cur.H);
      setProgress(curP);
    };
    apply();
    const onResize = () => {
      const n = read();
      const widthChanged = n.W !== cur.W;
      const toolbarChanged =
        document.activeElement?.tagName !== "INPUT" &&
        Math.abs(n.H - cur.H) > 36 &&
        Math.abs(n.H - cur.H) < 160;
      if (!widthChanged && !toolbarChanged) return;
      cur = n;
      apply();
    };
    const onOrient = () => setTimeout(() => { cur = read(); apply(); }, 350);
    addEventListener("resize", onResize);
    addEventListener("orientationchange", onOrient);

    // 60fps 双向触控手势引擎（支持跟手、橡皮筋回弹、速度甩页；永不在 touchstart 调用 preventDefault）
    let active = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let baseP = 0;
    let samples: { y: number; t: number }[] = [];
    let justDraggedUntil = 0;

    const closestModalScroll = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : (target as Node | null)?.parentElement;
      return el?.closest?.("[data-modal-scroll]") ?? null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (st.modal >= 0 || !st.unlocked || st.locked) {
        active = false;
        dragging = false;
        return;
      }
      if (e.touches.length !== 1) {
        active = false;
        return;
      }
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      baseP = progressRef.current;
      samples = [{ y: t.clientY, t: performance.now() }];
      active = true;
      dragging = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (st.modal >= 0) {
        if (!closestModalScroll(e.target) && e.cancelable) e.preventDefault();
        return;
      }
      if (!st.unlocked || st.locked) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          active = false;
          return;
        }
        if (Math.abs(dy) <= 8) {
          if (e.cancelable) e.preventDefault();
          return;
        }
        dragging = true;
      }
      if (e.cancelable) e.preventDefault();
      const nowT = performance.now();
      samples.push({ y: t.clientY, t: nowT });
      while (samples.length > 2 && nowT - samples[0].t > 100) samples.shift();
      const effDy = dy - Math.sign(dy) * 8;
      const rawP = baseP - effDy / (L.H || 1);
      const maxIdx = SCREENS.length - 1;
      const nextP = rawP < 0 ? rawP * 0.22 : rawP > maxIdx ? maxIdx + (rawP - maxIdx) * 0.22 : rawP;
      pokeMonitor();
      setProgress(nextP);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const maxIdx = SCREENS.length - 1;
      if (st.locked || st.modal >= 0) {
        dragging = false;
        if (Math.abs(progressRef.current - Math.round(progressRef.current)) > 1e-4) {
          setProgress(clamp(Math.round(progressRef.current), 0, maxIdx));
        }
        return;
      }
      if (!dragging) {
        if (Math.abs(progressRef.current - Math.round(progressRef.current)) > 1e-4) {
          goTo(clamp(Math.round(progressRef.current), 0, maxIdx));
        }
        return;
      }
      dragging = false;
      const nowT = performance.now();
      justDraggedUntil = nowT + 320;
      const endY = e.changedTouches[0]?.clientY ?? (samples.length ? samples[samples.length - 1].y : startY);
      const dy = endY - startY;
      while (samples.length > 2 && nowT - samples[0].t > 100) samples.shift();
      const lastSample = samples[samples.length - 1];
      let vy = 0;
      if (lastSample && nowT - lastSample.t <= 120) {
        const ref = samples[0];
        const dt = Math.max(8, nowT - ref.t);
        vy = (endY - ref.y) / dt;
      }
      const originIdx = clamp(Math.round(baseP), 0, maxIdx);
      if (dy < -40 || vy < -0.26) {
        goTo(Math.min(maxIdx, originIdx + 1));
      } else if (dy > 40 || vy > 0.26) {
        goTo(Math.max(0, originIdx - 1));
      } else {
        goTo(clamp(Math.round(progressRef.current), 0, maxIdx));
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (performance.now() < justDraggedUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 滚轮翻页（440ms 步进冷却）
    let wheelAcc = 0;
    let lastWheelAt = 0;
    let wheelCooldownUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (st.modal >= 0 && closestModalScroll(e.target)) return;
      if (e.cancelable) e.preventDefault();
      if (!st.unlocked || st.locked) return;
      const nowT = performance.now();
      if (nowT < wheelCooldownUntil) {
        wheelAcc = 0;
        return;
      }
      if (nowT - lastWheelAt > 220 || (wheelAcc !== 0 && Math.sign(e.deltaY) !== Math.sign(wheelAcc))) {
        wheelAcc = 0;
      }
      lastWheelAt = nowT;
      wheelAcc += e.deltaY;
      const maxIdx = SCREENS.length - 1;
      const idx = clamp(Math.round(progressRef.current), 0, maxIdx);
      if (wheelAcc >= 28) {
        wheelAcc = 0;
        wheelCooldownUntil = nowT + 440;
        if (idx < maxIdx) goTo(idx + 1);
      } else if (wheelAcc <= -28) {
        wheelAcc = 0;
        wheelCooldownUntil = nowT + 440;
        if (idx > 0) goTo(idx - 1);
      }
    };

    // S1：锁定期间挡住翻页键；解锁后支持方向键 / PageUp / PageDown / Space / Home / End
    const onKey = (e: KeyboardEvent) => {
      if (st.locked) {
        if (SCROLL_KEYS.has(e.key)) e.preventDefault();
        return;
      }
      if (!st.unlocked) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT" || tgt.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " && tgt?.closest?.("button, [role='button'], a")) return;
      const maxIdx = SCREENS.length - 1;
      const idx = clamp(Math.round(progressRef.current), 0, maxIdx);
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goTo(idx + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(idx - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(maxIdx);
      }
    };

    frame.addEventListener("touchstart", onTouchStart, { passive: false });
    frame.addEventListener("touchmove", onTouchMove, { passive: false });
    frame.addEventListener("touchend", onTouchEnd, { passive: false });
    frame.addEventListener("touchcancel", onTouchEnd, { passive: false });
    frame.addEventListener("click", onClickCapture, true);
    frame.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey, true);

    // 录屏 & 自动化测试接口
    const w = window as unknown as Record<string, unknown>;
    w.__scrollTo = (y: number) => {
      if (st.locked) return;
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      setProgress(clamp(y / (L.H || 1), 0, SCREENS.length - 1));
    };
    w.__getPageProgress = () => progressRef.current;
    w.__goTo = (idx: number) => {
      if (!st.locked) goTo(idx);
    };
    w.__screens = SCREENS;
    w.__settle = onSettle;
    w.__frames = frameStats;

    // §10.8：字体就绪后开始各屏入场，500ms 超时兜底防止弱网永久阻塞
    Promise.race([document.fonts.ready, new Promise<void>((r) => setTimeout(r, 500))]).then(() => {
      if (dead) return;
      st.ready = true;
      h.dataset.ready = "";
      update();
    });

    // 密码页渐进式预加载（700ms 后依次加载 02..07，每屏间隔 250ms）
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    const preloadTimer = window.setTimeout(() => {
      let chain: Promise<void> = Promise.resolve();
      for (let k = 1; k < SCREENS.length; k++) {
        chain = chain
          .then(() => {
            if (dead) return;
            return preload(k);
          })
          .then(() => {
            if (dead || k >= SCREENS.length - 1) return;
            return wait(250);
          });
      }
    }, 700);

    return () => {
      dead = true;
      stopSnapRef.current?.();
      stopSnapRef.current = null;
      clearTimeout(preloadTimer);
      removeEventListener("resize", onResize);
      removeEventListener("orientationchange", onOrient);
      removeEventListener("keydown", onKey, true);
      frame.removeEventListener("touchstart", onTouchStart);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("touchend", onTouchEnd);
      frame.removeEventListener("touchcancel", onTouchEnd);
      frame.removeEventListener("click", onClickCapture, true);
      frame.removeEventListener("wheel", onWheel);
      probe.remove();
    };
  }, [lock, update, applyInert, preload, setProgress, onSettle, goTo]);

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
    <div id="frame" ref={frameRef}>
      <div id="camera">
        <div className="rig" ref={rig}>
          <div className="lens soft" />
          <div className="lens main" ref={lensMain} />
          <div className="lens sides" />
          <div id="scroller" ref={scroller}>
            <div id="deckTrack" ref={trackRef}>
              {SCREENS.map((name, i) => {
                const register = regs.current[i];
                const idx = i + 1;
                const tot = SCREENS.length;
                switch (name) {
                  case "opening": return <Opening key={name} register={register} index={idx} total={tot} onUnlock={onUnlock} onNext={goNext} />;
                  case "flower": return <Flower key={name} register={register} index={idx} total={tot} onNext={goNext} />;
                  case "letter": return <Letter key={name} register={register} index={idx} total={tot} modal={modalLetter} onNext={goNext} />;
                  case "birds": return <Birds key={name} register={register} index={idx} total={tot} onNext={goNext} />;
                  case "postcards": return <Postcards key={name} register={register} index={idx} total={tot} modal={modalPostcards} onNext={goNext} />;
                  case "photos": return <Photos key={name} register={register} index={idx} total={tot} modal={modalPhotos} onNext={goNext} />;
                  case "ending": return <Ending key={name} register={register} index={idx} total={tot} />;
                }
              })}
            </div>
          </div>
          <EscortBirdsOverlay progressRef={progressRef} modalOpen={modalOpen} />
        </div>
      </div>
    </div>
  );
}
