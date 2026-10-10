import { describe, expect, it } from "vitest";
import { checkContact, EMPTY_CONTACT } from "./contacts";

describe("checkContact", () => {
  it("needs a name", () => {
    expect(checkContact({ ...EMPTY_CONTACT, name: "   " })).toEqual({ values: null, errors: { name: "Enter a name." } });
  });

  it("explains an email that doesn't look like one, and leaves a blank email alone", () => {
    const bad = checkContact({ ...EMPTY_CONTACT, name: "Wat Tyler", email: "wat-at-lynn" });
    expect(bad.errors).toEqual({ email: "That doesn't look like an email address. Check it and try again." });
    expect(checkContact({ ...EMPTY_CONTACT, name: "Wat Tyler" }).errors).toBeNull();
  });

  it("reports every problem at once", () => {
    expect(Object.keys(checkContact({ ...EMPTY_CONTACT, email: "nope" }).errors!)).toEqual(["name", "email"]);
  });

  it("trims fields and stores blanks as null", () => {
    const { values } = checkContact({ name: " Wat Tyler ", email: " wat@lynn.example ", phone: "  ", jobTitle: "Tiler", notes: "\n Met at the fair.\n" });
    expect(values).toEqual({ name: "Wat Tyler", email: "wat@lynn.example", phone: null, jobTitle: "Tiler", notes: "Met at the fair." });
  });
});
