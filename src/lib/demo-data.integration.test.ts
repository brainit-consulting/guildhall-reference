import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { account, activity, allowedEmail, client, company, contact, deal, enquiry, session, task, user } from "@/lib/db/schema";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { EMPTY_ENQUIRY, receiveEnquiry, WEB_FORM } from "./enquiries";
import { TIME_ZONE, todayIn } from "./dates";
import { resetDemoData, resetMessage } from "./demo-data";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const DEMO = "demo@hollowoak.example";
// Noon on 15 Oct in New York
const NOW = new Date("2026-10-15T16:00:00Z");

async function people() {
  const at = new Date();
  await t.db.insert(user).values([
    { id: "owner-1", name: "Margery", email: "margery@hollowoak.example", role: "owner" },
    { id: "member-1", name: "Demo", email: DEMO, role: "member" },
  ]);
  await t.db.insert(account).values({ id: "acc-1", userId: "owner-1", accountId: "owner-1", providerId: "credential", password: "hash" });
  await t.db.insert(session).values({ id: "ses-1", userId: "member-1", token: "tok", expiresAt: new Date(at.getTime() + 86_400_000) });
  await t.db.insert(allowedEmail).values({ email: DEMO });
}

const OWNER = { id: "owner-1", role: "owner" };
const MEMBER = { id: "member-1", role: "member" };

const counts = async () => ({
  companies: (await t.db.select().from(company)).length,
  contacts: (await t.db.select().from(contact)).length,
  deals: (await t.db.select().from(deal)).length,
  activities: (await t.db.select().from(activity)).length,
  tasks: (await t.db.select().from(task)).length,
  enquiries: (await t.db.select().from(enquiry)).length,
  clients: (await t.db.select().from(client)).length,
});

// Something a student made: a company that is a client, and an enquiry with its contact, deal and note.
async function studentData() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Student Co" })).id!;
  await t.db.insert(client).values({ name: "Student Co", madeFrom: "company", companyId });
  await receiveEnquiry(t.db, { ...EMPTY_ENQUIRY, name: "Wat", email: "wat@lynn.example", message: "Hello" }, NOW);
}

