// Clients (I10): the businesses the owner works for, made from Won deals. Plain functions on `db`, so the pages and
// later the MCP tools (list_clients) share one set of rules.
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { client, company, contact, deal } from "@/lib/db/schema";

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

export const NOT_WON = "Only a Won deal can become a client. Move it to Won first.";
export const NOBODY = "This deal has no company or contact. Add one, then make it a client.";

// What a client is made from: the deal's company, or with no company its contact. null when it has neither.
export function clientSource(d: { companyId: string | null; contactId: string | null }):
  { madeFrom: "company"; companyId: string } | { madeFrom: "contact"; contactId: string } | null {
  if (d.companyId) return { madeFrom: "company", companyId: d.companyId };
  if (d.contactId) return { madeFrom: "contact", contactId: d.contactId };
  return null;
}

export type MadeClient = { id: string; created: boolean; error: null } | { id: null; created: false; error: string };

// "Make client" on a Won deal: the client its company (or contact) already is, or a new one, and the deal linked to
// it. `created` says whether this call made it. A deal already linked keeps its client. null when there is no such
// deal (deleted in another tab, or a tampered id).
export async function makeClient(db: Db, dealId: string): Promise<MadeClient | null> {
  if (!isId(dealId)) return null;
  const [d] = await db.select({
    stage: deal.stage, clientId: deal.clientId, companyId: deal.companyId, contactId: deal.contactId,
    companyName: company.name, contactName: contact.name,
  }).from(deal)
    .leftJoin(company, eq(deal.companyId, company.id))
    .leftJoin(contact, eq(deal.contactId, contact.id))
    .where(eq(deal.id, dealId)).limit(1);
  if (!d) return null;
  if (d.clientId) return { id: d.clientId, created: false, error: null };
  if (d.stage !== "Won") return { id: null, created: false, error: NOT_WON };
  const source = clientSource(d);
  if (!source) return { id: null, created: false, error: NOBODY };

  // The partial unique indexes decide "once"; whoever loses the race reads the winner's row.
  const byCompany = source.madeFrom === "company";
  const key = byCompany ? client.companyId : client.contactId;
  const keyValue = byCompany ? source.companyId : source.contactId;
  const added = await db.insert(client).values({
    name: (byCompany ? d.companyName : d.contactName)!,
    madeFrom: source.madeFrom,
    companyId: byCompany ? source.companyId : null,
    contactId: d.contactId,
  }).onConflictDoNothing({ target: key, where: sql`${client.madeFrom} = ${source.madeFrom}` })
    .returning({ id: client.id });
  const [found] = added.length > 0 ? added
    : await db.select({ id: client.id }).from(client)
      .where(and(eq(key, keyValue), eq(client.madeFrom, source.madeFrom))).limit(1);

  // only a deal not yet linked, so a second tab can't move it to another client
  await db.update(deal).set({ clientId: found.id, updatedAt: new Date() })
    .where(and(eq(deal.id, dealId), isNull(deal.clientId)));
  const [linked] = await db.select({ clientId: deal.clientId }).from(deal).where(eq(deal.id, dealId)).limit(1);
  if (!linked?.clientId) return null; // deleted in between
  return { id: linked.clientId, created: added.length > 0 && linked.clientId === found.id, error: null };
}

// The company's (or contact's) name as it is now; the one stored when the client was made once it has been deleted.
const clientName = sql<string>`coalesce(case when ${client.madeFrom} = 'company' then ${company.name} else ${contact.name} end, ${client.name})`;

// The deals linked to a client that are at Won now.
const wonDeals = (clientId: typeof client.id) =>
  sql<number>`(select count(*) from ${deal} where ${deal.clientId} = ${clientId} and ${deal.stage} = 'Won')::int`;

export type ClientRow = { id: string; name: string; contactId: string | null; contactName: string | null; wonDeals: number };

// Every client A to Z, with its contact person and how many won deals it has; ties by id, so the order is stable.
export async function listClients(db: Db): Promise<ClientRow[]> {
  return db.select({ id: client.id, name: clientName, contactId: client.contactId, contactName: contact.name, wonDeals: wonDeals(client.id) })
    .from(client)
    .leftJoin(company, eq(client.companyId, company.id))
    .leftJoin(contact, eq(client.contactId, contact.id))
    .orderBy(sql`lower(${clientName})`, asc(client.id));
}

export type ClientDetails = {
  id: string; name: string; madeFrom: "company" | "contact"; createdAt: Date;
  companyId: string | null; companyName: string | null; contactId: string | null; contactName: string | null;
};

export async function getClient(db: Db, id: string): Promise<ClientDetails | null> {
  if (!isId(id)) return null;
  const [found] = await db.select({
    id: client.id, name: clientName, madeFrom: client.madeFrom, createdAt: client.createdAt,
    companyId: client.companyId, companyName: company.name, contactId: client.contactId, contactName: contact.name,
  }).from(client)
    .leftJoin(company, eq(client.companyId, company.id))
    .leftJoin(contact, eq(client.contactId, contact.id))
    .where(eq(client.id, id)).limit(1);
  return found ?? null;
}

// A client's won deals, latest won first (ties by title, then id).
export async function listClientWonDeals(db: Db, clientId: string) {
  if (!isId(clientId)) return [];
  return db.select({ id: deal.id, title: deal.title, value: deal.value, wonOn: deal.wonOn }).from(deal)
    .where(and(eq(deal.clientId, clientId), eq(deal.stage, "Won")))
    .orderBy(desc(deal.wonOn), sql`lower(${deal.title})`, asc(deal.id));
}
