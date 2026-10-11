import { describe, expect, it } from "vitest";
import { checkEnquiry, EMPTY_ENQUIRY, thanksFor } from "./enquiries";

const good = { ...EMPTY_ENQUIRY, name: "Wat Tyler", email: "wat@lynn.example", message: "A new roof, please." };

describe("checkEnquiry", () => {
  it("needs a name, an email and a message, and says so for each", () => {
    expect(checkEnquiry({ ...EMPTY_ENQUIRY, name: "  ", email: " ", message: "\n" })).toEqual({
      values: null,
      errors: { name: "Enter your name.", email: "Enter your email address.", message: "Tell us what you need." },
    });
  });

  it("explains an email that doesn't look like one", () => {
    expect(checkEnquiry({ ...good, email: "wat-at-lynn" }).errors)
      .toEqual({ email: "That doesn't look like an email address. Check it and try again." });
  });

  it("trims every field and stores a blank phone or company as null", () => {
    expect(checkEnquiry({ ...good, name: " Wat Tyler ", email: " Wat@Lynn.example ", phone: "  ", company: "", message: " Roof. \n" }).values)
      .toEqual({ name: "Wat Tyler", email: "Wat@Lynn.example", phone: null, company: null, message: "Roof." });
    expect(checkEnquiry({ ...good, phone: " 01553 123 ", company: " Lynn Tilers " }).values)
      .toMatchObject({ phone: "01553 123", company: "Lynn Tilers" });
  });

  it("takes each field up to its cap and refuses one character more", () => {
    const atCap = { ...good, name: "n".repeat(200), email: `${"e".repeat(242)}@lynn.example`, phone: "1".repeat(40),
      company: "c".repeat(200), message: "m".repeat(5000) };
    expect(atCap.email).toHaveLength(255);
    expect(checkEnquiry({ ...atCap, email: `${"e".repeat(241)}@lynn.example` }).errors).toBeNull();
    expect(checkEnquiry({ ...good, name: "n".repeat(201), email: atCap.email, phone: "1".repeat(41), company: "c".repeat(201),
      message: "m".repeat(5001) }).errors).toEqual({
      name: "Keep this under 200 characters.",
      email: "Keep this under 254 characters.",
      phone: "Keep this under 40 characters.",
      company: "Keep this under 200 characters.",
      message: "Keep this under 5,000 characters.",
    });
  });
});

describe("thanksFor", () => {
  it("thanks them by the name they typed, trimmed", () => {
    expect(thanksFor("  Wat Tyler ")).toBe("Thanks, Wat Tyler. We'll be in touch.");
  });

  it("leaves the name out when there isn't one", () => {
    expect(thanksFor(" ")).toBe("Thanks. We'll be in touch.");
  });
});
