// G6 首屏加载实测：关缓存打开首页，停在密码页（不输密码）3 秒后统计。
// 用法：node scripts/measure-load.mjs [URL] [输出.json]
// 统计：传输字节（CDP encodedDataLength，按类型分）、请求数、已加载图片的解码大小（naturalW×naturalH×4，和验收 i_perf 同口径）、
//       Canvas 像素内存、以及 Chrome 全部进程 RSS 合计（/proc，与空白页对比得出页面增量）。
import puppeteer from "puppeteer-core";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const URL0 = process.argv[2] || "http://localhost:3000/";
const OUT = process.argv[3];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function rssOf(rootPid) {
  // 统计 rootPid 及其全部子孙进程的 VmRSS（KB）
  const kids = {};
  for (const p of readdirSync("/proc")) {
    if (!/^\d+$/.test(p)) continue;
    try { const s = readFileSync(`/proc/${p}/stat`, "utf8"); const pp = +s.slice(s.lastIndexOf(")") + 2).split(" ")[1]; (kids[pp] ||= []).push(+p); } catch {}
  }
  let tot = 0; const st = [rootPid];
  while (st.length) { const p = st.pop(); try { const m = readFileSync(`/proc/${p}/status`, "utf8").match(/VmRSS:\s+(\d+)/); if (m) tot += +m[1]; } catch {} (kids[p] || []).forEach((k) => st.push(k)); }
  return tot;
}
async function run(url) {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
  const page = await b.newPage();
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: UA });
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url.replace(/^https?:\/\/[^/]+/, ""), type: e.type }));
  cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  await page.goto("about:blank"); await sleep(1500);
  const rss0 = rssOf(b.process().pid);
  await page.goto(url, { waitUntil: "load" });
  await sleep(3000);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const rss1 = rssOf(b.process().pid);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth).map((i) => ({ src: i.currentSrc.replace(location.origin, ""), w: i.naturalWidth, h: i.naturalHeight })));
  const pending = await page.evaluate(() => [...document.images].filter((i) => !i.currentSrc).length);
  const canv = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => c.width * c.height * 4));
  const list = [...reqs.values()];
  const sum = (f) => list.filter(f).reduce((a, r) => a + (r.bytes || 0), 0);
  const by = {}; list.forEach((r) => (by[r.type] = (by[r.type] || 0) + (r.bytes || 0)));
  const R = {
    url, requests: list.length, transferBytes: sum(() => true), byType: by,
    imageRequests: list.filter((r) => r.type === "Image").length,
    imagesLoaded: imgs.length, imagesDeferred: pending,
    decodedImageMB: +(imgs.reduce((a, i) => a + i.w * i.h * 4, 0) / 1048576).toFixed(2),
    canvasMB: +(canv.reduce((a, c) => a + c, 0) / 1048576).toFixed(2), canvases: canv.length,
    chromeRssMB: { blank: +(rss0 / 1024).toFixed(1), page: +(rss1 / 1024).toFixed(1), delta: +((rss1 - rss0) / 1024).toFixed(1) },
    bigImages: imgs.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 8).map((i) => `${i.src} ${i.w}x${i.h} ${(i.w * i.h * 4 / 1048576).toFixed(1)}MB`),
    imageList: list.filter((r) => r.type === "Image").map((r) => `${r.bytes} ${r.url}`),
  };
  await b.close();
  return R;
}
const runs = [];
for (let i = 0; i < 3; i++) runs.push(await run(URL0));
const med = (a) => a.slice().sort((x, y) => x - y)[1];
const R = { ...runs[0], chromeRssMB: { runs: runs.map((r) => r.chromeRssMB), deltaMedian: med(runs.map((r) => r.chromeRssMB.delta)) } };
if (OUT) writeFileSync(OUT, JSON.stringify(R, null, 1));
const { imageList, ...short } = R;
console.log(JSON.stringify(short, null, 1));
