import puppeteer from "puppeteer-core";
const [q = "", thr = "4", dpr = "2"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const c = await p.createCDPSession(); await c.send("Emulation.setCPUThrottlingRate", { rate: +thr });
await p.goto("http://localhost:3000/" + q, { waitUntil: "networkidle0", timeout: 120000 });
await new Promise((r) => setTimeout(r, 2000));
await p.evaluate(() => { window.__ts = []; const f = (t) => { window.__ts.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
await p.focus("#passInput"); await p.keyboard.type("0825"); const t0 = await p.evaluate(() => performance.now());
await new Promise((r) => setTimeout(r, 8500));
const r = await p.evaluate((t0) => {
  const ts = window.__ts.filter((t) => t >= t0 && t <= t0 + 7000), d = ts.slice(1).map((t, i) => t - ts[i]);
  const st = (a) => { const s = [...a].sort((x, y) => x - y); return { n: a.length, fps: +(1000 / (a.reduce((x, y) => x + y, 0) / a.length)).toFixed(1), slow: +(a.filter((x) => x > 20).length / a.length).toFixed(3), o33: +(a.filter((x) => x > 34.3).length / a.length).toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
  let worst = null;
  for (let w0 = t0; w0 + 2000 <= t0 + 7000; w0 += 100) { const a = []; for (let i = 1; i < ts.length; i++) if (ts[i] > w0 && ts[i] <= w0 + 2000) a.push(ts[i] - ts[i - 1]); const s = st(a); if (!worst || s.o33 > worst.o33) worst = { ...s, from: +((w0 - t0) / 1000).toFixed(1) }; }
  return { all: st(d), worst, tier: document.documentElement.dataset.tier, judged: document.documentElement.dataset.judged, log: (window.__frames?.log || []).map((x) => ({ ...x, at: +((x.at - t0) / 1000).toFixed(2) })) };
}, t0);
console.log(`${q || "(无)"} CPU×${thr} DPR${dpr}`, JSON.stringify(r));
await b.close();
