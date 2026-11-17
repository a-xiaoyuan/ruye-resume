// 预览 SVG 会被插进编辑器页面（innerHTML）。导入的文件可能来自别人，
// 所以在交给界面之前，把链接限制在 http、https、mailto 和页内锚点（#…）。
// innerHTML 不会执行 <script>，但 <a href="javascript:…"> 被点击时会执行，这里专门防这个。

const LINK_ATTR = /\s(xlink:href|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SAFE = /^(https?:|mailto:|#)/i;

// <image> 里的图片（页眉图标、证件照）是 Typst 内嵌的 data URL，必须保留，否则预览里图标和照片全是空白，
// 和导出的 PDF 不一致。只放行 <image> 元素上的 data:image/…；<a> 上的 data: 照样清掉。
const IMAGE_TAG = /<image\b[^>]*>/gi;
const SAFE_IMAGE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i;

function clean(fragment: string, allowImageData: boolean): string {
  return fragment.replace(LINK_ATTR, (all, attr: string, _q: string, dq: string | undefined, sq: string | undefined) => {
    const value = (dq ?? sq ?? "").trim();
    return SAFE.test(value) || (allowImageData && SAFE_IMAGE.test(value)) ? all : ` ${attr}="#"`;
  });
}

export function sanitizeSvgLinks(svg: string): string {
  let out = "";
  let last = 0;
  for (const m of svg.matchAll(IMAGE_TAG)) {
    out += clean(svg.slice(last, m.index), false) + clean(m[0], true);
    last = m.index! + m[0].length;
  }
  return out + clean(svg.slice(last), false);
}
