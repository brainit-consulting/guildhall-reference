import { describe, expect, it } from "vitest";
import { asksToChange, grantedScopes } from "./agent-access";

const ALL = "openid profile email offline_access guildhall:read guildhall:write";

describe("grantedScopes", () => {
  it("never grants guildhall:write for Read only", () => {
    expect(grantedScopes(ALL, "read")).toBe("openid profile email offline_access guildhall:read");
  });

  it("grants everything asked for with Read and change", () => {
    expect(grantedScopes(ALL, "change")).toBe(ALL);
  });

  it("never adds a scope the agent didn't ask for", () => {
    expect(grantedScopes("openid guildhall:read", "change")).toBe("openid guildhall:read");
    expect(grantedScopes(null, "change")).toBe("");
  });
});

describe("asksToChange", () => {
  it("is true only when the agent asked for guildhall:write", () => {
    expect(asksToChange(ALL)).toBe(true);
    expect(asksToChange("openid guildhall:read")).toBe(false);
    expect(asksToChange(undefined)).toBe(false);
  });
});
