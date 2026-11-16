// 界面用的线性小图标（原创，24×24，跟随文字颜色）
import type { ModuleType } from "../../../../packages/schema/src/index.ts";

const PATHS: Record<string, string> = {
  basic_info: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5",
  job_intention: "M12 3v3m0 12v3M3 12h3m12 0h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  education: "M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Zm4 2.2v4.3c1.4 1.4 3.3 2.2 5.5 2.2s4.1-.8 5.5-2.2v-4.3M21.5 9v5",
  work: "M4 8h16v11H4zM9 8V5.5h6V8M4 13h16",
  internship: "M4 8h16v11H4zM9 8V5.5h6V8M12 12v3",
  project: "M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z",
  skills: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z",
  research: "M10 4h4M11 4v5.5L5.5 18a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L13 9.5V4M7.5 15h9",
  paper: "M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6",
  award: "M12 14.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM8.6 13.3 7.2 21l4.8-2.4 4.8 2.4-1.4-7.7",
  summary: "m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.7M6.5 7.4A17 17 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  sort: "M7 4v16m0 0-3-3m3 3 3-3M14 6h6M14 12h4M14 18h2",
  check: "m5 12.5 4.5 4.5L19 7.5",
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  cloud: "M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 18.5Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5",
};

export function Icon({ name, size = 16, strokeWidth = 1.8 }: { name: keyof typeof PATHS | ModuleType; size?: number; strokeWidth?: number }) {
  const big = name === "grip";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={big ? 3 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.project} />
    </svg>
  );
}
