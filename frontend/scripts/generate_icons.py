#!/usr/bin/env python3
"""
Draw the TobaccoScan app icons into `frontend/public/icons/`.

The icons are checked in, so this script exists to make them reproducible
rather than to run on every build: change the palette or the leaf geometry
here, re-run it, and every size regenerates consistently.

    python frontend/scripts/generate_icons.py

Two shapes are produced from the same drawing:

* `any`      — the leaf fills the tile, which is what Android, Chrome and
               desktop installers show as-is.
* `maskable` — the same leaf shrunk to ~60% of the tile, because the launcher
               may crop the icon to a circle, squircle or rounded square. Only
               the middle 80% of a maskable icon is guaranteed visible, so a
               full-bleed drawing loses its tips to the crop.

They are separate files on purpose. `"purpose": "any maskable"` on one file
tells the browser a single image is correct under both treatments, which is
only true for a drawing already padded for the crop — and that drawing then
looks small and lost everywhere else.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Brand palette, mirroring `leaf` in frontend/tailwind.config.ts.
LEAF_600 = (69, 104, 56)
LEAF_700 = (55, 83, 46)
LEAF_900 = (28, 41, 23)
LEAF_300 = (164, 190, 150)
LEAF_200 = (199, 217, 191)
PARCHMENT = (247, 243, 233)

ICON_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"

# Supersampling factor. Pillow has no antialiased polygon fill, so everything
# is drawn large and then reduced with LANCZOS, which gives clean curves.
SS = 8


def _bezier(points: list[tuple[float, float]], steps: int = 120):
    """Cubic bezier from 4 control points, as a flat list of samples."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = points
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
        out.append((a * x0 + b * x1 + c * x2 + d * x3,
                    a * y0 + b * y1 + c * y2 + d * y3))
    return out


def _leaf_outline(cx: float, cy: float, half_w: float, half_h: float):
    """
    The leaf silhouette from `components/ui/logo.tsx`, as a closed polygon.

    The SVG path is `M20 4 C 8 12, 6 28, 20 36 C 34 28, 32 12, 20 4 Z` on a
    40x40 viewBox: two mirrored curves meeting at tip and base. Control points
    are expressed as viewBox fractions so the shape survives any scaling.
    """
    def p(vx: float, vy: float) -> tuple[float, float]:
        return (cx + (vx - 20) / 20 * half_w, cy + (vy - 20) / 16 * half_h)

    left = _bezier([p(20, 4), p(8, 12), p(6, 28), p(20, 36)])
    right = _bezier([p(20, 36), p(34, 28), p(32, 12), p(20, 4)])
    return left + right


def _vertical_gradient(size: int, top: tuple[int, int, int],
                       bottom: tuple[int, int, int]) -> Image.Image:
    """A one-pixel-wide gradient stretched to `size` — cheap and smooth."""
    strip = Image.new("RGB", (1, size))
    px = strip.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return strip.resize((size, size), Image.BILINEAR)


def _draw_icon(size: int, *, maskable: bool) -> Image.Image:
    """Render one icon at `size` px."""
    s = size * SS

    # Background tile. Maskable icons must paint corner to corner: whatever the
    # launcher crops to, the ink has to reach past it. The `any` icon gets
    # rounded corners so it looks intentional on surfaces that do not mask.
    bg = _vertical_gradient(s, LEAF_600, LEAF_900).convert("RGBA")
    if not maskable:
        corners = Image.new("L", (s, s), 0)
        ImageDraw.Draw(corners).rounded_rectangle(
            [0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=255
        )
        bg.putalpha(corners)
    img = bg

    # 0.62 keeps the leaf inside the 80% safe zone with room to spare; 0.78
    # fills the tile for the unmasked icon while leaving the magnifier handle
    # clear of the rounded corner.
    scale = 0.62 if maskable else 0.78
    half_w = s * scale * 0.50
    half_h = s * scale * 0.50
    cx, cy = s / 2, s / 2

    # Translucent ink has to be composited, not drawn straight onto the tile:
    # ImageDraw replaces the destination pixels rather than blending with them,
    # so an alpha fill drawn directly lands as a flat opaque blob.
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    d.polygon(_leaf_outline(cx, cy, half_w, half_h), fill=PARCHMENT)

    # Midrib, tip to base.
    rib = max(2, int(s * 0.015))
    d.line(
        [(cx, cy - half_h + s * 0.030), (cx, cy + half_h - s * 0.030)],
        fill=LEAF_600,
        width=rib,
    )

    # Veins, mirrored off the midrib — the same three pairs as the logo.
    vein = max(1, int(s * 0.010))
    for vy, spread, drop in ((11.0, 8.0, 6.0), (19.0, 7.5, 6.0), (27.0, 6.0, 5.0)):
        y0 = cy + (vy - 20) / 16 * half_h
        y1 = cy + (vy + drop - 20) / 16 * half_h
        dx = spread / 20 * half_w
        for direction in (-1, 1):
            d.line([(cx, y0), (cx + direction * dx, y1)], fill=LEAF_300, width=vein)

    img = Image.alpha_composite(img, layer)

    # A magnifier over the lower leaf: this app inspects leaves, and the bare
    # silhouette alone reads as a generic plant app at 48 px.
    glass = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(glass)
    r = s * scale * 0.26
    gx, gy = cx + half_w * 0.26, cy + half_h * 0.24
    ring = max(3, int(s * 0.030))
    handle = r * 0.62
    hx, hy = gx + r * 0.72, gy + r * 0.72
    g.line([(hx, hy), (hx + handle, hy + handle)], fill=LEAF_900,
           width=int(ring * 1.25))
    g.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(*LEAF_200, 105),
              outline=LEAF_900, width=ring)
    img = Image.alpha_composite(img, glass)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    written: list[str] = []

    for size in (192, 512):
        path = ICON_DIR / f"icon-{size}.png"
        _draw_icon(size, maskable=False).save(path, "PNG", optimize=True)
        written.append(path.name)

    for size in (192, 512):
        path = ICON_DIR / f"maskable-{size}.png"
        _draw_icon(size, maskable=True).save(path, "PNG", optimize=True)
        written.append(path.name)

    # iOS ignores the manifest icons and reads <link rel="apple-touch-icon">.
    # It also composites onto black, so the tile is flattened onto the brand
    # green rather than left transparent.
    apple = _draw_icon(180, maskable=False).convert("RGBA")
    flat = Image.new("RGB", apple.size, LEAF_700)
    flat.paste(apple, mask=apple.split()[3])
    flat.save(ICON_DIR / "apple-touch-icon.png", "PNG", optimize=True)
    written.append("apple-touch-icon.png")

    # Browser tab favicon, multi-resolution.
    ico = _draw_icon(64, maskable=False)
    ico.save(ICON_DIR / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    written.append("favicon.ico")

    print(f"Wrote {len(written)} icons to {ICON_DIR}:")
    for name in written:
        print(f"  {name}")


if __name__ == "__main__":
    main()
