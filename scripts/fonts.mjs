#!/usr/bin/env node
// pnpm fonts：下载思源（Noto CJK SC）字体并生成子集。
//
// 1. 下载 Noto Sans SC Regular/Bold、Noto Serif SC Bold（OFL-1.1）到 fonts-src/（不进 git）
//    已有本地字体时：RUYE_FONTS_DIR=/path/to/dir pnpm fonts，目录里放同名 .otf 即可
// 2. 若装了 fonttools（pip install fonttools），用 pyftsubset 裁成「ASCII + 常用符号 + GB2312 全部 6763 字」
//    没装则直接使用完整字体（体积大，但不缺字），并给出提示
// 3. 输出到 packages/templates/fonts/（Node 测试用）和 apps/web/public/fonts/（网页用），
//    同时写出 charset.txt（缺字检查用；完整字体时为空）
//
// 网络受限时：Node 22.21+ 可设置 NODE_USE_ENV_PROXY=1 让 fetch 走 HTTPS_PROXY。

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "fonts-src");
const outDirs = [join(root, "packages/templates/fonts"), join(root, "apps/web/public/fonts")];

const FONTS = [
  { file: "NotoSansSC-Regular.otf", path: "Sans/SubsetOTF/SC/NotoSansSC-Regular.otf" },
  { file: "NotoSansSC-Bold.otf", path: "Sans/SubsetOTF/SC/NotoSansSC-Bold.otf" },
  { file: "NotoSerifSC-Bold.otf", path: "Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf" },
];
const MIRRORS = [
  (p) => `https://raw.githubusercontent.com/notofonts/noto-cjk/main/${p}`,
  (p) => `https://raw.githubusercontent.com/googlefonts/noto-cjk/main/${p}`,
  (p) => `https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/${p}`,
];
const LICENSE_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE";

async function download(urls, dest) {
  const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
      console.log(`  ✓ ${url} (${(buf.length / 1048576).toFixed(1)} MB)`);
      return;
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  throw new Error(`下载失败：\n    ${errors.join("\n    ")}`);
}

/** ASCII、拉丁补充、通用标点、CJK 标点、全角符号、GB2312 一二级汉字与符号 */
function buildCharset() {
  const chars = new Set();
  const addRange = (a, b) => {
    for (let c = a; c <= b; c++) chars.add(String.fromCodePoint(c));
  };
  addRange(0x20, 0x7e);
  addRange(0xa0, 0xff);
  addRange(0x2000, 0x206f); // 通用标点：— ‘ ’ “ ” … •
  addRange(0x2190, 0x21ff); // 箭头
  addRange(0x2460, 0x24ff); // 带圈数字
  addRange(0x3000, 0x303f); // CJK 标点
  addRange(0xff00, 0xffef); // 全角
  const gbk = new TextDecoder("gbk");
  for (let hi = 0xa1; hi <= 0xf7; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) {
      const s = gbk.decode(new Uint8Array([hi, lo]));
      if (s && s !== "�") chars.add(s);
    }
  }
  return [...chars].join("");
}

function hasPyftsubset() {
  try {
    execFileSync("pyftsubset", ["--help"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  mkdirSync(srcDir, { recursive: true });
  const local = process.env.RUYE_FONTS_DIR;

  console.log("1/3 获取字体");
  for (const f of FONTS) {
    const dest = join(srcDir, f.file);
    if (existsSync(dest)) {
      console.log(`  · 已存在 ${f.file}`);
      continue;
    }
    if (local) {
      copyFileSync(join(local, f.file), dest);
      console.log(`  ✓ 从 ${local} 复制 ${f.file}`);
      continue;
    }
    await download(MIRRORS.map((m) => m(f.path)), dest);
  }
  const licenseDest = join(srcDir, "OFL.txt");
  if (!existsSync(licenseDest)) {
    try {
      await download([LICENSE_URL], licenseDest);
    } catch {
      console.warn("  ! 许可证下载失败，请手动放入 fonts-src/OFL.txt（SIL Open Font License 1.1）");
    }
  }

  console.log("2/3 生成子集");
  const charset = buildCharset();
  const subset = hasPyftsubset();
  const workDir = join(srcDir, "subset");
  mkdirSync(workDir, { recursive: true });
  const textFile = join(workDir, "charset.txt");
  writeFileSync(textFile, charset, "utf8");
  for (const f of FONTS) {
    const out = join(workDir, f.file);
    if (subset) {
      execFileSync("pyftsubset", [join(srcDir, f.file), `--text-file=${textFile}`, `--output-file=${out}`, "--layout-features=*", "--no-hinting", "--name-IDs=*", "--name-legacy"], { stdio: "inherit" });
      console.log(`  ✓ 子集 ${f.file}`);
    } else {
      copyFileSync(join(srcDir, f.file), out);
    }
  }
  if (!subset) {
    console.warn("  ! 没找到 pyftsubset，直接使用完整字体（不缺字，但网页首屏下载更大）。安装：pip install fonttools");
  }

  console.log("3/3 输出");
  for (const dir of outDirs) {
    mkdirSync(dir, { recursive: true });
    for (const f of FONTS) copyFileSync(join(workDir, f.file), join(dir, f.file));
    // 完整字体不需要缺字检查：charset 写空
    writeFileSync(join(dir, "charset.txt"), subset ? charset : "", "utf8");
    if (existsSync(licenseDest)) copyFileSync(licenseDest, join(dir, "OFL.txt"));
    console.log(`  ✓ ${dir}`);
  }
  console.log(`完成。子集字符数：${subset ? Array.from(charset).length : "（完整字体）"}`);
}

main().catch((e) => {
  console.error(`\n字体准备失败：${e.message}\n\n可以手动下载 ${FONTS.map((f) => f.file).join("、")}\n（来源：https://github.com/notofonts/noto-cjk 的 Sans/Serif → SubsetOTF/SC），\n放进同一个目录后运行：RUYE_FONTS_DIR=<目录> pnpm fonts`);
  process.exit(1);
});
