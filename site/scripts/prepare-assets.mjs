// 把定稿素材拷进 public/（只读来源，不改 design/ 和 motion/）。重跑安全（幂等）。
// 用法：pnpm assets
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(SITE, "..");
const DESIGN = join(WT, "design");
const PUB = join(SITE, "public");
const mk = (p) => mkdirSync(p, { recursive: true });

// 1) 字体（只要精简好的 woff2 + OFL 许可；不拷 _old、_src）
mk(join(PUB, "fonts"));
for (const f of [
  "Montserrat-wght500-650.subset.woff2",
  "NotoSansSC-Medium.subset.woff2",
  "NotoSerifSC-Bold.subset.woff2",
  "SourceSerif4-725-opsz60.subset.woff2",
  "SourceSerif4-725Italic-opsz60.subset.woff2",
  "OFL-Montserrat.txt",
  "OFL-NotoSansSC.txt",
  "OFL-NotoSerifSC.txt",
  "OFL-SourceSerif4.txt",
]) cpSync(join(DESIGN, "fonts", f), join(PUB, "fonts", f));

// 2) 线稿、蝴蝶分层
mk(join(PUB, "assets"));
for (const f of [
  "framed-bg@3x.png",
  "butterfly-wing-left@3x.png",
  "butterfly-wing-right@3x.png",
  "butterfly-body@3x.png",
  "bouquet-lines@3x.png",
]) cpSync(join(DESIGN, "pages/assets", f), join(PUB, "assets", f));

// 3) 树 tree-v3：正式 3 倍分层 PNG（含 56px 出血）缩成 2 倍（plan §10.4：省显存），Lanczos，和动效原型同法
const TREE = join(DESIGN, "pages/assets/tree-v3");
const meta = JSON.parse(readFileSync(join(TREE, "layers.json"), "utf8"));
const outTree = join(PUB, "assets/tree");
mk(outTree);
const py = join(DESIGN, "tools/.venv/bin/python");
const jobs = meta.layers.map((l) => [join(TREE, l.png), join(outTree, `${l.id}.png`), Math.round(l.w * 2), Math.round(l.h * 2)]);
if (existsSync(py)) {
  // 用设计组已有的 venv（Pillow），不另装任何东西
  const code = `import sys,json\nfrom PIL import Image\nfor s,d,w,h in json.loads(sys.argv[1]):\n  Image.open(s).resize((w,h),Image.LANCZOS).save(d,optimize=True)`;
  execFileSync(py, ["-c", code, JSON.stringify(jobs)], { stdio: "inherit" });
} else {
  for (const [s, d, w, h] of jobs) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", s, "-vf", `scale=${w}:${h}:flags=lanczos`, d]);
}

// 4) 树的数据：位置 / 挂点来自 layers.json；「将落的花」detach 和零星飘落用的 drop/keep 来自动效原型的 layout.js
//    （由 motion/_work/build_tree.py 从同一份 layers.json + svg 解析出来）
const lj = readFileSync(join(WT, "motion/prototypes/tree-v3/layout.js"), "utf8");
const proto = JSON.parse(lj.slice(lj.indexOf("{"), lj.lastIndexOf("}") + 1));
const layout = {
  bleed: meta.bleed,
  layers: meta.layers.map((l) => ({ id: l.id, z: l.z, group: l.group, kind: l.kind, set: l.set, src: `${l.id}.png`, x: l.x, y: l.y, w: l.w, h: l.h })),
  groups: proto.groups,
};
for (const l of meta.layers) {
  const g = layout.groups[l.group];
  if (g && l.anchor && (g.anchor[0] !== l.anchor.x || g.anchor[1] !== l.anchor.y)) throw new Error(`挂点不一致：${l.id}`);
}
mk(join(SITE, "src/data"));
writeFileSync(join(SITE, "src/data/tree-layout.json"), JSON.stringify(layout));
console.log(`素材就绪：字体 9 个文件、线稿 5 张、树 ${meta.layers.length} 层`);
