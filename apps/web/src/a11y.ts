// 单选组（role="radiogroup"）的键盘操作：方向键在选项间移动并直接选中，Home/End 到头尾。
// 配合 radioTabIndex 做「只有选中项在 Tab 序列里」，整组只占一个 Tab 停留点。
import type { KeyboardEvent } from "react";

export function radioKeys(e: KeyboardEvent<HTMLElement>) {
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)')];
  if (radios.length === 0) return;
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  let next: number | null = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % radios.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + radios.length) % radios.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = radios.length - 1;
  if (next === null) return;
  e.preventDefault();
  radios[next].focus();
  radios[next].click();
}

/** 选中项可 Tab 到；整组都没选中时第一项可 Tab 到 */
export function radioTabIndex(checked: boolean, index: number, anyChecked: boolean): 0 | -1 {
  return checked || (!anyChecked && index === 0) ? 0 : -1;
}
