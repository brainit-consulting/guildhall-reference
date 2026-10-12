import { describe, expect, it } from "vitest";
import { MAX_AGENT_LOG_PAGE, readPage } from "./agent-log";

describe("readPage", () => {
  it("keeps a whole number from 1 to the maximum", () => {
    expect(readPage("2")).toBe(2);
    expect(readPage(" 7 ")).toBe(7);
    expect(readPage(3)).toBe(3);
    expect(readPage(String(MAX_AGENT_LOG_PAGE))).toBe(MAX_AGENT_LOG_PAGE);
  });

  it("reads anything else as page 1", () => {
    for (const asked of [undefined, "", "abc", "-3", "0", "1.5", "1e20", "99999999999999999999", "200000000000000000",
      String(MAX_AGENT_LOG_PAGE + 1), "0x10", 0, -1, NaN, Infinity, 1e20, Number.MAX_SAFE_INTEGER]) {
      expect(readPage(asked), String(asked)).toBe(1);
    }
  });
});
