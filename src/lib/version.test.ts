import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";

describe("APP_VERSION", () => {
  it("is package.json's version", () => {
    expect(APP_VERSION).toBe(JSON.parse(readFileSync("package.json", "utf8")).version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
