// A company's monogram (ADR-0052): its initial on a tile whose hue comes
// from the name, so the same company always gets the same color and a list
// of companies reads as varied. The hash is the v2 mockup's own, so the
// colors match the approved design.

const HUE_TURN = 360;
const HASH_FACTOR = 31;

export function monogramHue(name: string): number {
  let hue = 0;
  for (const char of name) {
    hue = (hue * HASH_FACTOR + (char.codePointAt(0) ?? 0)) % HUE_TURN;
  }
  return hue;
}

// The first letter or digit, capitalized the Turkish way (i becomes İ).
export function monogramInitial(name: string): string {
  const first = Array.from(name).find((char) => /[\p{L}\p{N}]/u.test(char));
  return first ? first.toLocaleUpperCase("tr") : "";
}
