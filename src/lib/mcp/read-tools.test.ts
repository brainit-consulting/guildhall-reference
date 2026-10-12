import { describe, expect, it } from "vitest";
import { money } from "./read-tools";

describe("money for an agent", () => {
  it("gives the text a person sees and the same amount as a plain number", () => {
    expect(money("1250.50")).toEqual({ amount: 1250.5, formatted: "$1,250.50" });
    expect(money("0.00")).toEqual({ amount: 0, formatted: "$0.00" });
  });

  it("keeps the largest stored amount to the cent", () => {
    const { amount, formatted } = money("9999999999.99");
    expect(amount.toFixed(2)).toBe("9999999999.99");
    expect(formatted).toBe("$9,999,999,999.99");
  });
});
