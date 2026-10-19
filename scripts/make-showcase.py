"""把小钉的四种形态拼成一张展示图（docs/edge-pin.png）。

前置：先跑一次状态抓拍，生成 .tmp/state-{tucked,icon,bubble,menu}.png
"""

import os

from PIL import Image, ImageDraw, ImageFont

BG = (13, 14, 18)
CARD = (20, 21, 27)
BORDER = (42, 44, 54)
TITLE = (232, 234, 240)
SUB = (124, 132, 148)
FOOT = (90, 96, 110)

W, H = 1200, 880
canvas = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(canvas)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"
    return ImageFont.truetype(path, size)


d.text((52, 38), "PinPlan · 边缘小钉", font=font(34, True), fill=TITLE)
d.text(
    (52, 94),
    "钉在屏幕左/右/上边缘的状态指示器 · 收起时只剩 14px 细条，鼠标碰上去弹簧展开",
    font=font(16),
    fill=SUB,
)

panels = [
    ("state-tucked.png", "① 收起态", "贴边 14px 细条，颜色 = 当前状态，呼吸脉动", 0),
    ("state-icon.png", "② 悬停展开", "42px 圆图标 + 数量角标 + 呼吸光晕，番茄钟在跑时外圈画进度环", 0),
    ("state-bubble.png", "③ 状态气泡", "悬停 400ms 后冒出一句话：几条在进行 / 专注还剩多久", 0),
    ("state-menu.png", "④ 右键菜单", "显隐主窗 · 记一条计划 · 记一个 BUG · 设置 · 退出", 56),
]

CW, CH = 540, 330
positions = [(52, 148), (608, 148), (52, 502), (608, 502)]

for (fname, label, desc, cut_bottom), (cx, cy) in zip(panels, positions):
    d.rounded_rectangle(
        [cx, cy, cx + CW, cy + CH], radius=18, fill=CARD, outline=BORDER, width=1
    )
    path = os.path.join(".tmp", fname)
    if not os.path.exists(path):
        continue
    shot = Image.open(path).convert("RGB")
    if cut_bottom:
        shot = shot.crop((0, 0, shot.width, max(1, shot.height - cut_bottom)))
    max_w, max_h = CW - 64, CH - 118
    sc = min(max_w / shot.width, max_h / shot.height, 2.4)
    nw, nh = max(1, int(shot.width * sc)), max(1, int(shot.height * sc))
    shot = shot.resize((nw, nh), Image.LANCZOS)
    img_x = cx + (CW - nw) // 2
    img_y = cy + 26 + (max_h - nh) // 2
    canvas.paste(shot, (img_x, img_y))
    d.text((cx + 28, cy + CH - 74), label, font=font(19, True), fill=TITLE)
    d.text((cx + 28, cy + CH - 44), desc, font=font(13), fill=SUB)

d.text(
    (52, H - 50),
    "PinPlan 0.1.0 · 完全本地 · 无账号无网络 · 常驻内存约 67 MB",
    font=font(13),
    fill=FOOT,
)

os.makedirs("docs", exist_ok=True)
canvas.save("docs/edge-pin.png")
print("saved docs/edge-pin.png", canvas.size)
