import { describe, expect, it } from "vitest";
import { clientSource } from "./clients";

describe("clientSource", () => {
  it("makes a client from the deal's company when it has one", () => {
    expect(clientSource({ companyId: "co", contactId: "ct" })).toEqual({ madeFrom: "company", companyId: "co" });
  });

  it("falls back to the contact when there is no company", () => {
    expect(clientSource({ companyId: null, contactId: "ct" })).toEqual({ madeFrom: "contact", contactId: "ct" });
  });

  it("has nothing to make one from with neither", () => {
    expect(clientSource({ companyId: null, contactId: null })).toBeNull();
  });
});
