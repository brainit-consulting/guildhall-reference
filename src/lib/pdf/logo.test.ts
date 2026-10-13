import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO } from "@/lib/brand";
import { parseSvgLogo, readLogo } from "./logo";

describe("parseSvgLogo", () => {
  it("reads the viewBox and each shape's geometry and paint", () => {
    const logo = parseSvgLogo(`<?xml version="1.0"?><!-- mark --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" role="img">
      <title>Acme</title><rect width="200" height="100" fill="#8A4B2A" class="bg"/>
      <circle cx="50" cy="50" r="20" fill="#fff"></circle></svg>`);
    expect(logo).toEqual({
      kind: "svg", viewBox: "0 0 200 100", aspect: 2,
      shapes: [
        { tag: "rect", attrs: { width: "200", height: "100", fill: "#8A4B2A" } },
        { tag: "circle", attrs: { cx: "50", cy: "50", r: "20", fill: "#fff" } },
      ],
    });
  });

  it("passes a group's paint down to its shapes, which can override it", () => {
    const logo = parseSvgLogo(`<svg viewBox="0 0 10 10"><g fill="red" stroke="blue"><path d="M0 0h10"/><path d="M0 5h10" fill="green"/></g><path d="M0 9h10"/></svg>`);
    expect(logo?.shapes.map((s) => s.attrs)).toEqual([
      { fill: "red", stroke: "blue", d: "M0 0h10" },
      { fill: "green", stroke: "blue", d: "M0 5h10" },
      { d: "M0 9h10" },
    ]);
  });

  it("takes width and height when there is no viewBox", () => {
    expect(parseSvgLogo(`<svg width="64px" height="32px"><rect width="64" height="32"/></svg>`)?.viewBox).toBe("0 0 64 32");
  });

  it("refuses what it can't draw faithfully", () => {
    expect(parseSvgLogo(`<svg viewBox="0 0 10 10"><text>A</text></svg>`)).toBeNull();
    expect(parseSvgLogo(`<svg viewBox="0 0 10 10"><rect width="5" height="5" style="fill:red"/></svg>`)).toBeNull();
    expect(parseSvgLogo(`<svg viewBox="0 0 10 10"><g transform="scale(2)"><rect width="5" height="5"/></g></svg>`)).toBeNull();
    expect(parseSvgLogo(`<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="url(#g)"/></svg>`)).toBeNull();
    expect(parseSvgLogo(`<svg><rect width="5" height="5"/></svg>`)).toBeNull(); // no size
    expect(parseSvgLogo(`<svg viewBox="0 0 10 10"></svg>`)).toBeNull(); // nothing to draw
  });
});

describe("readLogo", () => {
  it("draws this business's logo", () => {
    if (BRAND_LOGO === null) return;
    expect(readLogo(BRAND_LOGO), `public${BRAND_LOGO} should be a PNG, a JPEG or a simple SVG`).not.toBeNull();
  });

  it("takes a PNG or JPEG as it is, and nothing for no logo, a missing file or another kind", () => {
    const root = mkdtempSync(join(tmpdir(), "logo-"));
    mkdirSync(join(root, "public", "brand"), { recursive: true });
    writeFileSync(join(root, "public", "brand", "a.png"), "png bytes");
    writeFileSync(join(root, "public", "brand", "a.JPG"), "jpg bytes");
    writeFileSync(join(root, "public", "brand", "a.gif"), "gif bytes");
    expect(readLogo("/brand/a.png", root)).toMatchObject({ kind: "image", format: "png" });
    expect(readLogo("/brand/a.JPG", root)).toMatchObject({ kind: "image", format: "jpg" });
    expect(readLogo("/brand/a.gif", root)).toBeNull();
    expect(readLogo("/brand/missing.png", root)).toBeNull();
    expect(readLogo(null, root)).toBeNull();
  });
});
