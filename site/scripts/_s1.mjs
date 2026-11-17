import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));
const state = () => p.evaluate(() => { const a = document.activeElement; return { top: document.getElementById("scroller").scrollTop, win: scrollY, active: a.id || a.className || a.tagName, inSec: a.closest("section")?.id, inert: [...document.querySelectorAll("section.screen")].map((s) => s.id + ":" + (s.inert ? "inert" : "live")).join(" ") }; });
console.log("初始", await state());
const keys = ["Tab", "Tab", "Tab", "Tab", "Tab", "Enter", "Space", "PageDown", "End", "ArrowDown", "ArrowRight", "Home", "PageUp"];
const seen = new Set();
for (const k of keys) { await p.keyboard.press(k); await new Promise((r) => setTimeout(r, 250)); const s = await state(); seen.add(JSON.stringify([s.top, s.win, s.inSec])); console.log(k.padEnd(10), JSON.stringify(s)); }
await p.keyboard.down("Shift"); await p.keyboard.press("Tab"); await p.keyboard.up("Shift"); console.log("Shift+Tab", JSON.stringify(await state()));
await p.mouse.wheel({ deltaY: 900 }); await new Promise((r) => setTimeout(r, 500)); console.log("wheel", JSON.stringify(await state()));
await p.touchscreen.touchStart(200, 700); await p.touchscreen.touchMove(200, 200); await p.touchscreen.touchEnd(); await new Promise((r) => setTimeout(r, 600)); console.log("swipe", JSON.stringify(await state()));
// 程序滚动 / hintTap
console.log("hintTap", await p.evaluate(() => { const b = document.querySelector(".hintTap"); return { disabled: b.disabled, tabIndex: b.tabIndex }; }));
await p.evaluate(() => { document.getElementById("scroller").scrollTop = 900; }); await new Promise((r) => setTimeout(r, 300)); console.log("JS scrollTop=900", JSON.stringify(await state()));
// G3：输入框聚焦后视口变矮（模拟键盘），不重排
const H0 = await p.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue("--H"), document.querySelector("section.screen").offsetHeight, document.getElementById("passInput").getBoundingClientRect().top]);
await p.focus("#passInput");
await p.setViewport({ width: 390, height: 508, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await new Promise((r) => setTimeout(r, 800));
const H1 = await p.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue("--H"), document.querySelector("section.screen").offsetHeight, document.getElementById("passInput").getBoundingClientRect().top]);
console.log("G3 键盘前", H0, "键盘后(390x508)", H1);
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await new Promise((r) => setTimeout(r, 500));
// 解锁后键盘可用
await p.focus("#passInput"); await p.keyboard.type("0825"); await new Promise((r) => setTimeout(r, 7000));
console.log("解锁后", JSON.stringify(await state()));
await p.keyboard.press("Tab"); console.log("Tab", JSON.stringify(await state()));
await p.keyboard.press("Enter"); await new Promise((r) => setTimeout(r, 1500)); console.log("Enter on hint", JSON.stringify(await state()));
await p.keyboard.press("PageDown"); await new Promise((r) => setTimeout(r, 1500)); console.log("PageDown", JSON.stringify(await state()));
console.log("errors", errs);
await b.close();
