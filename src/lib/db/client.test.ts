import { describe, expect, it } from "vitest";
import { localClient } from "./client";

describe("localClient", () => {
  it("returns the same PGlite for the same folder, so a reload never opens a second one", () => {
    expect(localClient("memory://a")).toBe(localClient("memory://a"));
  });
});
