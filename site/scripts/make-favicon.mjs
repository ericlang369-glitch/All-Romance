// 生成 favicon（M5）：--blue 底 + 一朵白色五瓣樱花（花形用站里同一条路径，spec §7 01「花形」）。
// 输出 src/app/icon.png（Next 自动加 <link rel=icon>）和 public/favicon.ico（ffmpeg 转）。
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
const SK = "M0 -1.00 C 2.20 -2.40, 3.80 -4.20, 3.70 -6.60 C 3.60 -8.60, 2.20 -9.80, 0.90 -9.50 L 0 -8.30 L -0.90 -9.50 C -2.20 -9.80, -3.60 -8.60, -3.70 -6.60 C -3.80 -4.20, -2.20 -2.40, 0 -1.00 Z";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-12 -12 24 24"><rect x="-12" y="-12" width="24" height="24" fill="#1430C4"/><g fill="#fff" transform="rotate(6)">${[0, 72, 144, 216, 288].map((r) => `<path d="${SK}" transform="rotate(${r})"/>`).join("")}<circle r="2.2"/></g></svg>`;
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 64, height: 64, deviceScaleFactor: 1 });
await p.setContent(`<style>html,body{margin:0}</style>${svg}`);
await p.screenshot({ path: "src/app/icon.png", omitBackground: false });
await b.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", "src/app/icon.png", "-vf", "scale=32:32:flags=lanczos", "public/favicon.ico"]);
console.log("ok");
