#!/usr/bin/env python3
"""Write the Android adaptive-icon resources that NSH doesn't produce.

`nsh package` embeds exactly one legacy PNG (`res/mipmap-xxxhdpi/ic_launcher.png`,
192 px). On Android 8+ a legacy icon is shrunk into the launcher's mask and
padded onto a system-coloured plate — measured on the emulator: the gold mark
ended up 68 px wide inside a 247 px cell, ringed by grey. That's what looked bad.

Why the layers are split this way
---------------------------------
The launcher draws two 108dp layers and then applies a mask of its own choosing
(circle on Pixel, squircle on Samsung, …). Anything drawn *as a shape* in the
foreground has its outline decided by that mask — a rounded square comes back
with its corners sliced off, which destroys the ticket silhouette.

So the gold goes in the background layer, full bleed: the mask trims it to
whatever shape the launcher uses (a gold disc on Pixel, a gold squircle on
Samsung) and no corners are lost. Only the play key — a small, mask-safe
element — sits in the foreground.

    uv run --with pillow python nsh/icon/make_android.py OUTDIR

Writes, under OUTDIR:
    res/mipmap-anydpi-v26/ic_launcher.xml
    res/drawable-*/ic_launcher_background.png    gold, full bleed
    res/drawable-*/ic_launcher_foreground.png    ink play key, transparent elsewhere
    res/mipmap-*/ic_launcher.png                 legacy fallback (API < 26)
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

# The adaptive icon canvas is 108dp; each layer is 108 * scale px.
DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}

GOLD_HI = (246, 219, 166)
GOLD_LO = (203, 152, 82)
INK = (9, 9, 13)

TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
"""


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gold_plate(size: int) -> Image.Image:
    """Full-bleed gold ramp. RGB on purpose — see note in `write()`."""
    img = Image.new("RGB", (size, size), GOLD_LO)
    d = ImageDraw.Draw(img)
    for i in range(size * 2):
        t = min(1.0, i / (size * 2 - 1) * 1.18)
        d.line([(i, 0), (0, i)], fill=_lerp(GOLD_HI, GOLD_LO, t))
    return img


def play_key(size: int) -> Image.Image:
    """Ink play triangle on transparency, centred.

    Kept inside the 66dp of the 108dp canvas that every mask is guaranteed to
    show, so no launcher can crop the tip.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    h = size * 0.44           # 47.5dp of 108dp — comfortably inside the safe zone
    w = h * 0.90
    cx, cy = size / 2, size / 2
    cx += w * 0.11            # optical centring: a triangle's mass sits left
    pts = [(cx - w / 2, cy - h / 2), (cx - w / 2, cy + h / 2), (cx + w / 2, cy)]
    d.polygon(pts, fill=(*INK, 255))
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir", help="directory to write res/ into")
    opts = ap.parse_args()

    out = Path(opts.outdir)
    base = 432  # 108dp at xxxhdpi
    plate = gold_plate(base)
    key = play_key(base)

    for bucket, scale in DENSITIES.items():
        size = round(108 * scale)

        d = out / "res" / f"drawable-{bucket}"
        d.mkdir(parents=True, exist_ok=True)
        plate.resize((size, size), Image.LANCZOS).save(d / "ic_launcher_background.png")
        key.resize((size, size), Image.LANCZOS).save(d / "ic_launcher_foreground.png")

        # Legacy fallback for API < 26: the plate with the key already punched
        # in, so it still reads as the same mark.
        m = out / "res" / f"mipmap-{bucket}"
        m.mkdir(parents=True, exist_ok=True)
        flat = plate.resize((size, size), Image.LANCZOS).convert("RGB")
        flat.paste(key.resize((size, size), Image.LANCZOS), (0, 0), key.resize((size, size), Image.LANCZOS))
        flat.save(m / "ic_launcher.png")

    xml_dir = out / "res" / "mipmap-anydpi-v26"
    xml_dir.mkdir(parents=True, exist_ok=True)
    (xml_dir / "ic_launcher.xml").write_text(TEMPLATE, encoding="utf-8")

    print(f"adaptive icon -> {out}/res  ({len(DENSITIES)} densities)")


if __name__ == "__main__":
    main()
