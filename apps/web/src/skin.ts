// 编辑器界面：浅色 / 深色。只换编辑器的外观，不影响简历本身（简历的样子由「外观」里的模板决定）

export type Skin = "paper" | "dark";

export const SKINS: { key: Skin; label: string; hint: string }[] = [
  { key: "paper", label: "浅色", hint: "白天、明亮环境" },
  { key: "dark", label: "深色", hint: "夜里、暗环境" },
];

const KEY = "ruye.skin";

export function loadSkin(): Skin {
  try {
    const v = localStorage.getItem(KEY);
    // 只有自己选过「深色」才用深色；旧版本的「终端」「稿纸」「撞色」一律回到浅色
    return v === "dark" ? "dark" : "paper";
  } catch {
    return "paper";
  }
}

export function saveSkin(s: Skin) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    // 存不了就只在这次打开里生效
  }
}
