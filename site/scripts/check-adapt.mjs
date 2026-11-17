// 对照 design/adapt/check.json：同一视口下量网站里每段文字、明信片/拍立得外框、拍立得间距，和适配示意稿逐项比。
// 用法：node scripts/check-adapt.mjs [URL] [out.json]（03 信件屏网站默认不显示，跳过）
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";
const URL0 = process.argv[2] || "http://localhost:3000/";
const OUT = process.argv[3] || new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") + "preview/v2/qa/check-adapt.json";
const ref = JSON.parse(readFileSync(new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") + "design/adapt/check.json", "utf8"));
const NAME = { "01-opening": "opening", "01a-passcode": "opening", "02-flower": "flower", "04-postcards": "postcards", "05-photos": "photos", "05a-easter-egg": "photos", "06-ending": "ending" };
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = [];
for (const r of ref) {
  const [scr, vp] = r.file.split("_"); if (!NAME[scr]) continue;
  const [W, H] = vp.split("x").map(Number);
  const p = await b.newPage();
  await p.emulate({ viewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: W <= 430, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  await p.goto(URL0 + "?rec&now=2026-12-03T00%3A00%3A00%2B08%3A00", { waitUntil: "networkidle0" });
  let t = 0; const step = async (ms) => { const e = t + ms; while (t < e) { t += 1000 / 60; await p.evaluate((v) => window.__step(v), t); } };
  await step(800); await p.focus("#passInput");
  if (scr === "01a-passcode") { await p.keyboard.type("08"); await step(1200); }
  else {
    await p.keyboard.type("0825"); await step(8000);
    const k = (await p.evaluate(() => window.__screens)).indexOf(NAME[scr]);
    if (k > 0) { await p.evaluate((y) => window.__scrollTo(y), k * H); await step(200); await p.evaluate(() => window.__settle && window.__settle()); }
    await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute("src") || i.complete), { timeout: 20000 });
    await step(5000);
    if (scr === "05a-easter-egg") { await p.focus("#s-photos .p2"); await p.keyboard.press("Enter"); await step(2000); }
  }
  const m = await p.evaluate((name, egg) => {
    const sec = document.getElementById("s-" + name), top = sec.getBoundingClientRect().top;
    const root = egg ? sec.querySelector(".egg") : sec;
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim()) continue; const el = n.parentElement;
      if (!egg && el.closest(".egg")) continue;
      if (el.closest(".face.back") || el.closest(".old")) continue;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden") continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const q = rg.getBoundingClientRect(); if (!q.width) continue;
      out.push({ t: n.textContent.trim(), fs: parseFloat(cs.fontSize), box: [q.left, q.top - top, q.right, q.bottom - top].map((v) => +v.toFixed(1)) });
    }
    const boxes = egg ? [] : [...sec.querySelectorAll(".polaroid,.card")].map((e) => { const q = e.getBoundingClientRect(); return { cls: e.classList.contains("card") ? "postcard" : "polaroid", box: [q.left, q.top - top, q.right, q.bottom - top].map((v) => +v.toFixed(1)) }; });
    const caps = [...sec.querySelectorAll(".polaroid .cap")].map((e) => { const cs = getComputedStyle(e); const R = document.createRange(); R.selectNodeContents(e); return { t: e.textContent, fs: parseFloat(cs.fontSize), ls: cs.letterSpacing, sw: e.scrollWidth, cw: e.clientWidth, textW: +R.getBoundingClientRect().width.toFixed(2), innerW: +parseFloat(cs.width).toFixed(2), lines: R.getClientRects().length }; });
    return { out, boxes, caps };
  }, NAME[scr], scr === "05a-easter-egg");
  // 逐段配对（同文字按出现顺序）
  const used = new Set(), diffs = [];
  for (const x of r.texts) {
    const i = m.out.findIndex((y, j) => !used.has(j) && y.t === x.t);
    if (i < 0) { diffs.push({ t: x.t, missing: true }); continue; }
    used.add(i); const y = m.out[i];
    const d = Math.max(...x.box.map((v, k) => Math.abs(v - y.box[k])));
    diffs.push({ t: x.t, d: +d.toFixed(1), ref: x.box, got: y.box, fsRef: x.fs, fs: y.fs });
  }
  const extra = m.out.filter((_, j) => !used.has(j)).map((y) => y.t);
  const boxD = r.boxes.map((B, k) => m.boxes[k] ? { cls: B.cls, d: +Math.max(...B.box.map((v, i) => Math.abs(v - m.boxes[k].box[i]))).toFixed(1), ref: B.box, got: m.boxes[k].box } : { cls: B.cls, missing: true });
  const pol = m.boxes.filter((B) => B.cls === "polaroid");
  const polGap = pol.length === 2 ? +(pol[1].box[1] - pol[0].box[3]).toFixed(2) : null;
  const maxD = Math.max(0, ...diffs.filter((x) => !x.missing).map((x) => x.d), ...boxD.filter((x) => !x.missing).map((x) => x.d));
  res.push({ file: r.file, maxD, polGapRef: r.polGapBbox, polGap, texts: diffs, boxes: boxD, caps: m.caps, extra });
  console.log(r.file.padEnd(24), "最大偏差", maxD + "px", polGap != null ? `拍立得间距 ${polGap}（稿 ${r.polGapBbox}）` : "", diffs.filter((x) => x.missing || x.d > 1).map((x) => x.missing ? `缺:${x.t}` : `${x.t}:${x.d}`).join(" | "), boxD.filter((x) => x.missing || x.d > 1).map((x) => `${x.cls}:${x.d ?? "缺"}`).join(" "), extra.length ? "多出:" + extra.join("/") : "");
  await p.close();
}
await b.close();
writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log("→", OUT);
