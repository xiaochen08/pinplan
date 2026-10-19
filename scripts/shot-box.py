"""按绝对坐标截取屏幕区域（开发自检用）。

用法：python scripts/shot-box.py out.png x y w h
"""

import sys

from PIL import ImageGrab

out = sys.argv[1]
x, y, w, h = (int(v) for v in sys.argv[2:6])

img = ImageGrab.grab(all_screens=True)
img.crop((x, y, x + w, y + h)).save(out)
print(f"saved {out} from box=({x},{y},{x + w},{y + h}) screen={img.size}")
