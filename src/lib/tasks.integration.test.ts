import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { task } from "@/lib/db/schema";
import { createCompany, deleteCompany, EMPTY_COMPANY } from "./companies";
import { createContact, deleteContact, EMPTY_CONTACT } from "./contacts";
import { createDeal, deleteDeal, EMPTY_DEAL } from "./deals";
import {
  addTask, createTask, createTaskOn, dueTasks, listDueTasks, listTaskTargetChoices, listTasks, PICK_TARGET, setTaskDone, type TaskTarget,
} from "./tasks";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function setUp() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", companyId })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Re-roof the hall", contactId, companyId })).id!;
  return {
    contact: { type: "contact", id: contactId } as TaskTarget,
    company: { type: "company", id: companyId } as TaskTarget,
    deal: { type: "deal", id: dealId } as TaskTarget,
  };
}

const titles = async (filter: Parameters<typeof listTasks>[1]) => (await listTasks(t.db, filter)).map((x) => x.title);

describe("adding a task", () => {
  it("saves a task on each kind of record, open, with what it belongs to", async () => {
    const on = await setUp();
    expect((await createTask(t.db, on.contact, { title: " Call Ann back ", dueOn: "2026-10-12" })).errors).toBeNull();
    expect((await createTask(t.db, on.company, { title: "Book a visit", dueOn: "2026-10-13" })).errors).toBeNull();
    expect((await createTask(t.db, on.deal, { title: "Send the quote", dueOn: "2026-10-14" })).errors).toBeNull();

    expect(await listTasks(t.db)).toEqual([
      { id: expect.any(String), title: "Call Ann back", dueOn: "2026-10-12", doneAt: null, on: { ...on.contact, name: "Wat Tyler" } },
      { id: expect.any(String), title: "Book a visit", dueOn: "2026-10-13", doneAt: null, on: { ...on.company, name: "Lynn Tilers" } },
      { id: expect.any(String), title: "Send the quote", dueOn: "2026-10-14", doneAt: null, on: { ...on.deal, name: "Re-roof the hall" } },
    ]);
  });

  it("saves nothing without a title or a real day", async () => {
    const on = await setUp();
    expect(await createTask(t.db, on.deal, { title: "", dueOn: "2026-02-30" }))
      .toEqual({ id: null, errors: { title: "Write what you promised.", dueOn: "Pick a due date." } });
    expect(await t.db.select().from(task)).toEqual([]);
  });

  it("says so when the record has gone", async () => {
    await setUp();
    for (const type of ["contact", "company", "deal"] as const) {
      for (const id of [UNKNOWN, "not-an-id"]) {
        expect(await addTask(t.db, { type, id }, { title: "Call back", dueOn: "2026-10-12" }))
          .toEqual({ id: null, errors: { target: `That ${type} isn't in Guildhall any more, so no task was added.` } });
      }
    }
    expect(await t.db.select().from(task)).toEqual([]);
  });

  it("refuses a row on no record or on two, in the database itself", async () => {
    const on = await setUp();
    await expect(t.db.insert(task).values({ title: "Nowhere", dueOn: "2026-10-12" })).rejects.toThrow();
    await expect(t.db.insert(task).values({ title: "Twice", dueOn: "2026-10-12", contactId: on.contact.id, dealId: on.deal.id }))
      .rejects.toThrow();
  });
});

