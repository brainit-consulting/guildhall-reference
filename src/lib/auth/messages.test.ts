import { describe, expect, it } from "vitest";
import { authErrorMessage, checkAuthForm, FALLBACK_MESSAGE } from "./messages";

describe("checkAuthForm", () => {
  const ok = { name: "Ada", email: "ada@example.com", password: "12345678" };

  it("passes a complete form", () => {
    expect(checkAuthForm(ok, "signup")).toBeNull();
    expect(checkAuthForm({ email: ok.email, password: "x" }, "signin")).toBeNull();
  });

  it("asks for each missing field", () => {
    expect(checkAuthForm({ ...ok, name: "  " }, "signup")).toBe("Enter your name.");
    expect(checkAuthForm({ ...ok, email: "" }, "signup")).toBe("Enter your email address.");
    expect(checkAuthForm({ ...ok, password: "" }, "signin")).toBe("Enter your password.");
  });

  it("wants at least 8 characters on sign-up only", () => {
    expect(checkAuthForm({ ...ok, password: "1234567" }, "signup")).toContain("8 characters");
    expect(checkAuthForm({ email: ok.email, password: "1234567" }, "signin")).toBeNull();
  });
});

describe("authErrorMessage", () => {
  it("says a wrong email or password plainly", () => {
    expect(authErrorMessage("INVALID_EMAIL_OR_PASSWORD")).toMatch(/^That email and password don't match\./);
  });

  it("points an existing account to sign-in, under either code Better-Auth uses", () => {
    expect(authErrorMessage("USER_ALREADY_EXISTS")).toMatch(/Sign in instead\.$/);
    expect(authErrorMessage("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toMatch(/Sign in instead\.$/);
  });

  it("names the password length", () => {
    expect(authErrorMessage("PASSWORD_TOO_SHORT")).toContain("8 characters");
  });

  it("falls back for unknown or missing codes", () => {
    expect(authErrorMessage("SOMETHING_NEW")).toBe(FALLBACK_MESSAGE);
    expect(authErrorMessage(undefined)).toBe(FALLBACK_MESSAGE);
    expect(authErrorMessage(null)).toBe(FALLBACK_MESSAGE);
  });
});
