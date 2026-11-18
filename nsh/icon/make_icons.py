#!/usr/bin/env python3
"""Generate the app icon from code, so it stays reproducible.

The mark is a gold ticket stub with the play key punched out: the app hands you
a "ticket" for tonight's movie, and the play key is what you press to go watch
it. Geometry is deliberately fat — on a launcher the icon is drawn at 40-60 px,
so anything finer turns to mush.

Everything is drawn at 4x and downsampled once, so edges stay clean at 1024.

    uv run --with pillow python nsh/icon/make_icons.py
    uv run --with pillow python nsh/icon/make_icons.py --all DIR   # every variant
    uv run --with pillow python nsh/icon/make_icons.py --variant ring

iOS masks the icon itself (squircle), so the canvas is a full square with no
alpha and no rounded corners of its own.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 4  # supersample factor
W = SIZE * SS

# Palette, taken from the site's own CSS tokens.
GOLD_HI = (246, 219, 166)
GOLD_LO = (203, 152, 82)
BG_TOP = (26, 26, 35)
BG_BOT = (8, 8, 10)
INK = (9, 9, 13)


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background() -> Image.Image:
    """Vertical wash plus a soft glow behind the mark, so it isn't a flat slab."""
    img = Image.new("RGB", (W, W), BG_BOT)
    d = ImageDraw.Draw(img)
    for y in range(W):
        d.line([(0, y), (W, y)], fill=_lerp(BG_TOP, BG_BOT, y / W))

    glow = Image.new("L", (W, W), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy, r = W // 2, int(W * 0.48), int(W * 0.50)
    steps = 180
    for i in range(steps, 0, -1):
        rr = int(r * i / steps)
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=int(46 * (1 - i / steps) ** 1.7))
    glow = glow.filter(ImageFilter.GaussianBlur(W * 0.035))
    return Image.composite(Image.new("RGB", (W, W), (64, 55, 41)), img, glow)


def gold_gradient(size: tuple[int, int]) -> Image.Image:
    """Top-left to bottom-right ramp, so the flat shape reads as metal."""
    w, h = size
    grad = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(grad)
    for i in range(w + h):
        t = min(1.0, i / (w + h - 1) * 1.12)
        d.line([(i, 0), (0, i)], fill=_lerp(GOLD_HI, GOLD_LO, t))
    return grad


def fill_gold(base: Image.Image, mask: Image.Image) -> None:
    layer = Image.new("RGB", base.size, (0, 0, 0))
    layer.paste(gold_gradient(base.size), (0, 0))
    base.paste(layer, (0, 0), mask)


def fill_ink(base: Image.Image, mask: Image.Image) -> None:
    base.paste(Image.new("RGB", base.size, INK), (0, 0), mask)


def play_mask(cx: float, cy: float, h: float) -> Image.Image:
    """Play triangle pointing right, nudged right so it looks optically centred."""
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    w = h * 0.90
    cx += w * 0.11
    pts = [(cx - w / 2, cy - h / 2), (cx - w / 2, cy + h / 2), (cx + w / 2, cy)]
    d.polygon(pts, fill=255)
    return m


# ---------------------------------------------------------------- variants


def variant_ticket(bg: Image.Image) -> Image.Image:
    """Gold ticket stub with a half-circle bite on each side, play key punched out."""
    out = bg.copy()
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    x0, x1 = int(W * 0.075), int(W * 0.925)
    y0, y1 = int(W * 0.235), int(W * 0.765)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(W * 0.105), fill=255)
    nr = int(W * 0.098)
    cy = (y0 + y1) // 2
    for cx in (x0, x1):
        d.ellipse([cx - nr, cy - nr, cx + nr, cy + nr], fill=0)
    fill_gold(out, m)
    fill_ink(out, play_mask(W / 2, W / 2, W * 0.315))
    return out


def variant_ring(bg: Image.Image) -> Image.Image:
    """Gold ring, gold play key in the middle — boldest silhouette of the three."""
    out = bg.copy()
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    c = W / 2
    outer, inner = W * 0.435, W * 0.330
    d.ellipse([c - outer, c - outer, c + outer, c + outer], fill=255)
    d.ellipse([c - inner, c - inner, c + inner, c + inner], fill=0)
    fill_gold(out, m)
    fill_gold(out, play_mask(W / 2, W / 2, W * 0.310))
    return out


def variant_square(bg: Image.Image) -> Image.Image:
    """Rounded gold square with the play key punched out — closest to a system icon."""
    out = bg.copy()
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    x0, y0 = int(W * 0.115), int(W * 0.115)
    x1, y1 = int(W * 0.885), int(W * 0.885)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(W * 0.230), fill=255)
    fill_gold(out, m)
    fill_ink(out, play_mask(W / 2, W / 2, W * 0.345))
    return out


VARIANTS = {"ticket": variant_ticket, "ring": variant_ring, "square": variant_square}


def finish(img: Image.Image) -> Image.Image:
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", metavar="DIR", help="also write every variant into DIR")
    ap.add_argument("--variant", default="square", choices=sorted(VARIANTS))
    opts = ap.parse_args()

    bg = background()
    out_path = Path(__file__).resolve().parent.parent / "icon.png"

    for name, fn in VARIANTS.items():
        img = finish(fn(bg))
        if name == opts.variant:
            img.save(out_path)
            print(f"{name} -> {out_path}  {img.size[0]}x{img.size[1]}")
        if opts.all:
            d = Path(opts.all)
            d.mkdir(parents=True, exist_ok=True)
            img.save(d / f"{name}.png")
            img.resize((48, 48), Image.LANCZOS).save(d / f"{name}-48.png")


if __name__ == "__main__":
    main()
