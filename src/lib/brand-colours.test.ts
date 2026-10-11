import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLOUR } from "./brand";
import { contrastRatio, readableShade } from "./colour";

// The accent in globals.css is BRAND_COLOUR shaded for each mode. If someone changes the brand colour and forgets
// the CSS, or edits the CSS by hand, this goes red.
const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

function block(selector: RegExp): Record<string, string> {
  const match = css.match(new RegExp(selector.source + String.raw`\s*\{([^}]*)\}`));
  if (!match) throw new Error(`No ${selector} block in globals.css`);
  return Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const modes = {
  light: block(/:root,\s*\.light/),
  "dark (prefers-color-scheme)": block(/:root:not\(\.light\)/),
  "dark (.dark)": block(/\n\.dark/),
};

describe.each(Object.entries(modes))("%s", (_, tokens) => {
  const backgrounds = [tokens.paper, tokens.panel];

  it("uses BRAND_COLOUR shaded for its paper and panel as the accent", () => {
    expect(tokens.accent.toUpperCase()).toBe(readableShade(BRAND_COLOUR, backgrounds));
  });

  // Accent text on paper or panel, and paper text on an accent button, are the same pairs.
  it("keeps the accent at 4.5:1 or more against paper and panel", () => {
    for (const bg of backgrounds) expect(contrastRatio(tokens.accent, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps danger at 4.5:1 or more against paper and panel", () => {
    for (const bg of backgrounds) expect(contrastRatio(tokens.danger, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

it("gives both dark blocks the same tokens", () => {
  expect(modes["dark (prefers-color-scheme)"]).toEqual(modes["dark (.dark)"]);
});
