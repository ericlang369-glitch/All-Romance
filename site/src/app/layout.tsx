import type { Metadata, Viewport } from "next";
import { ASSET_BASE, ASSET_CDN, BASE_PATH } from "@/config";
import "./globals.css";

export const metadata: Metadata = { title: "陈玺羽 · 第 100 天", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1430C4" };

const F = `${ASSET_BASE}/fonts/`;
const FL = `${BASE_PATH}/fonts/`;
/** 字体先走 CDN，失败时浏览器自动取第二个地址（GitHub Pages 本地） */
const src = (name: string) =>
  ASSET_CDN ? `url("${F}${name}") format("woff2"),url("${FL}${name}") format("woff2")` : `url("${F}${name}") format("woff2")`;

/** 最先执行：CDN 2.5 秒内连不上或报错就判定不通，之后的图片全部改走本地；已在 DOM 里加载失败的图片就地换回本地 */
const CDN_GUARD = ASSET_CDN
  ? `(function(){var C=${JSON.stringify(ASSET_CDN)},L=${JSON.stringify(BASE_PATH)},w=window;function d(){w.__cdnDead=1}` +
    `addEventListener("error",function(e){var t=e.target;if(!t||t.tagName!=="IMG")return;var s=t.getAttribute("src")||"";if(s.indexOf(C)===0){d();t.setAttribute("src",L+s.slice(C.length))}},true);` +
    `try{var a=new AbortController(),m=setTimeout(function(){a.abort()},2500);fetch(C+"/assets/tree/32-left4-flowers-wind.webp",{mode:"no-cors",signal:a.signal}).then(function(){clearTimeout(m)},d)}catch(x){}})()`
  : "";

const FONT_CSS = `
@font-face{font-family:"Noto Serif SC";src:${src("NotoSerifSC-v3.woff2")};font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Noto Serif SC VF";src:${src("NotoSerifSC-v3.woff2")};font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Noto Sans SC";src:${src("NotoSansSC-v3.woff2")};font-weight:500 600;font-style:normal;font-display:swap}
@font-face{font-family:"Noto Sans SC VF";src:${src("NotoSansSC-v3.woff2")};font-weight:500 600;font-style:normal;font-display:swap}
@font-face{font-family:"Montserrat";src:${src("Montserrat-v3.woff2")};font-weight:500 800;font-style:normal;font-display:swap}
@font-face{font-family:"Montserrat Full";src:${src("Montserrat-v3.woff2")};font-weight:500 800;font-style:normal;font-display:swap}
@font-face{font-family:"Source Serif 4";src:${src("SourceSerif4-v3.woff2")};font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Source Serif 4";src:${src("SourceSerif4-Italic-v3.woff2")};font-weight:700;font-style:italic;font-display:swap}
@font-face{font-family:"Zhi Mang Xing";src:${src("ZhiMangXing-v3.woff2")};font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Playfair Display";src:${src("PlayfairDisplay-Italic-v3.woff2")};font-weight:700;font-style:italic;font-display:swap}
@font-face{font-family:"Bodoni Moda";src:${src("BodoniModa-v3.woff2")};font-weight:900;font-style:normal;font-display:swap}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {CDN_GUARD && <script dangerouslySetInnerHTML={{ __html: CDN_GUARD }} />}
        {ASSET_CDN && <link rel="preconnect" href={new URL(ASSET_CDN).origin} crossOrigin="" />}
        {/* JS 就绪才加入场前的隐藏状态（plan §0） */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
        <link rel="preload" href={`${F}NotoSerifSC-v3.woff2`} as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href={`${F}NotoSansSC-v3.woff2`} as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href={`${F}Montserrat-v3.woff2`} as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
