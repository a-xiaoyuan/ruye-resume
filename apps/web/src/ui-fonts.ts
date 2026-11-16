// 界面直接使用简历本身的字体（思源黑体 / 思源宋体子集）：编辑区和纸上的字是同一套。
// 字体文件就是排版引擎用的那几个，浏览器会复用缓存，不额外下载。加载失败时退回系统字体。
const FILES = [
  { family: "Ruye Sans", file: "NotoSansSC-Regular.otf", weight: "400" },
  { family: "Ruye Sans", file: "NotoSansSC-Bold.otf", weight: "700" },
  { family: "Ruye Serif", file: "NotoSerifSC-Bold.otf", weight: "700" },
];

export function loadUiFonts(): void {
  if (typeof FontFace === "undefined" || !document.fonts) return;
  const base = new URL(import.meta.env.BASE_URL, window.location.href).href;
  for (const f of FILES) {
    const face = new FontFace(f.family, `url(${base}fonts/${f.file})`, { weight: f.weight, display: "swap" });
    face.load().then((loaded) => document.fonts.add(loaded)).catch(() => undefined);
  }
}
