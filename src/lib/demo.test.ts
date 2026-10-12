import { describe, expect, it } from "vitest";
import { isDemoAccount, isDemoLockedPath } from "./demo";

describe("isDemoLockedPath", () => {
  it("locks the four ways to change or delete an account", () => {
    for (const p of ["/change-password", "/change-email", "/update-user", "/delete-user", "/delete-user/callback"])
      expect(isDemoLockedPath(p), p).toBe(true);
  });
  it("leaves signing in and out, and everything else, alone", () => {
    for (const p of ["/sign-in/email", "/sign-out", "/get-session", "/sign-up/email", "/list-sessions"])
      expect(isDemoLockedPath(p), p).toBe(false);
  });
});

describe("isDemoAccount", () => {
  it("matches the demo email whatever its case", () => {
    expect(isDemoAccount("demo@hollowoak.example", "Demo@HollowOak.example")).toBe(true);
  });
  it("doesn't match anyone else", () => {
    expect(isDemoAccount("demo@hollowoak.example", "margery@hollowoak.example")).toBe(false);
    expect(isDemoAccount("demo@hollowoak.example", undefined)).toBe(false);
  });
  it("matches no one when there is no demo account", () => {
    expect(isDemoAccount(null, "demo@hollowoak.example")).toBe(false);
  });
});
