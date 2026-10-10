import { describe, expect, it } from "vitest";
import { checkCompany, EMPTY_COMPANY, websiteHref } from "./companies";

describe("checkCompany", () => {
  it("needs a name", () => {
    expect(checkCompany({ ...EMPTY_COMPANY, name: "   ", phone: "01553 774 100" })).toEqual({ values: null, errors: { name: "Enter a name." } });
  });

  it("trims fields and stores blanks as null", () => {
    const { values } = checkCompany({ name: " Lynn Tilers ", website: " lynntilers.example ", phone: "  ", notes: "\n Roofs.\n" });
    expect(values).toEqual({ name: "Lynn Tilers", website: "lynntilers.example", phone: null, notes: "Roofs." });
  });
});

describe("websiteHref", () => {
  it("adds https to an address typed without one", () => {
    expect(websiteHref("lynntilers.example")).toBe("https://lynntilers.example/");
    expect(websiteHref("www.lynntilers.example/roofs")).toBe("https://www.lynntilers.example/roofs");
  });

  it("keeps an http or https address as it is", () => {
    expect(websiteHref("http://lynntilers.example/")).toBe("http://lynntilers.example/");
    expect(websiteHref("HTTPS://lynntilers.example/a?b=1")).toBe("https://lynntilers.example/a?b=1");
  });

  it("never links anything that isn't a web address", () => {
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("mailto:hello@lynntilers.example")).toBeNull();
    expect(websiteHref("not a website")).toBeNull();
    expect(websiteHref(null)).toBeNull();
  });
});
