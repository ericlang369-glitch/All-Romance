import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const run = async (q, thr, dpr = 2) => {
  const p = await b.newPage();
  await p.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: dpr, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  const c = await p.createCDPSession(); await c.send("Emulation.setCPUThrottlingRate", { rate: thr });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:3000/" + q, { waitUntil: "networkidle0", timeout: 120000 });
  const rd = () => p.evaluate(() => { const d = document.documentElement.dataset; return `tier=${d.tier} judged=${d.judged} rm=${d.rm ?? "-"} petals=${document.querySelectorAll("#title ~ * , #gust").length}`; });
  const a = await rd(); await new Promise((r) => setTimeout(r, 3000)); const a2 = await rd();
  await p.focus("#passInput"); await p.keyboard.type("0825"); const t0 = await p.evaluate(() => performance.now()); await new Promise((r) => setTimeout(r, 4000)); const g = await rd();
  await new Promise((r) => setTimeout(r, 6000)); const e = await rd();
  const log = await p.evaluate((t0) => (window.__frames?.log || []).map((x) => ({ ...x, at: +((x.at - t0) / 1000).toFixed(2), from: +((x.from - t0) / 1000).toFixed(2) })), t0);
  console.log(`${(q || "(无参数)").padEnd(10)} CPU×${thr} DPR${dpr}`.padEnd(26), "| 载入", a, "| 3s后", a2, "| 风中", g, "| 解锁后", e, errs.length ? errs : "", "\n    降档记录（秒，以输对第4位为0）", JSON.stringify(log));
  await p.close();
};
const only = process.argv[2]; const L = only ? JSON.parse(only) : [["", 1, 2], ["", 4, 2], ["", 6, 2], ["", 12, 2], ["", 1, 3], ["", 4, 3], ["?tier=2", 12, 2], ["?tier=1", 1, 2], ["?tier=0", 1, 2], ["?low", 1, 2]];
for (const [q, t, d] of L) await run(q, t, d);
await b.close();
