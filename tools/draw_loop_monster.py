from math import cos, pi, sin
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "concepts" / "loop-monster-handdrawn.png"
SIZE = 768
CENTER = SIZE // 2


def add_glow(base, layer, radius=10, alpha=180):
    glow = layer.filter(ImageFilter.GaussianBlur(radius))
    if alpha < 255:
        mask = glow.getchannel("A").point(lambda p: int(p * alpha / 255))
        glow.putalpha(mask)
    base.alpha_composite(glow)
    base.alpha_composite(layer)


def ellipse_points(cx, cy, rx, ry, start, end, steps=150):
    pts = []
    if end < start:
        end += 2 * pi
    for i in range(steps + 1):
        t = start + (end - start) * i / steps
        pts.append((cx + cos(t) * rx, cy + sin(t) * ry))
    return pts


def draw_arc(layer, bbox, start, end, color, width):
    draw = ImageDraw.Draw(layer)
    pts = ellipse_points(
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
        (bbox[2] - bbox[0]) / 2,
        (bbox[3] - bbox[1]) / 2,
        start,
        end,
    )
    draw.line(pts, fill=color, width=width, joint="curve")
    return pts


def draw_arrow_head(draw, tip, angle, color, scale=1.0):
    x, y = tip
    back = 38 * scale
    side = 24 * scale
    left = (
        x - cos(angle) * back + cos(angle + pi / 2) * side,
        y - sin(angle) * back + sin(angle + pi / 2) * side,
    )
    right = (
        x - cos(angle) * back + cos(angle - pi / 2) * side,
        y - sin(angle) * back + sin(angle - pi / 2) * side,
    )
    draw.polygon([tip, left, right], fill=color)


def draw_shard(draw, x, y, size, color, rot):
    pts = []
    for i, r in enumerate([1.0, 0.42, 0.82, 0.35]):
        a = rot + i * pi / 2
        pts.append((x + cos(a) * size * r, y + sin(a) * size * r))
    draw.polygon(pts, fill=color)


def main():
    random.seed(7)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((196, 606, 572, 704), fill=(0, 0, 0, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))

    back = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back)
    for r, a in [(250, 32), (190, 44), (128, 58)]:
        bd.ellipse((CENTER - r, CENTER - r, CENTER + r, CENTER + r), fill=(51, 196, 255, a))
    img.alpha_composite(back.filter(ImageFilter.GaussianBlur(34)))

    rings = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rings)
    arc1 = draw_arc(rings, (154, 176, 616, 554), -2.65, 0.52, (105, 241, 255, 230), 42)
    arc2 = draw_arc(rings, (168, 236, 598, 608), 0.48, 3.73, (157, 99, 255, 225), 42)
    draw_arrow_head(rd, arc1[-1], 0.88, (105, 241, 255, 245), 1.1)
    draw_arrow_head(rd, arc2[-1], 4.04, (157, 99, 255, 245), 1.1)
    for x, y in arc1[::18] + arc2[::18]:
        rd.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(230, 255, 255, 210))
    add_glow(img, rings, 16, 175)

    body = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    body_poly = [
        (344, 216), (424, 216), (486, 270), (522, 356),
        (500, 456), (432, 534), (336, 534), (268, 456),
        (246, 356), (282, 270)
    ]
    d.polygon(body_poly, fill=(12, 28, 45, 238))
    d.line(body_poly + [body_poly[0]], fill=(105, 241, 255, 240), width=6, joint="curve")
    inner_poly = [
        (346, 270), (422, 270), (466, 314), (480, 388),
        (444, 458), (384, 488), (324, 458), (288, 388),
        (302, 314)
    ]
    d.polygon(inner_poly, fill=(18, 44, 66, 236))
    d.line(inner_poly + [inner_poly[0]], fill=(97, 126, 255, 210), width=4)

    d.ellipse((330, 330, 438, 438), fill=(5, 14, 24, 250), outline=(178, 117, 255, 245), width=5)
    d.ellipse((360, 360, 408, 408), fill=(151, 252, 255, 255))
    d.ellipse((373, 370, 385, 390), fill=(6, 17, 25, 245))
    d.ellipse((393, 370, 405, 390), fill=(6, 17, 25, 245))
    d.arc((357, 386, 411, 426), 20, 160, fill=(178, 117, 255, 230), width=4)

    for x1, y1, x2, y2 in [
        (286, 330, 188, 288), (480, 330, 580, 288),
        (292, 442, 192, 504), (476, 442, 576, 504),
    ]:
        d.line((x1, y1, x2, y2), fill=(105, 241, 255, 180), width=7)
        d.ellipse((x2 - 22, y2 - 22, x2 + 22, y2 + 22), fill=(12, 28, 45, 230), outline=(105, 241, 255, 230), width=4)

    for x, y in [(330, 250), (438, 250), (270, 382), (498, 382), (338, 514), (430, 514)]:
        d.rectangle((x - 13, y - 13, x + 13, y + 13), fill=(9, 25, 38, 235), outline=(116, 248, 255, 230), width=3)
    add_glow(img, body, 9, 160)

    fx = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fx)
    for _ in range(62):
        a = random.random() * 2 * pi
        r = random.randint(145, 330)
        x = CENTER + cos(a) * r + random.randint(-16, 16)
        y = CENTER + sin(a) * r + random.randint(-16, 16)
        size = random.randint(5, 15)
        color = random.choice([
            (105, 241, 255, random.randint(95, 190)),
            (157, 99, 255, random.randint(80, 170)),
            (255, 80, 105, random.randint(70, 145)),
        ])
        draw_shard(fd, x, y, size, color, a + random.random())
    for _ in range(26):
        x = random.randint(190, 578)
        y = random.randint(160, 610)
        fd.line((x, y, x + random.randint(-36, 36), y + random.randint(-24, 24)), fill=(122, 248, 255, 105), width=2)
    img.alpha_composite(fx)

    crop = img.getbbox()
    if crop:
        padded = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        subject = img.crop(crop)
        subject.thumbnail((660, 660), Image.Resampling.LANCZOS)
        padded.alpha_composite(subject, ((SIZE - subject.width) // 2, (SIZE - subject.height) // 2))
        img = padded

    img.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
