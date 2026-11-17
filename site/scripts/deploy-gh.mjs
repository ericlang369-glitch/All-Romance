// Packages site/out/ to GitHub Pages root (/) + .nojekyll + clean site/ source and pushes to origin main.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(SITE, "out");
const REPO_URL = "https://github.com/ericlang369-glitch/All-Romance.git";
const STAGE = join(SITE, "..", "..", `.tmp_gh_deploy_${Date.now()}`);

if (!existsSync(join(OUT, "index.html"))) {
  throw new Error("out/index.html missing — run build with NEXT_PUBLIC_BASE_PATH=/All-Romance first.");
}

const git = (args, cwd = STAGE) => execFileSync("git", args, { cwd, stdio: "inherit" });

try {
  execFileSync("git", ["clone", "--depth", "1", REPO_URL, STAGE], { stdio: "inherit" });
  git(["config", "user.name", "ericlang369-glitch"]);
  git(["config", "user.email", "ericlang369-glitch@users.noreply.github.com"]);
  git(["config", "http.postBuffer", "524288000"]);

  // Clean existing working tree files (keep .git)
  for (const name of readdirSync(STAGE)) {
    if (name === ".git") continue;
    rmSync(join(STAGE, name), { recursive: true, force: true });
  }

  // Copy static Next.js export to repo root for GitHub Pages (/)
  for (const name of readdirSync(OUT)) {
    cpSync(join(OUT, name), join(STAGE, name), { recursive: true });
  }

  // Disable Jekyll so /_next/static/* serves cleanly without 404
  writeFileSync(join(STAGE, ".nojekyll"), "", "utf8");

  // Include clean Next.js source under site/ (assets/fonts/photos live at root /)
  const stageSite = join(STAGE, "site");
  mkdirSync(stageSite, { recursive: true });
  for (const dirName of ["src", "scripts"]) {
    cpSync(join(SITE, dirName), join(stageSite, dirName), { recursive: true });
  }
  for (const fileName of ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]) {
    if (existsSync(join(SITE, fileName))) {
      cpSync(join(SITE, fileName), join(stageSite, fileName));
    }
  }

  writeFileSync(
    join(STAGE, "README.md"),
    `# All-Romance · 100 Days

- Live site: https://ericlang369-glitch.github.io/All-Romance/
- Day-100 preview: https://ericlang369-glitch.github.io/All-Romance/?now=2026-12-03T00%3A00%3A00%2B08%3A00

> Static output from \`site/\` (built with \`NEXT_PUBLIC_BASE_PATH=/All-Romance\`) is published directly at the repository root alongside \`.nojekyll\`; shared \`assets/\`, \`fonts/\`, and \`photos/\` sit at root to avoid duplicate uploads.
`,
    "utf8",
  );

  git(["add", "-A"]);
  git(["commit", "-m", "Deploy 100-day anniversary interactive site"]);
  git(["push", "origin", "main"]);
  console.log("Pushed cleanly to", REPO_URL);
} finally {
  try {
    rmSync(STAGE, { recursive: true, force: true });
  } catch {}
}
