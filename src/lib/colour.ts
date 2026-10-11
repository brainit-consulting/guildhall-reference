// Colour arithmetic for the accent. No imports, so the CSS check and anything else can use it.

// WCAG 2's minimum for body text.
const MIN_RATIO = 4.5;

function channels(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  return [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)) as [number, number, number];
}

function toHex(rgb: number[]): string {
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("");
}

// WCAG 2 relative luminance.
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio of two #RRGGBB colours, from 1 to 21; order doesn't matter. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The colour itself if it reaches 4.5:1 against every background; otherwise the first shade of it that does,
 * mixed 1% at a time towards black on light backgrounds or white on dark ones.
 */
export function readableShade(colour: string, backgrounds: string[]): string {
  const from = channels(colour);
  // Below about 0.18 luminance, white contrasts more than black does.
  const dark = backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length < 0.18;
  const towards = dark ? 255 : 0;
  for (let step = 0; step <= 100; step++) {
    const shade = toHex(from.map((c) => Math.round(c + (towards - c) * (step / 100))));
    if (backgrounds.every((bg) => contrastRatio(shade, bg) >= MIN_RATIO)) return shade;
  }
  // Pure black or white failed too: the backgrounds themselves are mid-grey. Give the stronger extreme.
  return toHex([towards, towards, towards]);
}
