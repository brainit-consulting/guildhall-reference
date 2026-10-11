import { describe, expect, it } from "vitest";
import { cleanSearch, likePattern, listHref, nextDir, readListView, sortChanges } from "./list-view";

const KEYS = ["name", "website", "phone"] as const;

describe("reading the view from the address", () => {
  it("reads search, sort and direction", () => {
    expect(readListView({ q: "acme", sort: "name", dir: "desc" }, KEYS)).toEqual({ q: "acme", sort: "name", dir: "desc" });
  });

  it("defaults to no search, no sort, A to Z", () => {
    expect(readListView({}, KEYS)).toEqual({ q: "", sort: null, dir: "asc" });
  });

  it("treats a missing dir as asc", () => {
    expect(readListView({ sort: "phone" }, KEYS)).toEqual({ q: "", sort: "phone", dir: "asc" });
  });

  it("trims the search, treats blank as none and cuts it at 100 characters", () => {
    expect(readListView({ q: "  acme  " }, KEYS).q).toBe("acme");
    expect(readListView({ q: "   " }, KEYS).q).toBe("");
    expect(readListView({ q: "a".repeat(150) }, KEYS).q).toBe("a".repeat(100));
    expect(cleanSearch(`${"a".repeat(99)}   b`)).toBe("a".repeat(99));
  });

  it("ignores an unknown sort or a sideways direction", () => {
    expect(readListView({ sort: "drop", dir: "sideways" }, KEYS)).toEqual({ q: "", sort: null, dir: "asc" });
    expect(readListView({ sort: "name", dir: "sideways" }, KEYS)).toEqual({ q: "", sort: "name", dir: "asc" });
    expect(readListView({ dir: "desc" }, KEYS)).toEqual({ q: "", sort: null, dir: "asc" });
    expect(readListView({ sort: "constructor" }, KEYS).sort).toBeNull();
  });

  it("takes the first of a repeated parameter", () => {
    expect(readListView({ q: ["acme", "lynn"], sort: ["website", "name"] }, KEYS)).toMatchObject({ q: "acme", sort: "website" });
  });
});

describe("building a list address", () => {
  it("changes one thing and keeps the rest, other parameters too", () => {
    expect(listHref("/deals", { q: "acme", stage: "Won", open: "1" }, { sort: "name" }))
      .toBe("/deals?q=acme&stage=Won&open=1&sort=name");
    expect(listHref("/companies", { q: "acme", sort: "name", dir: "desc" }, { q: "lynn" }))
      .toBe("/companies?sort=name&dir=desc&q=lynn");
  });

  it("removes a parameter set to null or blank, and drops the ? when nothing is left", () => {
    expect(listHref("/companies", { q: "acme", sort: "name" }, { q: null })).toBe("/companies?sort=name");
    expect(listHref("/companies", { q: "acme" }, { q: "" })).toBe("/companies");
  });

  it("keeps repeated parameters and encodes what it writes", () => {
    expect(listHref("/deals", { stage: ["New", "Won"] }, { q: "a&b c%" })).toBe("/deals?stage=New&stage=Won&q=a%26b+c%25");
  });

  it("sorts A to Z without dir, Z to A with dir=desc", () => {
    expect(listHref("/companies", { q: "acme", dir: "desc" }, sortChanges("name", "asc"))).toBe("/companies?q=acme&sort=name");
    expect(listHref("/companies", { q: "acme" }, sortChanges("name", "desc"))).toBe("/companies?q=acme&sort=name&dir=desc");
    expect(listHref("/companies", { sort: "name", dir: "desc" }, sortChanges(null, "desc"))).toBe("/companies");
  });

  it("flips a heading's direction only for the column already sorted A to Z", () => {
    expect(nextDir({ q: "", sort: null, dir: "asc" }, "name")).toBe("asc");
    expect(nextDir({ q: "", sort: "name", dir: "asc" }, "name")).toBe("desc");
    expect(nextDir({ q: "", sort: "name", dir: "desc" }, "name")).toBe("asc");
    expect(nextDir({ q: "", sort: "website", dir: "asc" }, "name")).toBe("asc");
  });
});

describe("the search as an ILIKE pattern", () => {
  it("matches anywhere", () => {
    expect(likePattern("acme")).toBe("%acme%");
  });

  it("escapes %, _ and backslash so they match themselves", () => {
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("c:\\x")).toBe("%c:\\\\x%");
  });
});
