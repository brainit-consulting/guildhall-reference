import { describe, expect, it } from "vitest";
import { e2ePort } from "../../e2e/port";

describe("e2ePort", () => {
  it("is the same for the same folder", () => {
    expect(e2ePort("H:\\work\\desks\\aldric")).toBe(e2ePort("h:\\work\\desks\\aldric"));
  });
  it("differs between the dungeon's desks", () => {
    const ports = ["aldric", "maud", "godric", "preview"].map((d) => e2ePort(`H:\\home\\workspaces\\me__guildhall\\desks\\${d}`));
    expect(new Set(ports).size).toBe(4);
  });
  it("stays clear of 3000 and the dungeon's preview ports", () => {
    for (const f of ["a", "b", "/home/runner/work/guildhall", "C:\\x"]) {
      const p = e2ePort(f);
      expect(p).toBeGreaterThanOrEqual(3100);
      expect(p).toBeLessThan(3900);
    }
  });
});
