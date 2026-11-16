# 重新生成模板选择器里的缩略图（apps/web/src/assets/templates/*.png）。
# 依赖：Node 22、Typst 依赖已安装、poppler（pdftoppm）、Pillow。
# 用法：python3 scripts/thumbs.py
import pathlib, subprocess
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/src/assets/templates"
OUT.mkdir(parents=True, exist_ok=True)
IDS = ["classic", "minimal", "elegant", "timeline", "campus-serif", "social-sans", "split-compact"]
for t in IDS:
    subprocess.run(["node", "scripts/render.ts", "full", t, "fit-a4"], cwd=ROOT, check=True, capture_output=True)
    png = OUT / t
    subprocess.run(["pdftoppm", "-png", "-scale-to-x", "280", "-scale-to-y", "-1", "-singlefile", str(ROOT / f"out/{t}-full-fit-a4.pdf"), str(png)], check=True)
    im = Image.open(f"{png}.png").convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    im.save(f"{png}.png", optimize=True)
    print("wrote", t)
