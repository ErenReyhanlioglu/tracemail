// Pixel drawing shared by the closed envelope and the game: the palette read
// from the site's theme tokens, and sprites drawn from rows of characters
// ('#' ink, 'm' muted, '.' paper, 'f' faint, 'a' accent). Kept small, since
// the closed envelope loads it on every locked page.

export type Rows = readonly string[];

export interface Palette {
  ink: string;
  muted: string;
  paper: string;
  accent: string;
  faint: string;
  line: string;
  danger: string;
  bg: string;
}

// The game's colour names, each mapped to a site token (globals.css). The
// tokens use light-dark(), which a canvas cannot parse, so each is resolved
// through a probe element's computed colour.
const TOKENS: Record<keyof Palette, string> = {
  ink: "--color-text",
  muted: "--color-text-muted",
  paper: "--color-surface",
  accent: "--logo-accent",
  faint: "--color-border",
  line: "--color-border",
  danger: "--color-game-hit",
  bg: "--color-page",
};

export function readPalette(host: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.hidden = true;
  host.append(probe);
  const resolve = (token: string): string => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  };
  const palette = Object.fromEntries(
    Object.entries(TOKENS).map(([name, token]) => [name, resolve(token)]),
  ) as unknown as Palette;
  probe.remove();
  return palette;
}

// The TraceMail mark: the flap converges into a line that leaves the envelope
// and ends in the blue dot.
export const LOGO: Rows = [
  "##############",
  "##..........##",
  "#.#........#.#",
  "#..#......#..#",
  "#...#....#...#",
  "#....#..#....#",
  "#.....##.....#",
  "#.....##.....#",
  "#.....##.....#",
  "##############",
  "      ##      ",
  "      ##      ",
  "      aa      ",
  "     aaaa     ",
  "     aaaa     ",
  "      aa      ",
];

function colourOf(ch: string, palette: Palette, tint: string | null): string | null {
  if (ch === "#") return tint ?? palette.ink;
  if (ch === "m") return tint ?? palette.muted;
  if (ch === ".") return palette.paper;
  if (ch === "f") return palette.faint;
  if (ch === "a") return palette.accent;
  return null;
}

export function sprite(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  rows: Rows,
  x: number,
  y: number,
  tint: string | null = null,
): void {
  const left = Math.round(x);
  const top = Math.round(y);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const colour = colourOf(row.charAt(i), palette, tint);
      if (colour) {
        ctx.fillStyle = colour;
        ctx.fillRect(left + i, top + j, 1, 1);
      }
    }
  });
}
