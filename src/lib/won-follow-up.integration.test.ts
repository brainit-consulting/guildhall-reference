// B16: winning a deal adds one task, a week later, to thank the customer and ask for a referral.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { contact, task } from "@/lib/db/schema";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { createDeal, EMPTY_DEAL, moveDealStage, updateDeal, type DealInput } from "./deals";
import { setTaskDone } from "./tasks";
import { addWonFollowUp } from "./won-follow-up";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

// 3pm in New York on 11 Oct 2026
const now = new Date("2026-10-11T19:00:00Z");

async function people() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lee Plumbing" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lee", companyId })).id!;
  return { companyId, contactId };
}

async function newDeal(fields: Partial<DealInput> = {}, at = now) {
  const input = { ...EMPTY_DEAL, title: "Kitchen refit", ...fields };
  return { input, id: (await createDeal(t.db, input, at)).id! };
}

const followUps = (dealId: string) => t.db.select({ title: task.title, dueOn: task.dueOn, doneAt: task.doneAt }).from(task)
  .where(eq(task.dealId, dealId));

const thankAnn = { title: "Thank Ann Lee and ask for a referral", dueOn: "2026-10-18", doneAt: null };

describe("the three ways a deal reaches Won", () => {
  it("moving it on the board adds the task, due a week after the won day", async () => {
    const { id } = await newDeal(await people());
    expect(await followUps(id)).toEqual([]);
    await moveDealStage(t.db, id, "Won", null, now);
    expect(await followUps(id)).toEqual([thankAnn]);
    const [row] = await t.db.select({ automation: task.automation }).from(task).where(eq(task.dealId, id));
    expect(row.automation).toBe("won_follow_up");
  });

  it("saving the edit form from another stage to Won adds it", async () => {
    const { id, input } = await newDeal({ ...(await people()), stage: "Proposal" });
    await updateDeal(t.db, id, { ...input, stage: "Won" }, null, now);
    expect(await followUps(id)).toEqual([thankAnn]);
  });

  it("adding a deal straight at Won adds it", async () => {
    const { id } = await newDeal({ ...(await people()), stage: "Won" });
    expect(await followUps(id)).toEqual([thankAnn]);
  });

  it("moving to any other stage adds nothing", async () => {
    const { id } = await newDeal(await people());
    for (const stage of ["Contacted", "Proposal", "Lost", "New"]) await moveDealStage(t.db, id, stage, null, now);
    expect(await followUps(id)).toEqual([]);
  });

  it("saving a deal already at Won is not a move and adds nothing", async () => {
    const { id, input } = await newDeal({ ...(await people()), stage: "Won" });
    // take the first away, so a second would show
    await t.db.delete(task).where(eq(task.dealId, id));
    await updateDeal(t.db, id, { ...input, title: "Kitchen refit and tiling" }, null, now);
    await moveDealStage(t.db, id, "Won", null, now);
    expect(await followUps(id)).toEqual([]);
  });
});

describe("once per deal, ever", () => {
  it("moving out of Won and back leaves the one task", async () => {
    const { id } = await newDeal(await people());
    await moveDealStage(t.db, id, "Won", null, now);
    await moveDealStage(t.db, id, "Lost", null, now);
    await moveDealStage(t.db, id, "Won", null, new Date("2026-10-20T15:00:00Z"));
    expect(await followUps(id)).toEqual([thankAnn]);
  });

  it("ticking it done first doesn't let a second in", async () => {
    const { id, input } = await newDeal(await people());
    await moveDealStage(t.db, id, "Won", null, now);
    const [first] = await t.db.select({ id: task.id }).from(task).where(eq(task.dealId, id));
    expect(await setTaskDone(t.db, first.id, true)).toEqual({ error: null });
    await moveDealStage(t.db, id, "Proposal", null, now);
    await updateDeal(t.db, id, { ...input, stage: "Won" }, null, now);
    const rows = await followUps(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].doneAt).not.toBeNull();
  });

  it("two moves to Won at the same moment add one", async () => {
    const { id, input } = await newDeal(await people());
    await Promise.all([
      moveDealStage(t.db, id, "Won", null, now),
      moveDealStage(t.db, id, "Won", null, now),
      updateDeal(t.db, id, { ...input, stage: "Won" }, null, now),
    ]);
    expect(await followUps(id)).toEqual([thankAnn]);
  });

  it("the index decides, not a look first: two adds at once make one", async () => {
    const { id } = await newDeal({ ...(await people()), stage: "Won" });
    await t.db.delete(task).where(eq(task.dealId, id));
    const added = await Promise.all([addWonFollowUp(t.db, id), addWonFollowUp(t.db, id)]);
    expect(added.filter(Boolean)).toHaveLength(1);
    expect(await followUps(id)).toEqual([thankAnn]);
  });

  it("a deal that isn't won, or isn't there, gets nothing", async () => {
    const { id } = await newDeal(await people());
    expect(await addWonFollowUp(t.db, id)).toBe(false);
    expect(await addWonFollowUp(t.db, "00000000-0000-4000-8000-000000000000")).toBe(false);
    expect(await followUps(id)).toEqual([]);
  });
});

describe("who it names", () => {
  it("names the company when there is no contact", async () => {
    const { companyId } = await people();
    const { id } = await newDeal({ companyId, stage: "Won" });
    expect((await followUps(id))[0].title).toBe("Thank Lee Plumbing and ask for a referral");
  });

  it("names nobody when there is neither", async () => {
    const { id } = await newDeal({ stage: "Won" });
    expect((await followUps(id))[0].title).toBe("Thank the customer and ask for a referral");
  });

  it("uses the contact's name as it is when the deal is won", async () => {
    const { contactId, companyId } = await people();
    const { id } = await newDeal({ contactId, companyId });
    await t.db.update(contact).set({ name: "Ann Lee-Smith" }).where(eq(contact.id, contactId));
    await moveDealStage(t.db, id, "Won", null, now);
    expect((await followUps(id))[0].title).toBe("Thank Ann Lee-Smith and ask for a referral");
  });
});

describe("the due day", () => {
  // 11pm on 31 Oct in New York (EDT), already 1 Nov in UTC
  const late = new Date("2026-11-01T03:00:00Z");

  it("added at Won late on 31 Oct in New York is due 7 Nov", async () => {
    const { id } = await newDeal({ stage: "Won" }, late);
    expect((await followUps(id))[0].dueOn).toBe("2026-11-07");
  });

  it("moved to Won late on 31 Oct in New York is due 7 Nov", async () => {
    const { id } = await newDeal({}, late);
    await moveDealStage(t.db, id, "Won", null, late);
    expect((await followUps(id))[0].dueOn).toBe("2026-11-07");
  });
});
