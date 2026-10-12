import { describe, expect, it } from "vitest";
import { accessFrom, consentCovers } from "./connections";

describe("accessFrom", () => {
  it("is Read and change only with guildhall:write", () => {
    expect(accessFrom(["openid", "guildhall:read", "guildhall:write"])).toBe("change");
    expect(accessFrom(["openid", "guildhall:read"])).toBe("read");
    expect(accessFrom([])).toBe("read");
  });
});

describe("consentCovers", () => {
  const consented = new Date("2026-10-12T09:00:00.000Z");
  const second = consented.getTime() / 1000;

  it("covers a token issued in the same second as the consent, or after", () => {
    expect(consentCovers(consented, second)).toBe(true);
    expect(consentCovers(consented, second + 3600)).toBe(true);
    // a consent stored with milliseconds still covers a token from its own second
    expect(consentCovers(new Date("2026-10-12T09:00:00.900Z"), second)).toBe(true);
  });

  it("doesn't cover a token issued before it: one left over from before a disconnect", () => {
    expect(consentCovers(consented, second - 1)).toBe(false);
  });

  it("takes a consent with no time at its word", () => {
    expect(consentCovers(null, 0)).toBe(true);
  });
});
