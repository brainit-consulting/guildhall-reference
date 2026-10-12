import { describe, expect, it } from "vitest";
import { MAX_ADDRESS_LINE, parseAddress } from "./settings";

describe("parseAddress", () => {
  it("trims each line and drops blank ones", () => {
    expect(parseAddress("  12 Mill Lane \r\n\n  Hollow Oak   Village\nVT 05001  \n")).toEqual({
      value: "12 Mill Lane\nHollow Oak Village\nVT 05001", error: null,
    });
  });

  it("clears with nothing typed", () => {
    expect(parseAddress("  \n ")).toEqual({ value: "", error: null });
  });

  it("refuses more than six lines", () => {
    expect(parseAddress("1\n2\n3\n4\n5\n6\n7").error).toBe("Fit the address on 6 lines or fewer.");
    expect(parseAddress("1\n2\n3\n4\n5\n6").error).toBeNull();
  });

  it("refuses a line too long to print", () => {
    expect(parseAddress("x".repeat(MAX_ADDRESS_LINE)).error).toBeNull();
    expect(parseAddress("x".repeat(MAX_ADDRESS_LINE + 1)).error).toMatch(/^Keep each line under 80 characters/);
  });
});
