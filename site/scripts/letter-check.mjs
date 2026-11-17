// 信件屏单独截图：先把 src/config.ts 的 SHOW_LETTER 改成 true 并 pnpm build，再运行 node scripts/letter-check.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
const p = await b.newPage();
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3000/?rec',{waitUntil:'networkidle0'});
const s = await p.evaluate(()=>window.__screens);
const H = await p.evaluate(()=>document.getElementById('scroller').clientHeight);
let t=0; await p.evaluate(v=>window.__step(v), t+=100);
const i = s.indexOf('letter');
await p.evaluate(y=>window.__scrollTo(y), i*H);
for(let k=0;k<200;k++) await p.evaluate(v=>window.__step(v), t+=16.667);
await p.screenshot({path:new URL('../../preview/v2/screens/390x844/03-letter.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
console.log(JSON.stringify(s), H, errs);
await b.close();
