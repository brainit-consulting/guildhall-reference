import { describe, expect, it } from "vitest";
import { enquiryFormUrl } from "./enquiry-form";

describe("enquiryFormUrl", () => {
  it("adds /enquire to the app's address", () => {
    expect(enquiryFormUrl("http://localhost:3000")).toBe("http://localhost:3000/enquire");
    expect(enquiryFormUrl("https://guildhall.example.com")).toBe("https://guildhall.example.com/enquire");
  });

  it("has no double slash when the base ends in /", () => {
    expect(enquiryFormUrl("https://guildhall.example.com/")).toBe("https://guildhall.example.com/enquire");
    expect(enquiryFormUrl("https://guildhall.example.com//")).toBe("https://guildhall.example.com/enquire");
  });
});
