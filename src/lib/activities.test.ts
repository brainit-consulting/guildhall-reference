import { describe, expect, it } from "vitest";
import { checkActivity } from "./activities";

describe("checkActivity", () => {
  it("accepts a note, call or meeting with text, trimmed", () => {
    for (const kind of ["note", "call", "meeting"])
      expect(checkActivity({ kind, body: "  Rang about the roof.\n" })).toEqual({ values: { kind, body: "Rang about the roof." }, errors: null });
  });

  it("asks for the text when there is none", () => {
    expect(checkActivity({ kind: "call", body: " \n " })).toEqual({ values: null, errors: { body: "Write what happened." } });
  });

  it("refuses a kind the form doesn't offer, stage changes included", () => {
    for (const kind of ["stage_change", "email", ""])
      expect(checkActivity({ kind, body: "Hello" }).errors).toEqual({ kind: "Pick note, call or meeting." });
  });
});
