import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const [W, H] of [[375, 667], [390, 664], [390, 844], [1440, 900]]) {
  const p = await b.newPage();
  await p.emulate({ viewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: W <= 430, hasTouch: true }, userAgent: "iPhone" });
  await p.goto("http://localhost:3000/?rec", { waitUntil: "networkidle0" });
  let t = 0; const step = async (ms) => { const e = t + ms; while (t < e) { t += 16.667; await p.evaluate((v) => window.__step(v), t); } };
  await step(800);
  const calm1 = await p.evaluate(() => { const c = document.getElementById("calm"); const f = document.querySelector(".cflower"); const r = (f || c).getBoundingClientRect(); return [(r.top + r.bottom) / 2, r.width]; });
  await p.focus("#passInput"); await p.keyboard.type("0825"); await step(9000);
  const calm2 = await p.evaluate(() => { const f = document.querySelector(".cflower"); const r = f.getBoundingClientRect(); return [(r.top + r.bottom) / 2, r.width]; });
  await p.evaluate((y) => window.__scrollTo(y), H); await step(300);
  await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute("src") || i.complete));
  await step(6000);
  const fr = await p.evaluate(() => { const s = document.getElementById("s-flower"), st = s.getBoundingClientRect().top; const r = s.querySelector('img[src*="framed-bg"]').getBoundingClientRect(); const bf = s.querySelector(".bf"); return { top: +(r.top - st).toFixed(2), bottom: +(r.bottom - st).toFixed(2), w: +r.width.toFixed(2), left: +r.left.toFixed(2), bfTransform: getComputedStyle(bf).transform, wings: [...bf.querySelectorAll("img")].map((i) => getComputedStyle(i).transform) }; });
  const k = (await p.evaluate(() => window.__screens)).indexOf("ending");
  await p.evaluate((y) => window.__scrollTo(y), k * H); await step(300);
  await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute("src") || i.complete));
  await step(4000);
  const bq = await p.evaluate(() => { const s = document.getElementById("s-ending"), st = s.getBoundingClientRect().top; const r = s.querySelector(".bq").getBoundingClientRect(); return [+(r.top - st).toFixed(2), +(r.bottom - st).toFixed(2)]; });
  console.log(`${W}x${H}`, "ripple(pass) cy/w", calm1.map((v) => +v.toFixed(2)), "ripple(title)", calm2.map((v) => +v.toFixed(2)), "frame", JSON.stringify(fr), "bouquet", bq);
  await p.close();
}
await b.close();
