# 重新生成模板选择器里的缩略图（apps/web/src/assets/templates/*.png）。
# 依赖：Node 22、Typst 依赖已安装、poppler（pdftoppm）、Pillow。
# 用法：python3 scripts/thumbs.py
import hashlib, json, pathlib, subprocess
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/src/assets/templates"
OUT.mkdir(parents=True, exist_ok=True)
# 缩略图依赖的源文件。任何一个变了，tests/thumbs.test.ts 就会提示重新生成
INPUTS = ["packages/templates/typst/common.typ", "packages/templates/src/index.ts", "fixtures/full.ruye.json"]

def digest(paths):
    h = hashlib.sha256()
    for p in paths:
        h.update(p.encode()); h.update(b"\0"); h.update((ROOT / p).read_bytes().replace(b"\r\n", b"\n")); h.update(b"\0")
    return h.hexdigest()

IDS = ["classic", "minimal", "elegant", "timeline", "campus-serif", "social-sans", "split-compact"]
for t in IDS:
    subprocess.run(["node", "scripts/render.ts", "full", t, "fit-a4"], cwd=ROOT, check=True, capture_output=True)
    png = OUT / t
    subprocess.run(["pdftoppm", "-png", "-scale-to-x", "280", "-scale-to-y", "-1", "-singlefile", str(ROOT / f"out/{t}-full-fit-a4.pdf"), str(png)], check=True)
    im = Image.open(f"{png}.png").convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    im.save(f"{png}.png", optimize=True)
    print("wrote", t)

manifest = {t: digest(INPUTS + [f"packages/templates/typst/{t}.typ"]) for t in IDS}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print("wrote manifest.json")
