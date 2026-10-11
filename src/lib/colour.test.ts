import { describe, expect, it } from "vitest";
import { contrastRatio, readableShade } from "./colour";

const LIGHT = ["#F5F0E6", "#FBF8F2"];
const DARK = ["#1B1916", "#24211D"];

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("is 1 for a colour on itself", () => {
    expect(contrastRatio("#8A4B2A", "#8A4B2A")).toBe(1);
  });

  it("does not care about order", () => {
    expect(contrastRatio("#FFFFFF", "#8A4B2A")).toBe(contrastRatio("#8A4B2A", "#FFFFFF"));
  });

  it("puts #777777 on white just under 4.5", () => {
    const ratio = contrastRatio("#777777", "#FFFFFF");
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThan(4.4);
  });

  it("reads lower-case hex too", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});

describe("readableShade", () => {
  it("returns a colour that already passes unchanged", () => {
    expect(readableShade("#1E5E57", LIGHT)).toBe("#1E5E57");
  });

  it("darkens a light yellow on light paper until it passes", () => {
    const shade = readableShade("#F2C94C", LIGHT);
    expect(shade).not.toBe("#F2C94C");
    for (const bg of LIGHT) expect(contrastRatio(shade, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(shade, "#000000")).toBeLessThan(contrastRatio("#F2C94C", "#000000"));
  });

  it("lightens #8A4B2A on dark paper until it passes", () => {
    const shade = readableShade("#8A4B2A", DARK);
    expect(shade).not.toBe("#8A4B2A");
    for (const bg of DARK) expect(contrastRatio(shade, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(shade, "#FFFFFF")).toBeLessThan(contrastRatio("#8A4B2A", "#FFFFFF"));
  });

  it("stops at the first step that passes", () => {
    for (const [colour, bgs, towards] of [
      ["#F2C94C", LIGHT, "#000000"],
      ["#8A4B2A", DARK, "#FFFFFF"],
    ] as const) {
      const shade = readableShade(colour, [...bgs]);
      // Find the step it took, then check the step before fails.
      let step = 0;
      while (mixForTest(colour, towards, step / 100) !== shade) step++;
      expect(step).toBeGreaterThan(0);
      const before = mixForTest(colour, towards, (step - 1) / 100);
      expect(Math.min(...bgs.map((bg) => contrastRatio(before, bg)))).toBeLessThan(4.5);
    }
  });

  it("always returns # and six upper-case hex digits", () => {
    expect(readableShade("#8a4b2a", DARK)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

function mixForTest(colour: string, towards: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) => Math.round(channel(colour, i) + (channel(towards, i) - channel(colour, i)) * amount))
      .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}
