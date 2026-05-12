from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "imagegen" / "enemy-set" / "first-floor-preview.png"

ITEMS = [
    ("BUG", ROOT / "img" / "enemies" / "bug.png"),
    ("Error", ROOT / "img" / "enemies" / "error.png"),
    ("回环", ROOT / "img" / "enemies" / "loop.png"),
    ("岔路", ROOT / "img" / "enemies" / "branch.png"),
]


def load_font(size):
    for name in ["msyh.ttc", "arial.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def checker(size, tile=24):
    img = Image.new("RGBA", size, (19, 25, 35, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                d.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(28, 36, 49, 255))
    return img


def main():
    font = load_font(34)
    w, h = 980, 560
    cell_w, cell_h = 230, 470
    out = Image.new("RGBA", (w, h), (10, 14, 21, 255))
    d = ImageDraw.Draw(out)
    d.text((32, 26), "第一层怪物风格预览", fill=(230, 237, 243), font=font)

    for i, (name, path) in enumerate(ITEMS):
        x = 25 + i * 240
        y = 76
        bg = checker((cell_w, cell_h), 20)
        out.alpha_composite(bg, (x, y))
        d.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=14, outline=(72, 103, 140), width=2)
        img = Image.open(path).convert("RGBA")
        img.thumbnail((190, 330), Image.Resampling.LANCZOS)
        out.alpha_composite(img, (x + (cell_w - img.width) // 2, y + 48 + (330 - img.height) // 2))
        label_w = d.textlength(name, font=font)
        d.text((x + (cell_w - label_w) / 2, y + 390), name, fill=(174, 246, 195), font=font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
