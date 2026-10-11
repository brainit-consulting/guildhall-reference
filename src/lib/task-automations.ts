// The tasks Guildhall adds itself (spec B16). Kept apart from tasks.ts, with no imports, so the schema can build its
// enum from the list. A person's task has no automation.
export const TASK_AUTOMATIONS = ["won_follow_up", "cold_check_in"] as const;
export type TaskAutomation = (typeof TASK_AUTOMATIONS)[number];

export type TaskTitleParty = { contactName: string | null; companyName: string | null };

// who the task is about: the deal's contact, else its company, else nobody named
function who({ contactName, companyName }: TaskTitleParty): string {
  return contactName?.trim() || companyName?.trim() || "the customer";
}

export function wonFollowUpTitle(party: TaskTitleParty): string {
  return `Thank ${who(party)} and ask for a referral`;
}

export function checkInTitle(party: TaskTitleParty & { dealTitle: string }): string {
  return `Check in with ${who(party)} about ${party.dealTitle}`;
}
