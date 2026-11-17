import type { Metadata, Viewport } from "next";
import { BASE_PATH } from "@/config";
import "./globals.css";

export const metadata: Metadata = { title: "陈玺羽 · 第 100 天", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1430C4" };

const F = `${BASE_PATH}/fonts/`;

const FONT_CSS = `
@font-face{font-family:"Noto Serif SC";src:url("${F}NotoSerifSC-Bold.subset.woff2") format("woff2");font-weight:700;font-display:block}
@font-face{font-family:"Noto Sans SC";src:url("${F}NotoSansSC-Medium.subset.woff2") format("woff2");font-weight:500;font-display:block}
@font-face{font-family:"Montserrat";src:url("${F}Montserrat-wght500-650.subset.woff2") format("woff2");font-weight:500 650;font-display:block}
@font-face{font-family:"Source Serif 4";src:url("${F}SourceSerif4-725-opsz60.subset.woff2") format("woff2");font-weight:725;font-style:normal;font-display:block}
@font-face{font-family:"Source Serif 4";src:url("${F}SourceSerif4-725Italic-opsz60.subset.woff2") format("woff2");font-weight:725;font-style:italic;font-display:block}
@font-face{font-family:"Montserrat Full";src:url("${F}Montserrat[wght].ttf") format("truetype");font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"Source Serif 4";src:url("${F}SourceSerif4[opsz,wght].ttf") format("truetype");font-weight:200 900;font-style:normal;font-display:swap}
@font-face{font-family:"Source Serif 4";src:url("${F}SourceSerif4-Italic[opsz,wght].ttf") format("truetype");font-weight:200 900;font-style:italic;font-display:swap}
@font-face{font-family:"Noto Serif SC VF";src:url("${F}NotoSerifSC-VF.ttf") format("truetype");font-weight:200 900;font-style:normal;font-display:swap}
@font-face{font-family:"Noto Sans SC VF";src:url("${F}NotoSansSC-VF.ttf") format("truetype");font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"Zhi Mang Xing";src:url("${F}ZhiMangXing-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Playfair Display";src:url("${F}PlayfairDisplay-Italic-Var.ttf") format("truetype");font-weight:400 900;font-style:italic;font-display:swap}
@font-face{font-family:"Bodoni Moda";src:url("${F}BodoniModa-Var.ttf") format("truetype");font-weight:400 900;font-style:normal;font-display:swap}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* JS 就绪才加入场前的隐藏状态（plan §0） */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
        <link rel="preload" href={`${F}Montserrat[wght].ttf`} as="font" type="font/ttf" crossOrigin="" />
        <link rel="preload" href={`${F}SourceSerif4-Italic[opsz,wght].ttf`} as="font" type="font/ttf" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
