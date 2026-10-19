"""生成 PinPlan 图标源文件（1024x1024 PNG）。

深靛蓝渐变圆角方块 + 白色图钉字形，2048 超采样后降采样得到平滑边缘。
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

S = 2048
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src-tauri", "icon-source.png")

# ---------- 渐变底 ----------
top = np.array([124, 108, 252])   # #7C6CFC
bot = np.array([74, 58, 216])     # #4A3AD8
t = np.linspace(0.0, 1.0, S).reshape(S, 1, 1)
grad = (top * (1 - t) + bot * t).astype(np.uint8)
grad = np.repeat(grad, S, axis=1)

# 左上角柔和高光，让方块有“玻璃”体积感
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
glow = np.clip(1.0 - (xx * 0.9 + yy * 1.1), 0.0, 1.0) ** 2.2
grad = np.clip(grad.astype(np.float32) + glow[..., None] * 70.0, 0, 255).astype(np.uint8)

bg = Image.fromarray(grad, "RGB").convert("RGBA")

# ---------- 圆角遮罩 ----------
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)

canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
canvas.paste(bg, (0, 0), mask)

# ---------- 图钉字形 ----------
cx = S // 2
glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
g = ImageDraw.Draw(glyph)

head_r = int(S * 0.152)
head_cy = int(S * 0.375)
# 钉头
g.ellipse(
    [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
    fill=(255, 255, 255, 255),
)
# 钉身（上宽下窄的锥形）
g.polygon(
    [
        (cx - int(S * 0.052), head_cy + int(S * 0.108)),
        (cx + int(S * 0.052), head_cy + int(S * 0.108)),
        (cx + int(S * 0.030), int(S * 0.70)),
        (cx - int(S * 0.030), int(S * 0.70)),
    ],
    fill=(255, 255, 255, 255),
)
# 钉尖
g.polygon(
    [
        (cx - int(S * 0.030), int(S * 0.695)),
        (cx + int(S * 0.030), int(S * 0.695)),
        (cx, int(S * 0.86)),
    ],
    fill=(255, 255, 255, 255),
)

# 钉头内侧挖一个小孔，增强“图钉”辨识度
hole_r = int(S * 0.058)
g.ellipse(
    [cx - hole_r, head_cy - hole_r, cx + hole_r, head_cy + hole_r],
    fill=(90, 74, 230, 255),
)

# ---------- 字形阴影 ----------
shadow = glyph.split()[3].point(lambda a: int(a * 0.34))
shadow_img = Image.new("RGBA", (S, S), (24, 18, 60, 255))
shadow_img.putalpha(shadow)
shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(int(S * 0.018)))

canvas.alpha_composite(shadow_img, (0, int(S * 0.022)))
canvas.alpha_composite(glyph)

# ---------- 降采样 ----------
out = canvas.resize((1024, 1024), Image.LANCZOS)
out.save(OUT)
print("written:", OUT, out.size)
