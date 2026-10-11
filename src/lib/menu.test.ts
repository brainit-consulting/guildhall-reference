import { describe, expect, it } from "vitest";
import { isCurrent, MENU, menuFor } from "./menu";

describe("menuFor", () => {
  it("gives the owner every item", () => {
    expect(menuFor("owner")).toEqual(MENU);
  });

  it("hides owner-only items from everyone else", () => {
    const labels = menuFor("member").map((i) => i.label);
    expect(labels).toEqual(["Home", "Contacts", "Companies", "Deals", "Pipeline", "Tasks"]);
    expect(labels).not.toContain("Settings");
    expect(menuFor(undefined).map((i) => i.label)).toEqual(labels);
  });
});

describe("isCurrent", () => {
  it("marks the page you're on and the pages below it", () => {
    expect(isCurrent("/home", "/home")).toBe(true);
    expect(isCurrent("/settings/people", "/settings")).toBe(true);
  });

  it("doesn't mark a page that only shares the start of its name", () => {
    expect(isCurrent("/homework", "/home")).toBe(false);
    expect(isCurrent("/settings", "/home")).toBe(false);
  });
});