describe("resetDemoData", () => {
  it("replaces everything with exactly the Hollow Oak set", async () => {
    await people();
    await studentData();
    const result = await resetDemoData(t.db, OWNER, DEMO, NOW);
    expect(result).toEqual({ error: null, counts: { companies: 8, contacts: 12, deals: 10 } });
    expect(resetMessage(result.counts!)).toBe("Demo data is back: 8 companies, 12 contacts, 10 deals.");
    expect(await counts()).toEqual({ companies: 8, contacts: 12, deals: 10, activities: 13, tasks: 8, enquiries: 1, clients: 0 });
    expect(await t.db.select().from(company).where(eq(company.name, "Student Co"))).toHaveLength(0);
  });

  it("keeps accounts, sessions and allowed emails", async () => {
    await people();
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    expect((await t.db.select({ id: user.id }).from(user).orderBy(asc(user.id))).map((u) => u.id)).toEqual(["member-1", "owner-1"]);
    expect(await t.db.select({ id: account.id }).from(account)).toEqual([{ id: "acc-1" }]);
    expect(await t.db.select({ id: session.id }).from(session)).toEqual([{ id: "ses-1" }]);
    expect(await t.db.select({ email: allowedEmail.email }).from(allowedEmail)).toEqual([{ email: DEMO }]);
  });

  it("can be pressed twice and still leaves one set", async () => {
    await people();
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    expect(await counts()).toEqual({ companies: 8, contacts: 12, deals: 10, activities: 13, tasks: 8, enquiries: 1, clients: 0 });
  });

  it("credits the owner with every activity but the web form's note", async () => {
    await people();
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    const rows = await t.db.select().from(activity);
    expect(rows.filter((a) => a.userId === "owner-1")).toHaveLength(12);
    const [web] = rows.filter((a) => a.userId === null);
    expect(web).toMatchObject({ kind: "note", source: WEB_FORM });
    expect(web.body).toMatch(/^Converting a barn near Saratoga/);
  });

  it("dates the data from today, as the seed script did", async () => {
    await people();
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    const today = todayIn(TIME_ZONE, NOW);
    expect(today).toBe("2026-10-15");

    const [stairs] = await t.db.select().from(deal).where(eq(deal.title, "Oak staircase, Elm Street"));
    expect(stairs).toMatchObject({ value: "18400.00", stage: "Proposal", expectedClose: "2026-11-05", wonOn: null, source: null });
    expect(stairs.lastActivityAt).toEqual(new Date(NOW.getTime() - 3 * 86_400_000 + 2 * 3_600_000));

    const [won] = await t.db.select().from(deal).where(eq(deal.title, "Cabinet doors, October order"));
    expect(won).toMatchObject({ stage: "Won", wonOn: "2026-10-11", expectedClose: "2026-10-11" });

    const [barn] = await t.db.select().from(deal).where(eq(deal.title, "Oak windows, barn conversion"));
    expect(barn).toMatchObject({ value: null, stage: "New", source: WEB_FORM, lastActivityAt: null });
    const [helen] = await t.db.select().from(contact).where(eq(contact.name, "Helen Brooks"));
    expect(helen).toMatchObject({ email: "helen@mail.example", phone: "(518) 555-0270", companyId: null });

    const [dana] = await t.db.select().from(contact).where(eq(contact.name, "Dana Fairbrook"));
    const [fairbrook] = await t.db.select().from(company).where(eq(company.name, "Fairbrook Builders"));
    expect(dana).toMatchObject({ email: "dana@fairbrookbuilders.example", phone: "(518) 555-0200", companyId: fairbrook.id });
    expect(fairbrook).toMatchObject({ website: "https://fairbrookbuilders.example", phone: "(518) 555-0142" });
    expect(fairbrook.createdAt).toEqual(new Date(NOW.getTime() - 60 * 86_400_000 - 2 * 3_600_000));

    // the enquiry arrived the day the barn deal was made, 25 days ago
    const [e] = await t.db.select().from(enquiry);
    expect(e).toMatchObject({ email: "owen@mail.example", receivedOn: "2026-09-20", dealId: barn.id });

    const tasks = await t.db.select().from(task).orderBy(asc(task.dueOn));
    expect(tasks.map((x) => [x.title, x.dueOn, x.doneAt !== null])).toEqual([
      ["Measure the six door frames", "2026-10-09", true],
      ["Send plot 3 door samples", "2026-10-14", false],
      ["Order reclaimed oak for the bar top", "2026-10-15", false],
      ["Reply to the barn windows enquiry", "2026-10-16", false],
      ["Follow up on the staircase quote", "2026-10-17", false],
      ["Book survey at Brookside library", "2026-10-22", false],
      ["Call Samuel before the trust meeting", "2026-10-29", false],
      ["Chase the October invoice", "2026-11-10", false],
    ]);
    expect(tasks.every((x) => x.dealId !== null && x.automation === null)).toBe(true);
  });

  it("keeps web and email addresses on the reserved .example domain", async () => {
    await people();
    await resetDemoData(t.db, OWNER, DEMO, NOW);
    for (const c of await t.db.select().from(company)) expect(c.website).toMatch(/^https:\/\/[a-z]+\.example$/);
    for (const c of await t.db.select().from(contact)) expect(c.email).toMatch(/^[a-z]+@[a-z.]+\.example$/);
  });

  it("refuses anyone but the owner, and changes nothing", async () => {
    await people();
    await studentData();
    const before = await counts();
    expect(await resetDemoData(t.db, MEMBER, DEMO, NOW)).toEqual({ error: "Only the owner can reset the demo data.", counts: null });
    expect(await resetDemoData(t.db, { id: "member-1" }, DEMO, NOW)).toMatchObject({ counts: null });
    expect(await counts()).toEqual(before);
  });

  it("refuses without DEMO_EMAIL, even for the owner, and changes nothing", async () => {
    await people();
    await studentData();
    const before = await counts();
    expect(await resetDemoData(t.db, OWNER, null, NOW))
      .toEqual({ error: "Demo data can only be reset on the showcase site.", counts: null });
    expect(await counts()).toEqual(before);
  });
});
