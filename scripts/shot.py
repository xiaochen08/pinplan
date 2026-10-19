"""截取 PinPlan 主窗区域的屏幕截图（开发自检用）。

从 window.json 读取窗口位置，只裁剪窗口附近区域，避免抓取整个桌面。
"""

import json
import os
import sys

from PIL import ImageGrab

appdata = os.path.join(os.environ["APPDATA"], "com.pinplan.desktop")
state_path = os.path.join(appdata, "window.json")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.getcwd(), "shot.png")
pad = int(sys.argv[2]) if len(sys.argv) > 2 else 20

with open(state_path, encoding="utf-8") as fh:
    st = json.load(fh)

box = (
    st["x"] - pad,
    st["y"] - pad,
    st["x"] + st["w"] + pad,
    st["y"] + st["h"] + pad,
)

img = ImageGrab.grab(all_screens=True)
print("virtual screen:", img.size, "crop:", box)
img.crop(box).save(out)
print("saved:", out)
