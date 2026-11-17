import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(SITE, "src");
const FONTS_DIR = join(SITE, "public", "fonts");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const MAX_TOTAL_BYTES = 450 * 1024;
const REQUIRED_CJK_PUNCT = "，。；：？！「」『』—·～、…→";

function walkTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/** Remove // and /* *\/ comments outside string/template literals so comment prose does not bloat CJK subsets. */
function stripJsComments(code) {
  let out = "";
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < code.length) {
        if (code[i] === "\\") {
          out += code[i] + (code[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += code[i];
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
    } else if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") i++;
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function collectGlyphSets() {
  const asciiChars = [];
  for (let cp = 0x0020; cp <= 0x007e; cp++) {
    asciiChars.push(String.fromCodePoint(cp));
  }
  const latinChars = new Set([...asciiChars, "—", "·", "…", "→"]);
  const allChars = new Set([...latinChars, ...REQUIRED_CJK_PUNCT]);

  for (const file of walkTsFiles(SRC_DIR)) {
    const cleaned = stripJsComments(readFileSync(file, "utf8"));
    for (const ch of cleaned) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined && cp >= 0x0080) {
        allChars.add(ch);
      }
    }
  }

  const sortByCp = (set) => [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join("");
  return {
    ascii: asciiChars.join(""),
    latinText: sortByCp(latinChars),
    fullText: sortByCp(allChars),
  };
}

function parseUnicodeRanges(css) {
  const covered = new Set();
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const part of m[1].split(",")) {
      const token = part.trim().replace(/^U\+/i, "");
      if (!token) continue;
      if (token.includes("-")) {
        const [startHex, endHex] = token.split("-");
        const start = Number.parseInt(startHex, 16);
        const end = Number.parseInt(endHex, 16);
        for (let cp = start; cp <= end; cp++) covered.add(cp);
      } else {
        covered.add(Number.parseInt(token, 16));
      }
    }
  }
  return covered;
}

async function fetchSubsetWoff2({ filename, familyQuery, text }) {
  const url = `https://fonts.googleapis.com/css2?family=${familyQuery}&text=${encodeURIComponent(text)}&display=swap`;
  const cssRes = await fetch(url, { headers: { "User-Agent": CHROME_UA } });
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSS request failed (${cssRes.status}) for ${filename}: ${await cssRes.text()}`);
  }
  const css = await cssRes.text();
  const urls = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/^['"]|['"]$/g, "")))];
  if (urls.length === 0) {
    throw new Error(`No woff2 URL found in CSS for ${filename}:\n${css}`);
  }
  if (urls.length > 1) {
    throw new Error(`Expected 1 woff2 URL for ${filename}, got ${urls.length}:\n${css}`);
  }

  const fontRes = await fetch(urls[0], { headers: { "User-Agent": CHROME_UA } });
  if (!fontRes.ok) {
    throw new Error(`Font binary download failed (${fontRes.status}) for ${filename}`);
  }
  const buf = Buffer.from(await fontRes.arrayBuffer());
  if (buf.length === 0 || buf.subarray(0, 4).toString("ascii") !== "wOF2") {
    throw new Error(`Invalid woff2 binary for ${filename} (bytes=${buf.length}, magic=${buf.subarray(0, 4).toString("hex")})`);
  }

  const covered = parseUnicodeRanges(css);
  const missing = [...text].filter((ch) => !covered.has(ch.codePointAt(0)));
  const dest = join(FONTS_DIR, filename);
  writeFileSync(dest, buf);

  return { filename, bytes: buf.length, missing, css };
}

async function main() {
  mkdirSync(FONTS_DIR, { recursive: true });
  const { latinText, fullText } = collectGlyphSets();
  console.log(`Collected ${fullText.length} unique characters (${latinText.length} Latin/symbol chars).`);

  const specs = [
    { filename: "NotoSerifSC-v3.woff2", familyQuery: "Noto+Serif+SC:wght@700", text: fullText },
    { filename: "NotoSansSC-v3.woff2", familyQuery: "Noto+Sans+SC:wght@500..600", text: fullText },
    { filename: "ZhiMangXing-v3.woff2", familyQuery: "Zhi+Mang+Xing", text: fullText },
    { filename: "Montserrat-v3.woff2", familyQuery: "Montserrat:wght@500..800", text: latinText },
    { filename: "SourceSerif4-v3.woff2", familyQuery: "Source+Serif+4:opsz,wght@8..60,700", text: latinText },
    { filename: "SourceSerif4-Italic-v3.woff2", familyQuery: "Source+Serif+4:ital,opsz,wght@1,8..60,700", text: latinText },
    { filename: "PlayfairDisplay-Italic-v3.woff2", familyQuery: "Playfair+Display:ital,wght@1,700", text: latinText },
    { filename: "BodoniModa-v3.woff2", familyQuery: "Bodoni+Moda:opsz,wght@6..96,900", text: latinText },
  ];

  const results = [];
  for (const spec of specs) {
    const r = await fetchSubsetWoff2(spec);
    results.push(r);
    const missNote = r.missing.length ? ` (lacks: ${r.missing.join("")})` : "";
    console.log(`  [OK] ${r.filename}: ${r.bytes} bytes (${(r.bytes / 1024).toFixed(1)} KB)${missNote}`);
  }

  for (const entry of readdirSync(FONTS_DIR)) {
    if (entry.endsWith(".ttf") || entry.endsWith(".subset.woff2")) {
      rmSync(join(FONTS_DIR, entry), { force: true });
      console.log(`  [DEL] ${entry}`);
    }
  }

  let totalBytes = 0;
  console.log("\nFinal site/public/fonts/ contents:");
  for (const entry of readdirSync(FONTS_DIR).sort()) {
    const size = statSync(join(FONTS_DIR, entry)).size;
    totalBytes += size;
    console.log(`  - ${entry}: ${size} bytes (${(size / 1024).toFixed(2)} KB)`);
  }
  console.log(`Total fonts dir size: ${totalBytes} bytes (${(totalBytes / 1024).toFixed(2)} KB)`);

  if (totalBytes >= MAX_TOTAL_BYTES) {
    throw new Error(`Total fonts dir size ${totalBytes} exceeds ${MAX_TOTAL_BYTES} bytes (450 KB)!`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
