import { describe, expect, it } from "vitest";
import { checkInTitle, TASK_AUTOMATIONS, wonFollowUpTitle } from "./task-automations";

describe("TASK_AUTOMATIONS", () => {
  it("is the won follow-up and the cold check-in", () => {
    expect(TASK_AUTOMATIONS).toEqual(["won_follow_up", "cold_check_in"]);
  });
});

describe("wonFollowUpTitle", () => {
  it("names the contact", () => {
    expect(wonFollowUpTitle({ contactName: "Ann Lee", companyName: "Lee Plumbing" }))
      .toBe("Thank Ann Lee and ask for a referral");
  });

  it("names the company when there is no contact", () => {
    expect(wonFollowUpTitle({ contactName: null, companyName: "Lee Plumbing" }))
      .toBe("Thank Lee Plumbing and ask for a referral");
  });

  it("says the customer when there is neither", () => {
    expect(wonFollowUpTitle({ contactName: null, companyName: null }))
      .toBe("Thank the customer and ask for a referral");
  });
});

describe("checkInTitle", () => {
  it("names the contact and the deal", () => {
    expect(checkInTitle({ contactName: "Ann Lee", companyName: "Lee Plumbing", dealTitle: "Kitchen refit" }))
      .toBe("Check in with Ann Lee about Kitchen refit");
  });

  it("names the company when there is no contact", () => {
    expect(checkInTitle({ contactName: null, companyName: "Lee Plumbing", dealTitle: "Kitchen refit" }))
      .toBe("Check in with Lee Plumbing about Kitchen refit");
  });

  it("says the customer when there is neither", () => {
    expect(checkInTitle({ contactName: null, companyName: null, dealTitle: "Kitchen refit" }))
      .toBe("Check in with the customer about Kitchen refit");
  });
});
