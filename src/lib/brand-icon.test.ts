import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO } from "./brand";

// The tab icon is Next's src/app/icon.<ext> file convention, which can't point at public/. It is a copy of the logo;
// this keeps the two from drifting when the logo changes.
describe("tab icon", () => {
  it("is byte-for-byte the logo file", () => {
    if (BRAND_LOGO === null) return;
    const icon = resolve(__dirname, "../app", `icon${extname(BRAND_LOGO)}`);
    expect(existsSync(icon), `copy public${BRAND_LOGO} to src/app/icon${extname(BRAND_LOGO)}`).toBe(true);
    const logo = readFileSync(resolve(__dirname, "../../public", BRAND_LOGO.slice(1)));
    expect(readFileSync(icon).equals(logo)).toBe(true);
  });
});
