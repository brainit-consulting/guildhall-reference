// The Hollow Oak demo data on the live showcase (issue #75): the set the owner's Reset demo data button puts back,
// dated from the moment it's pressed. Taken row for row from the seed script that first filled the live site.
import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/client";
import { activity, client, company, contact, deal, enquiry, project, task } from "@/lib/db/schema";
import type { ActivityKind } from "@/lib/activity-kinds";
import type { DealStage } from "@/lib/deal-stages";
import { TIME_ZONE, todayIn } from "@/lib/dates";
import { WEB_FORM } from "@/lib/enquiries";

const DAY = 86_400_000;

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"] & { id: string };

// name, website (on the reserved .example domain), phone, notes
const COMPANIES: [string, string, string, string][] = [
  ["Fairbrook Builders", "fairbrookbuilders.example", "(518) 555-0142", "General contractor. Sends us their kitchen and stair work on new builds."],
  ["Marsh & Cole Architects", "marshcole.example", "(518) 555-0187", "Specifies bespoke joinery for period homes."],
  ["Greyhaven Inn", "greyhaveninn.example", "(518) 555-0119", "Twelve-room inn. Refitting the bar and the dining room."],
  ["Old Mill Restoration Trust", "oldmilltrust.example", "(518) 555-0164", "Charity restoring the 1840s mill. Grant-funded, slow to decide."],
  ["Linden Property Management", "lindenpm.example", "(518) 555-0133", "Manages 40 rentals. Steady small jobs: doors, frames, repairs."],
  ["Westgate Kitchens", "westgatekitchens.example", "(518) 555-0158", "Showroom. Buys our cabinet doors for their own installs."],
  ["Brookside School", "brooksideschool.example", "(518) 555-0101", "Library shelving and a new reception desk."],
  ["Ashworth Homes", "ashworthhomes.example", "(518) 555-0176", "Small developer, four houses a year."],
];

// name, job title, company, notes
const CONTACTS: [string, string, string | null, string | null][] = [
  ["Dana Fairbrook", "Owner", "Fairbrook Builders", "Prefers a call to email."],
  ["Luis Ortega", "Site manager", "Fairbrook Builders", null],
  ["Priya Marsh", "Partner", "Marsh & Cole Architects", "Sends drawings as PDF; wants samples before quoting."],
  ["Tom Cole", "Project architect", "Marsh & Cole Architects", null],
  ["Evelyn Hart", "Owner", "Greyhaven Inn", "Wants the bar finished before the winter season."],
  ["Samuel Okafor", "Trustee", "Old Mill Restoration Trust", "Needs three quotes for the grant."],
  ["Grace Linden", "Maintenance coordinator", "Linden Property Management", null],
  ["Ben Whitaker", "Showroom manager", "Westgate Kitchens", "Orders monthly; pays in 30 days."],
  ["Maria Santos", "Business manager", "Brookside School", "Budget signed off at the board meeting each quarter."],
  ["Jack Ashworth", "Director", "Ashworth Homes", null],
  ["Helen Brooks", "Homeowner", null, "Victorian house on Elm Street: staircase restoration."],
  ["Owen Price", "Homeowner", null, "Wants oak windows for a barn conversion."],
];

// title, value, stage, contact, expected close (days from now), last activity (days ago), won (days ago), source
const DEALS: [string, string | null, DealStage, string, number, number | null, number | null, string | null][] = [
  ["Oak staircase, Elm Street", "18400.00", "Proposal", "Helen Brooks", 21, 3, null, null],
  ["Bar and back-bar refit", "26750.00", "Proposal", "Evelyn Hart", 30, 2, null, null],
  ["Kitchen cabinets, plot 3", "14200.00", "Contacted", "Dana Fairbrook", 45, 6, null, null],
  ["Mill window restoration (24 sashes)", "38900.00", "Contacted", "Samuel Okafor", 90, 19, null, null],
  ["Library shelving", "9650.00", "New", "Maria Santos", 60, null, null, null],
  ["Oak windows, barn conversion", null, "New", "Owen Price", 40, null, null, WEB_FORM],
  ["Cabinet doors, October order", "6300.00", "Won", "Ben Whitaker", -4, 4, 4, null],
  ["Front doors, Ashworth plots 1-4", "11800.00", "Won", "Jack Ashworth", -12, 12, 12, null],
  ["Reception desk", "4950.00", "Lost", "Maria Santos", -20, 22, null, null],
  ["Door frames, 6 rentals", "3400.00", "Contacted", "Grace Linden", 14, 8, null, null],
];

