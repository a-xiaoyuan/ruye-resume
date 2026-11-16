// 终端皮肤底部的状态栏：在输入框里时是 INSERT，否则 NORMAL；右边是真实状态，不放假数据
import { useEffect, useState } from "react";

export function StatusBar({ items }: { items: string[] }) {
  const [insert, setInsert] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.activeElement;
      setInsert(!!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && !!el.closest(".editor"));
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", () => requestAnimationFrame(check));
    return () => {
      document.removeEventListener("focusin", check);
    };
  }, []);
  return (
    <footer className="statusbar" aria-hidden="true">
      <span className={`status-mode${insert ? " insert" : ""}`}>{insert ? "INSERT" : "NORMAL"}</span>
      <span className="status-items">
        {items.filter(Boolean).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </span>
    </footer>
  );
}
