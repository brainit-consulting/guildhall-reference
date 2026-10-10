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
    const { values } = checkContact({ name: " Wat Tyler ", email: " wat@lynn.example ", phone: "  ", jobTitle: "Tiler", notes: "\n Met at the fair.\n", companyId: "" });
    expect(values).toEqual({ name: "Wat Tyler", email: "wat@lynn.example", phone: null, jobTitle: "Tiler", notes: "Met at the fair.", companyId: null });
  });

  it("keeps a company id, and refuses one that can't be a company", () => {
    const id = "6f1c2b9e-3d4a-4c5b-8e7f-0a1b2c3d4e5f";
    expect(checkContact({ ...EMPTY_CONTACT, name: "Wat Tyler", companyId: id }).values?.companyId).toBe(id);
    expect(checkContact({ ...EMPTY_CONTACT, name: "Wat Tyler", companyId: "lynn" }).errors)
      .toEqual({ companyId: "That company isn't in Guildhall any more. Pick another, or No company." });
  });
});