// kind, body, on (deal title / contact name / company name), days ago
const ACTIVITIES: [ActivityKind, string, string, number][] = [
  ["meeting", "Site visit. Measured the stairwell; 14 treads, the newel post is original and staying.", "Oak staircase, Elm Street", 9],
  ["note", "Sent the quote with two finishes: oiled and lacquered.", "Oak staircase, Elm Street", 3],
  ["call", "Evelyn wants the bar done by 15 November. Agreed to start on the back-bar shelving first.", "Bar and back-bar refit", 2],
  ["meeting", "Walked the dining room with Evelyn and her chef. Bar top in reclaimed oak.", "Bar and back-bar refit", 11],
  ["call", "Dana confirmed plot 3 is a go if we can match the plot 1 doors.", "Kitchen cabinets, plot 3", 6],
  ["note", "Trust meets on the 28th. They need our quote alongside two others.", "Mill window restoration (24 sashes)", 19],
  ["note", "Order delivered and signed for. Invoice sent, 30 days.", "Cabinet doors, October order", 4],
  ["call", "Jack happy with the doors; mentioned plots 5-8 next spring.", "Front doors, Ashworth plots 1-4", 12],
  ["note", "They went with a flat-pack desk to stay in budget. Keep in touch for the shelving.", "Reception desk", 22],
  ["call", "Grace needs six frames replaced before new tenants move in.", "Door frames, 6 rentals", 8],
  ["note", "Asked for drawings of the Hartley house sash windows; may lead to a joint job.", "Priya Marsh", 15],
  ["meeting", "Coffee with Priya and Tom. They have three period homes coming up in spring.", "Marsh & Cole Architects", 26],
];

// The note the barn windows enquiry arrived with, written by the web form rather than a person.
const ENQUIRY_NOTE = "Converting a barn near Saratoga. Looking for seven oak casement windows, double glazed. Could you quote?";

// title, due (days from now), on (deal title), done
const TASKS: [string, number, string, boolean][] = [
  ["Follow up on the staircase quote", 2, "Oak staircase, Elm Street", false],
  ["Order reclaimed oak for the bar top", 0, "Bar and back-bar refit", false],
  ["Send plot 3 door samples", -1, "Kitchen cabinets, plot 3", false],
  ["Call Samuel before the trust meeting", 14, "Mill window restoration (24 sashes)", false],
  ["Reply to the barn windows enquiry", 1, "Oak windows, barn conversion", false],
  ["Book survey at Brookside library", 7, "Library shelving", false],
  ["Chase the October invoice", 26, "Cabinet doors, October order", false],
  ["Measure the six door frames", -6, "Door frames, 6 rentals", true],
];

export type DemoData = {
  companies: Row<typeof company>[];
  contacts: Row<typeof contact>[];
  deals: Row<typeof deal>[];
  activities: (typeof activity.$inferInsert)[];
  tasks: (typeof task.$inferInsert)[];
  enquiries: (typeof enquiry.$inferInsert)[];
};

