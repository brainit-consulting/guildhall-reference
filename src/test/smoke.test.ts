import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("uses the in-memory built-in database", () => {
    expect(process.env.GUILDHALL_DATA_DIR).toBe("memory://");
  });
});