describe("listing tasks", () => {
  it("sorts by due day, then title regardless of case", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Visit", dueOn: "2026-10-12" });
    await addTask(t.db, on.deal, { title: "call Ann", dueOn: "2026-10-12" });
    await addTask(t.db, on.deal, { title: "Archive", dueOn: "2026-10-20" });
    await addTask(t.db, on.deal, { title: "Zebra", dueOn: "2026-10-01" });
    expect(await titles({})).toEqual(["Zebra", "call Ann", "Visit", "Archive"]);
  });

  it("filters by record", async () => {
    const on = await setUp();
    await addTask(t.db, on.contact, { title: "On the contact", dueOn: "2026-10-12" });
    await addTask(t.db, on.company, { title: "On the company", dueOn: "2026-10-12" });
    await addTask(t.db, on.deal, { title: "On the deal", dueOn: "2026-10-12" });
    expect(await titles({ on: on.contact })).toEqual(["On the contact"]);
    expect(await titles({ on: on.company })).toEqual(["On the company"]);
    expect(await titles({ on: on.deal })).toEqual(["On the deal"]);
    expect(await titles({ on: { type: "deal", id: "not-an-id" } })).toEqual([]);
  });

  it("filters by open or done", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Open one", dueOn: "2026-10-12" });
    const done = (await addTask(t.db, on.deal, { title: "Done one", dueOn: "2026-10-12" })).id!;
    await setTaskDone(t.db, done, true);
    expect(await titles({ status: "open" })).toEqual(["Open one"]);
    expect(await titles({ status: "done" })).toEqual(["Done one"]);
    expect(await titles({})).toEqual(["Done one", "Open one"]);
  });

  it("filters by due on or before a day", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Yesterday", dueOn: "2026-10-09" });
    await addTask(t.db, on.deal, { title: "Today", dueOn: "2026-10-10" });
    await addTask(t.db, on.deal, { title: "Tomorrow", dueOn: "2026-10-11" });
    expect(await titles({ dueBy: "2026-10-10" })).toEqual(["Yesterday", "Today"]);
    expect(await titles({ dueBy: "2026-02-30" })).toEqual([]);
  });

  it("combines filters", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Due, open, on the deal", dueOn: "2026-10-09" });
    await addTask(t.db, on.contact, { title: "Due, open, on the contact", dueOn: "2026-10-09" });
    await addTask(t.db, on.deal, { title: "Later", dueOn: "2026-11-01" });
    const done = (await addTask(t.db, on.deal, { title: "Done already", dueOn: "2026-10-01" })).id!;
    await setTaskDone(t.db, done, true);
    expect(await titles({ on: on.deal, status: "open", dueBy: "2026-10-10" })).toEqual(["Due, open, on the deal"]);
  });
});

describe("ticking a task", () => {
  it("ticks and unticks", async () => {
    const on = await setUp();
    const id = (await addTask(t.db, on.deal, { title: "Send the quote", dueOn: "2026-10-12" })).id!;
    expect(await setTaskDone(t.db, id, true)).toEqual({ error: null });
    const [ticked] = await listTasks(t.db);
    expect(ticked.doneAt).toBeInstanceOf(Date);
    expect(await titles({ status: "open" })).toEqual([]);

    // ticking again keeps when it was first done
    await setTaskDone(t.db, id, true);
    expect((await listTasks(t.db))[0].doneAt).toEqual(ticked.doneAt);

    expect(await setTaskDone(t.db, id, false)).toEqual({ error: null });
    expect(await listTasks(t.db, { status: "open" })).toMatchObject([{ id, doneAt: null }]);
  });

  it("says so when the task has gone", async () => {
    for (const id of [UNKNOWN, "not-an-id"]) {
      expect(await setTaskDone(t.db, id, true)).toEqual({ error: "That task isn't in Guildhall any more." });
    }
  });
});

describe("deleting the record a task is on", () => {
  it("deletes its tasks and no others", async () => {
    const on = await setUp();
    await addTask(t.db, on.contact, { title: "On the contact", dueOn: "2026-10-12" });
    await addTask(t.db, on.company, { title: "On the company", dueOn: "2026-10-12" });
    await addTask(t.db, on.deal, { title: "On the deal", dueOn: "2026-10-12" });

    await deleteDeal(t.db, on.deal.id);
    expect(await titles({})).toEqual(["On the company", "On the contact"]);
    await deleteContact(t.db, on.contact.id);
    expect(await titles({})).toEqual(["On the company"]);
    await deleteCompany(t.db, on.company.id);
    expect(await t.db.select().from(task).where(eq(task.title, "On the company"))).toEqual([]);
  });
});

describe("Home's tasks", () => {
  it("splits open tasks into overdue, oldest first, and due today; later and done tasks are left out", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Send the quote", dueOn: "2026-10-11" });
    await addTask(t.db, on.contact, { title: "Call Wat back", dueOn: "2026-09-30" });
    await addTask(t.db, on.company, { title: "Book a visit", dueOn: "2026-10-12" });
    await addTask(t.db, on.contact, { title: "Post the samples", dueOn: "2026-10-13" });
    const done = (await addTask(t.db, on.deal, { title: "Measure the roof", dueOn: "2026-10-10" })).id!;
    await setTaskDone(t.db, done, true);

    const due = await dueTasks(t.db, "2026-10-12");
    expect(due.overdue.map((x) => [x.title, x.dueOn, x.on.name])).toEqual([
      ["Call Wat back", "2026-09-30", "Wat Tyler"],
      ["Send the quote", "2026-10-11", "Re-roof the hall"],
    ]);
    expect(due.today.map((x) => [x.title, x.on.name])).toEqual([["Book a visit", "Lynn Tilers"]]);

    // a day later, today's task is overdue and tomorrow's is due
    const next = await dueTasks(t.db, "2026-10-13");
    expect(next.overdue.map((x) => x.title)).toEqual(["Call Wat back", "Send the quote", "Book a visit"]);
    expect(next.today.map((x) => x.title)).toEqual(["Post the samples"]);
  });

  it("is empty with nothing open due by today", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Send the quote", dueOn: "2026-10-13" });
    expect(await dueTasks(t.db, "2026-10-12")).toEqual({ overdue: [], today: [] });
  });
});