// Every row, dated from `now`, with the person-logged activities credited to `ownerId`.
export function buildDemoData(ownerId: string, now: Date): DemoData {
  const t = now.getTime();
  // `d` days before now, at `h` o'clock relative to now's noon, as the seed script had it
  const ago = (d: number, h = 10) => new Date(t - d * DAY + (h - 12) * 3_600_000);
  // the business's calendar day `offset` days from now
  const day = (offset: number) => todayIn(TIME_ZONE, new Date(t + offset * DAY));

  const companies = COMPANIES.map(([name, web, phone, notes], i) => {
    const createdAt = ago(60 - i * 4);
    return { id: randomUUID(), name, website: `https://${web}`, phone, notes, createdAt, updatedAt: createdAt };
  });
  const co = new Map(companies.map((c) => [c.name, c]));

  const contacts = CONTACTS.map(([name, jobTitle, companyName, notes], i) => {
    const first = name.split(" ")[0].toLowerCase();
    const from = companyName ? co.get(companyName)! : null;
    const domain = from ? from.website.replace("https://", "") : "mail.example";
    const createdAt = ago(55 - i * 3);
    return {
      id: randomUUID(), name, email: `${first}@${domain}`, phone: `(518) 555-${String(200 + i * 7).padStart(4, "0")}`,
      jobTitle, notes, companyId: from?.id ?? null, createdAt, updatedAt: createdAt,
    };
  });
  const ct = new Map(contacts.map((c) => [c.name, c]));

  const deals = DEALS.map(([title, value, stage, person, close, last, won, source], i) => {
    const c = ct.get(person)!;
    const createdAt = ago(40 - i * 3);
    return {
      id: randomUUID(), title, value, stage, contactId: c.id, companyId: c.companyId, expectedClose: day(close),
      lastActivityAt: last == null ? null : ago(last, 14), wonOn: won == null ? null : day(-won), source, createdAt,
      updatedAt: createdAt,
    };
  });
  const dl = new Map(deals.map((d) => [d.title, d]));

  const on = (name: string) => {
    if (dl.has(name)) return { dealId: dl.get(name)!.id };
    if (ct.has(name)) return { contactId: ct.get(name)!.id };
    return { companyId: co.get(name)!.id };
  };

  const web = dl.get("Oak windows, barn conversion")!;
  const activities = [
    ...ACTIVITIES.map(([kind, body, about, daysAgo]) => ({ kind, body, userId: ownerId, ...on(about), createdAt: ago(daysAgo, 14) })),
    { kind: "note" as const, body: ENQUIRY_NOTE, source: WEB_FORM, dealId: web.id, createdAt: web.createdAt },
  ];

  const enquiries = [{
    email: ct.get("Owen Price")!.email,
    receivedOn: day(-Math.round((t - web.createdAt.getTime()) / DAY)),
    dealId: web.id,
    createdAt: web.createdAt,
  }];

  const tasks = TASKS.map(([title, due, about, done]) => ({
    title, dueOn: day(due), dealId: dl.get(about)!.id, doneAt: done ? ago(5) : null, createdAt: ago(10),
  }));

  return { companies, contacts, deals, activities, tasks, enquiries };
}

export type ResetResult =
  | { error: string; counts: null }
  | { error: null; counts: { companies: number; contacts: number; deals: number } };

// Who pressed the button, as the session has them.
type Who = { id: string; role?: string | null };

// Only on the showcase (DEMO_EMAIL set) and only for the owner, so nobody's own Guildhall can be wiped this way. The
// deletes and inserts are one transaction: a failure part way leaves the data as it was. Accounts, sessions and the
// allowed emails are not touched.
export async function resetDemoData(db: Db, who: Who, demoEmail: string | null, now = new Date()): Promise<ResetResult> {
  if (!demoEmail) return { error: "Demo data can only be reset on the showcase site.", counts: null };
  if (who.role !== "owner") return { error: "Only the owner can reset the demo data.", counts: null };

  const data = buildDemoData(who.id, now);
  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    // children first, though the foreign keys would cascade or null most of these anyway
    await tx.delete(activity);
    await tx.delete(task);
    await tx.delete(enquiry);
    await tx.delete(deal);
    await tx.delete(project);
    await tx.delete(client);
    await tx.delete(contact);
    await tx.delete(company);
    await tx.insert(company).values(data.companies);
    await tx.insert(contact).values(data.contacts);
    await tx.insert(deal).values(data.deals);
    await tx.insert(activity).values(data.activities);
    await tx.insert(enquiry).values(data.enquiries);
    await tx.insert(task).values(data.tasks);
  });
  return { error: null, counts: { companies: data.companies.length, contacts: data.contacts.length, deals: data.deals.length } };
}

// "Demo data is back: 8 companies, 12 contacts, 10 deals."
export function resetMessage(counts: { companies: number; contacts: number; deals: number }): string {
  return `Demo data is back: ${counts.companies} companies, ${counts.contacts} contacts, ${counts.deals} deals.`;
}
