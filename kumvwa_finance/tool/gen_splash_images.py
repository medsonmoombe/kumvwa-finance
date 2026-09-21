"""Generates the native splash images from the brand spec in kumvwa_mark.svg.

Outputs (both transparent PNG, drawn at 3x then downsampled):
  assets/brand/splash_logo.png  -- mark + "Kumvwa" + "FINANCE" wordmark
                                  (used on iOS / Android < 12)
  assets/brand/splash_mark.png  -- circle-safe mark only, for the Android 12+
                                  system splash, which masks the icon to a
                                  circle and crops anything outside it.

Run from the project root:  python tool/gen_splash_images.py
Requires: Pillow (pip install pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "brand"

BLUE_600 = (26, 79, 191, 255)
BLUE_900 = (13, 44, 110, 255)
GREEN_700 = (30, 143, 85, 255)
GREEN_500 = (46, 204, 113, 255)
INK = (15, 17, 21, 255)

# Poppins ships with the app via google_fonts; fall back to Arial if absent.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/Poppins-SemiBold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
]


def _font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _disc(size: int) -> Image.Image:
    """The brand mark: gradient disc + growth bars + white arrow."""
    s = size * 3  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Radial-ish gradient disc (approximated with a vertical two-stop blend).
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(s):
        t = y / max(s - 1, 1)
        c = tuple(
            round(BLUE_600[i] + (BLUE_900[i] - BLUE_600[i]) * t) for i in range(4)
        )
        gd.line([(0, y), (s, y)], fill=c)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    img.paste(grad, (0, 0), mask)

    # Growth bars (left-to-right rising), matching kumvwa_mark.svg geometry.
    bar_w = s * 20 / 216
    gap = s * 10 / 216
    base_y = s * 0.72
    for i, h_frac in enumerate((0.34, 0.54, 0.78)):
        x0 = s * 0.30 + i * (bar_w + gap)
        top = base_y - s * h_frac
        d.rounded_rectangle(
            [x0, top, x0 + bar_w, base_y],
            radius=bar_w * 0.45,
            fill=GREEN_500 if h_frac == 0.78 else GREEN_700,
        )

    # White trend arrow.
    d.line(
        [s * 0.26, s * 0.72, s * 0.72, s * 0.30],
        fill=(255, 255, 255, 255),
        width=max(int(s * 0.045), 3),
    )
    # Arrowhead (triangle).
    d.polygon(
        [
            s * 0.80, s * 0.22,
            s * 0.70, s * 0.38,
            s * 0.62, s * 0.28,
        ],
        fill=(255, 255, 255, 255),
    )

    return img.resize((size, size), Image.LANCZOS)


def gen_logo(png_path: Path, width: int = 900) -> None:
    """Mark + wordmark lockup on transparency."""
    mark = 460
    s = 3
    w = width * s
    pad = 40 * s
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    disc = _disc(mark)
    img.paste(disc, ((w - disc.width) // 2, pad), disc)

    y = pad + disc.height + 70 * s
    f_word = _font(96 * s)
    text = "Kumvwa"
    tw = d.textlength(text, font=f_word)
    d.text(((w - tw) / 2, y), text, font=f_word, fill=INK)
    y += 130 * s

    f_sub = _font(40 * s)
    sub = "F I N A N C E"
    sw = d.textlength(sub, font=f_sub)
    d.text(((w - sw) / 2, y), sub, font=f_sub, fill=BLUE_600)

    out_h = y + 70 * s + pad
    cropped = img.crop((0, 0, w, out_h))
    cropped = cropped.resize(
        (width, round(out_h / s)), Image.LANCZOS
    )
    png_path.write_bytes(b"")
    cropped.save(png_path)


def gen_mark(png_path: Path, size: int = 768) -> None:
    """Circle-safe mark only (Android 12+ masks the splash icon to a circle)."""
    _disc(size).save(png_path)


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gen_logo(OUT_DIR / "splash_logo.png")
    gen_mark(OUT_DIR / "splash_mark.png")
    print(f"Wrote {OUT_DIR / 'splash_logo.png'}")
    print(f"Wrote {OUT_DIR / 'splash_mark.png'}")
