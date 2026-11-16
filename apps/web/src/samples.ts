// 内置示例：完整示例、长短样本、按岗位的示例。全部为虚构人物与经历
import type { RuyeDocument } from "../../../packages/schema/src/index.ts";
import type { MenuItem } from "./components/Menu.tsx";
import fullSample from "../../../fixtures/full.ruye.json";
import shortSample from "../../../fixtures/short.ruye.json";
import mediumSample from "../../../fixtures/medium.ruye.json";
import longSample from "../../../fixtures/long.ruye.json";
import roleGo from "../../../fixtures/role-go.ruye.json";
import roleFrontend from "../../../fixtures/role-frontend.ruye.json";
import roleTestdev from "../../../fixtures/role-testdev.ruye.json";
import roleAlgo from "../../../fixtures/role-algo.ruye.json";
import rolePm from "../../../fixtures/role-pm.ruye.json";

export const SAMPLES: Record<string, RuyeDocument> = {
  full: fullSample as RuyeDocument,
  short: shortSample as RuyeDocument,
  medium: mediumSample as RuyeDocument,
  long: longSample as RuyeDocument,
  "role-go": roleGo as RuyeDocument,
  "role-frontend": roleFrontend as RuyeDocument,
  "role-testdev": roleTestdev as RuyeDocument,
  "role-algo": roleAlgo as RuyeDocument,
  "role-pm": rolePm as RuyeDocument,
};

/** 「文件」菜单里的示例项：key 形如 sample:<id> */
export const SAMPLE_MENU: MenuItem[] = [
  { key: "sample:full", label: "Java 后端", hint: "校招 · 经典", section: "从岗位示例新建" },
  { key: "sample:role-go", label: "Go 后端", hint: "社招 · 侧条" },
  { key: "sample:role-frontend", label: "前端开发", hint: "校招 · 经典" },
  { key: "sample:role-testdev", label: "测试开发", hint: "校招 · 极简" },
  { key: "sample:role-algo", label: "算法（大模型应用）", hint: "硕士 · 雅致" },
  { key: "sample:role-pm", label: "产品经理", hint: "校招 · 时间轴" },
  { key: "sample:short", label: "短样本", hint: "测试排版", section: "排版测试样本" },
  { key: "sample:medium", label: "中等样本", hint: "略超一页" },
  { key: "sample:long", label: "长样本", hint: "明显超页" },
];
