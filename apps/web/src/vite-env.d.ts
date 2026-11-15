/// <reference types="vite/client" />

declare module "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs" {
  export const $typst: import("../../../packages/engine/src/index.ts").TypstSnippetLike;
  export const TypstSnippet: import("../../../packages/engine/src/index.ts").TypstSnippetStatics;
}
