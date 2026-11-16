// 预览 SVG 会被插进编辑器页面（innerHTML）。导入的文件可能来自别人，
// 所以在交给界面之前，把链接限制在 http、https、mailto 和页内锚点（#…）。
// innerHTML 不会执行 <script>，但 <a href="javascript:…"> 被点击时会执行，这里专门防这个。

const LINK_ATTR = /\s(xlink:href|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SAFE = /^(https?:|mailto:|#)/i;

export function sanitizeSvgLinks(svg: string): string {
  return svg.replace(LINK_ATTR, (all, attr: string, _q: string, dq: string | undefined, sq: string | undefined) => {
    const value = (dq ?? sq ?? "").trim();
    return SAFE.test(value) ? all : ` ${attr}="#"`;
  });
}
