"""Generates the native splash images from the brand lockup artwork.

Source:  assets/brand/kumvwa_finance.png -- the KUMVWA FINANCE lockup (tagline
         banner + wordmark) on a transparent 1600x900 sheet. The art is inset
         from the sheet's edges, so it is cropped to its artwork box first.

Outputs (both transparent PNG):
  assets/brand/splash_logo.png  -- the lockup on its own canvas, drawn centred
                                  on the splash colour: iOS, Android < 12, and
                                  the web splash.
  assets/brand/splash_mark.png  -- the same lockup on a square canvas, scaled to
                                  sit inside the circle the Android 12+ system
                                  splash masks its icon to, so nothing is
                                  cropped.

Regenerate the platform files afterwards:
  dart run flutter_native_splash:create

Run from the project root:  python tool/gen_splash_images.py
Requires: Pillow (pip install pillow)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
SOURCE = BRAND / "kumvwa_finance.png"

# The lockup's box inside the source sheet, in sheet pixels — read off the
# asset's alpha channel. Everything outside it is clear.
ARTWORK = (208, 214, 1129, 658)

# Source pixels land in the xxxhdpi bucket, so a 900px-wide lockup draws ~225dp
# wide on every density — the width the previous mark-based splash drew at.
LOGO_WIDTH = 900

# Android 12+ clips the icon to a circle centred in the middle two thirds of the
# canvas, so an image with no icon background is drawn on a 1152px canvas and
# its art must fit inside a 768px circle (flutter_native_splash's spec).
MARK_CANVAS = 1152
MARK_CIRCLE = MARK_CANVAS * 2 / 3


def _lockup() -> Image.Image:
    """The brand artwork, trimmed out of its sheet."""
    return Image.open(SOURCE).convert("RGBA").crop(ARTWORK)


def gen_logo(png_path: Path, width: int = LOGO_WIDTH) -> None:
    lockup = _lockup()
    height = round(lockup.height * width / lockup.width)
    lockup.resize((width, height), Image.LANCZOS).save(png_path)


def gen_mark(png_path: Path, canvas: int = MARK_CANVAS) -> None:
    """The lockup at the largest size that survives Android 12's circle mask.

    A w x h rectangle centred in a circle of diameter d fits when
    sqrt((w/2)^2 + (h/2)^2) <= d/2, which solves to w <= d / sqrt(1 + (h/w)^2).
    """
    lockup = _lockup()
    ratio = lockup.height / lockup.width
    # The 2px is slack for integer rounding once the art is centred.
    width = int(MARK_CIRCLE / (1 + ratio**2) ** 0.5) - 2
    height = int(width * ratio)

    canvas_img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    art = lockup.resize((width, height), Image.LANCZOS)
    canvas_img.paste(art, ((canvas - width) // 2, (canvas - height) // 2), art)
    canvas_img.save(png_path)


if __name__ == "__main__":
    gen_logo(BRAND / "splash_logo.png")
    gen_mark(BRAND / "splash_mark.png")
    print(f"Wrote {BRAND / 'splash_logo.png'}")
    print(f"Wrote {BRAND / 'splash_mark.png'}")
