"""按 dock.json 里记录的位置/形态，自动算出小钉窗口的屏幕区域并截图。

用法：python scripts/shot-dock.py 输出.png [scale]
"""

import json
import os
import sys

from PIL import ImageGrab

ICON, TUCK_T, TUCK_L, BUB = 56, 14, 44, 214
MENU_W, MENU_H = 168, 156
RIGHT_EDGE = 3840  # 主显示器右边界（物理像素）

scale = float(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].endswith(".png") else 1.8232
out = sys.argv[1] if sys.argv[1].endswith(".png") else sys.argv[2]

appdata = os.path.join(os.environ["APPDATA"], "com.pinplan.desktop")
with open(os.path.join(appdata, "dock.json"), encoding="utf-8") as fh:
    st = json.load(fh)

edge, offset, mode = st["edge"], st["offset"], st["mode"]

if mode == "tucked":
    w, h = (TUCK_L, TUCK_T) if edge == "top" else (TUCK_T, TUCK_L)
elif mode == "bubble":
    w, h = ICON + BUB, ICON
elif mode == "menu":
    w, h = (MENU_W + 16, ICON + MENU_H) if edge == "top" else (ICON + MENU_W + 24, MENU_H)
else:
    w, h = ICON, ICON

ax = -(w - ICON) / 2 if (edge == "top" and mode == "menu") else 0
ay = -(h - ICON) / 2 if (edge != "top" and mode == "menu") else 0

if edge == "left":
    x, y = 0, offset + ay * scale
elif edge == "top":
    x, y = offset + ax * scale, 0
else:
    x, y = RIGHT_EDGE - w * scale, offset + ay * scale

pad = 34
box = (
    max(0, int(x - pad)),
    max(0, int(y - pad)),
    int(x + w * scale + pad),
    int(y + h * scale + pad),
)

img = ImageGrab.grab(all_screens=True)
img.crop(box).save(out)
print(f"mode={mode} edge={edge} offset={offset} box={box} -> {out}")