describe("the Tasks page's Due filter", () => {
  it("lists exactly Home's overdue and due today tasks for the same day", async () => {
    const on = await setUp();
    await addTask(t.db, on.deal, { title: "Send the quote", dueOn: "2026-10-11" });
    await addTask(t.db, on.contact, { title: "Call Wat back", dueOn: "2026-09-30" });
    await addTask(t.db, on.company, { title: "Book a visit", dueOn: "2026-10-12" });
    await addTask(t.db, on.contact, { title: "Post the samples", dueOn: "2026-10-13" });
    const done = (await addTask(t.db, on.deal, { title: "Measure the roof", dueOn: "2026-10-12" })).id!;
    await setTaskDone(t.db, done, true);

    for (const today of ["2026-10-12", "2026-10-13", "2026-09-01"]) {
      const home = await dueTasks(t.db, today);
      expect(await listDueTasks(t.db, "overdue", today)).toEqual(home.overdue);
      expect(await listDueTasks(t.db, "today", today)).toEqual(home.today);
    }
    expect((await listDueTasks(t.db, "overdue", "2026-10-12")).map((x) => x.title)).toEqual(["Call Wat back", "Send the quote"]);
    expect((await listDueTasks(t.db, "today", "2026-10-12")).map((x) => x.title)).toEqual(["Book a visit"]);
  });
});

describe("picking what a task is for", () => {
  it("offers every contact, company and deal A to Z, each with its kind", async () => {
    const on = await setUp();
    await createContact(t.db, { ...EMPTY_CONTACT, name: "alice Fermor" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Mend the gate" });
    expect(await listTaskTargetChoices(t.db)).toEqual([
      { value: expect.stringMatching(/^contact:/), name: "alice Fermor", detail: "Contact" },
      { value: `company:${on.company.id}`, name: "Lynn Tilers", detail: "Company" },
      { value: expect.stringMatching(/^deal:/), name: "Mend the gate", detail: "Deal" },
      { value: `deal:${on.deal.id}`, name: "Re-roof the hall", detail: "Deal · Lynn Tilers" },
      { value: `contact:${on.contact.id}`, name: "Wat Tyler", detail: "Contact · Lynn Tilers" },
    ]);
  });

  it("offers nothing when there are no records", async () => {
    expect(await listTaskTargetChoices(t.db)).toEqual([]);
  });

  it("saves a task on whichever kind was picked", async () => {
    const on = await setUp();
    for (const target of [on.contact, on.company, on.deal]) {
      const saved = await createTaskOn(t.db, `${target.type}:${target.id}`, { title: `On the ${target.type}`, dueOn: "2026-10-12" });
      expect(saved.errors).toBeNull();
      expect(await titles({ on: target })).toEqual([`On the ${target.type}`]);
    }
  });

  it("asks for a pick, with the other problems, when nothing was picked", async () => {
    await setUp();
    expect(await createTaskOn(t.db, "", { title: "Call back", dueOn: "2026-10-12" }))
      .toEqual({ id: null, errors: { target: PICK_TARGET } });
    expect(await createTaskOn(t.db, "invoice:1", { title: "", dueOn: "" }))
      .toEqual({ id: null, errors: { target: PICK_TARGET, title: "Write what you promised.", dueOn: "Pick a due date." } });
    expect(await t.db.select().from(task)).toEqual([]);
  });

  it("says so when the picked record has gone or the id is made up", async () => {
    const on = await setUp();
    await deleteDeal(t.db, on.deal.id);
    for (const picked of [`deal:${on.deal.id}`, "deal:not-an-id", `company:${UNKNOWN}`]) {
      const saved = await createTaskOn(t.db, picked, { title: "Call back", dueOn: "2026-10-12" });
      expect(saved.id).toBeNull();
      expect(saved.errors?.target).toMatch(/isn't in Guildhall any more/);
    }
    expect(await t.db.select().from(task)).toEqual([]);
  });
});
