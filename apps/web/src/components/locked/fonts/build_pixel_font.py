# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools[woff]==4.60.1"]
# ///
"""Build TraceMail Pixel from Silkscreen (SIL OFL 1.1, see OFL.txt).

Silkscreen lacks İ, ı, Ş, ş, Ğ, ğ, and ↑, which the locked page's game uses.
They are added on Silkscreen's own 125-unit pixel grid: the cedilla is the
one Ç uses, the breve the two rows Silkscreen draws above Š and Å, the dot
one pixel at the height of Ö's dots. Renamed, as the OFL asks of modified
versions. Run: uv run build_pixel_font.py <Silkscreen-Regular.ttf>
"""

import logging
import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

PIXEL = 125
OUT = Path(__file__).parent / "TraceMailPixel.woff2"
FAMILY = "TraceMail Pixel"
IDENTITY = (1, 0, 0, 1, 0, 0)
# Silkscreen draws caron, ring, and breve as the same two rows (Š, Å).
BREVE = [(1, 7), (4, 7), (2, 6), (3, 6)]
DOT = [(1, 6)]
ARROW = [(3, 4), (2, 3), (3, 3), (4, 3), (1, 2), (3, 2), (5, 2), (3, 1), (3, 0)]

Transform = tuple[float, float, float, float, float, float]
Pixel = tuple[int, int]


def runs(pixels: list[Pixel]) -> list[tuple[int, int, int]]:
    """Pixels merged into horizontal runs: (row, first column, last column)."""
    rows: dict[int, list[int]] = {}
    for x, y in pixels:
        rows.setdefault(y, []).append(x)
    merged = []
    for y, xs in sorted(rows.items()):
        xs.sort()
        start = prev = xs[0]
        for x in xs[1:]:
            if x != prev + 1:
                merged.append((y, start, prev))
                start = x
            prev = x
        merged.append((y, start, prev))
    return merged


def draw_pixels(pen: TTGlyphPen, pixels: list[Pixel]) -> None:
    """Each run as a clockwise rectangle, as TrueType outer contours go."""
    for y, first, last in runs(pixels):
        x0, x1 = first * PIXEL, (last + 1) * PIXEL
        y0, y1 = y * PIXEL, (y + 1) * PIXEL
        pen.moveTo((x0, y0))
        pen.lineTo((x0, y1))
        pen.lineTo((x1, y1))
        pen.lineTo((x1, y0))
        pen.closePath()


def draw_glyph(font: TTFont, pen: TTGlyphPen, name: str, transform: Transform) -> None:
    glyphs = font.getGlyphSet()
    recording = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(recording)
    recording.replay(TransformPen(pen, transform))


def add_glyph(
    font: TTFont,
    name: str,
    code: int,
    parts: list[tuple[str, Transform]],
    pixels: list[Pixel],
    advance: int,
) -> None:
    pen = TTGlyphPen(font.getGlyphSet())
    for part, transform in parts:
        draw_glyph(font, pen, part, transform)
    draw_pixels(pen, pixels)
    font["glyf"][name] = pen.glyph()
    font["hmtx"][name] = (advance, PIXEL)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[code] = name


def add_turkish(font: TTFont) -> None:
    glyf, hmtx = font["glyf"], font["hmtx"]
    cedilla = next(c for c in glyf["Ccedilla"].components if c.glyphName == "uni0327")
    under = (1, 0, 0, 1, cedilla.x, cedilla.y)

    def width(name: str) -> int:
        return int(hmtx[name][0])

    add_glyph(font, "Idotaccent", 0x130, [("I", IDENTITY)], DOT, width("I"))
    add_glyph(font, "dotlessi", 0x131, [("i", IDENTITY)], [], width("i"))
    add_glyph(
        font, "Scedilla", 0x15E, [("S", IDENTITY), ("uni0327", under)], [], width("S")
    )
    add_glyph(
        font, "scedilla", 0x15F, [("s", IDENTITY), ("uni0327", under)], [], width("s")
    )
    add_glyph(font, "Gbreve", 0x11E, [("G", IDENTITY)], BREVE, width("G"))
    add_glyph(font, "gbreve", 0x11F, [("g", IDENTITY)], BREVE, width("g"))
    add_glyph(font, "arrowup", 0x2191, [], ARROW, 7 * PIXEL)
    font.setGlyphOrder(list(glyf.glyphOrder))


def rename(font: TTFont) -> None:
    for record in font["name"].names:
        if record.nameID in (1, 16):
            record.string = FAMILY
        elif record.nameID == 4:
            record.string = f"{FAMILY} Regular"
        elif record.nameID in (3, 6):
            record.string = "TraceMailPixel-Regular"
        elif record.nameID == 0:
            record.string = f"{record} Turkish letters and up arrow added, 2026."


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    font = TTFont(sys.argv[1])
    add_turkish(font)
    rename(font)
    font.flavor = "woff2"
    font.save(OUT)
    logging.info("Wrote %s (%d glyphs)", OUT.name, len(font.getGlyphOrder()))


if __name__ == "__main__":
    main()
