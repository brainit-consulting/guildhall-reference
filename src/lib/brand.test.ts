import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLOUR, BRAND_LOGO, BUSINESS_NAME } from "./brand";

describe("brand", () => {
  it("names the business, with no spaces at either end", () => {
    expect(BUSINESS_NAME.trim()).not.toBe("");
    expect(BUSINESS_NAME).toBe(BUSINESS_NAME.trim());
  });

  it("gives the colour as # and six hex digits", () => {
    expect(BRAND_COLOUR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  // A typo in the path fails here rather than showing a broken image.
  it("has no logo, or one under /brand/ whose file is in public/", () => {
    if (BRAND_LOGO === null) return;
    expect(BRAND_LOGO.startsWith("/brand/")).toBe(true);
    expect(existsSync(resolve(__dirname, "../../public", BRAND_LOGO.slice(1)))).toBe(true);
  });
});
