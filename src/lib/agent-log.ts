// The agent log (I8): what each agent changed through a write tool, for whom and when. The write tools record; the
// owner reads it on /settings/agent-log.
import { and, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Db } from "@/lib/db/client";
import type { ActivityTarget } from "@/lib/activities";
import { formatInvoiceNumber } from "@/lib/invoices";
import { agentLog, company, contact, deal, invoice, user } from "@/lib/db/schema";

export const AGENT_LOG_PAGE_SIZE = 50;
// Far beyond any real log, and small enough that its OFFSET fits Postgres's bigint.
export const MAX_AGENT_LOG_PAGE = 1_000_000;

// A page number as asked for (a number, or the address's text): page 1 unless it is a whole number from 1 to
// MAX_AGENT_LOG_PAGE, so a tampered address shows the newest changes rather than an error.
export function readPage(asked: number | string | undefined): number {
  const n = typeof asked === "string" ? (/^\d+$/.test(asked.trim()) ? Number(asked.trim()) : NaN) : asked;
  return n !== undefined && Number.isSafeInteger(n) && n >= 1 && n <= MAX_AGENT_LOG_PAGE ? n : 1;
}

// The agent as its token names it: its OAuth client and the name it registered with.
export type LoggedAgent = { clientId: string; name: string };

// What a change touched: a record with a timeline, or an invoice an agent drafted.
export type LoggedRecord = ActivityTarget | { type: "invoice"; id: string };

export type AgentChange = { userId: string; tool: string; summary: string; touched: LoggedRecord };

export async function recordAgentChange(db: Db, agent: LoggedAgent, change: AgentChange): Promise<void> {
  await db.insert(agentLog).values({
    clientId: agent.clientId, agentName: agent.name, userId: change.userId, tool: change.tool, summary: change.summary,
    recordType: change.touched.type, recordId: change.touched.id,
  });
}

// `record` is null once the contact, company, deal or invoice is gone, so the page links only to records still there.
export type AgentLogEntry = {
  id: string; agentName: string; person: string | null; tool: string; summary: string; createdAt: Date;
  record: (LoggedRecord & { name: string }) | null;
};

// One page (from 1) of the log, newest first, of one agent's entries when `clientId` is given. `more`: an older page
// exists.
export async function listAgentLog(
  db: Db, opts: { page?: number; clientId?: string | null } = {},
): Promise<{ entries: AgentLogEntry[]; more: boolean }> {
  const page = readPage(opts.page);
  const on = (type: LoggedRecord["type"], id: AnyPgColumn) =>
    and(eq(agentLog.recordType, type), eq(agentLog.recordId, id));
  const rows = await db.select({
    id: agentLog.id, agentName: agentLog.agentName, person: user.name, tool: agentLog.tool, summary: agentLog.summary,
    createdAt: agentLog.createdAt, recordType: agentLog.recordType, recordId: agentLog.recordId,
    recordName: sql<string | null>`coalesce(${contact.name}, ${company.name}, ${deal.title})`,
    invoiceNumber: invoice.number,
  })
    .from(agentLog)
    .leftJoin(user, eq(agentLog.userId, user.id))
    .leftJoin(contact, on("contact", contact.id))
    .leftJoin(company, on("company", company.id))
    .leftJoin(deal, on("deal", deal.id))
    .leftJoin(invoice, on("invoice", invoice.id))
    .where(opts.clientId ? eq(agentLog.clientId, opts.clientId) : undefined)
    .orderBy(desc(agentLog.createdAt), desc(agentLog.id))
    .limit(AGENT_LOG_PAGE_SIZE + 1)
    .offset((page - 1) * AGENT_LOG_PAGE_SIZE);
  const entries = rows.slice(0, AGENT_LOG_PAGE_SIZE).map(({ recordType, recordId, recordName, invoiceNumber, ...e }) => {
    // an invoice goes by its number, as "INV-0001"
    const name = invoiceNumber !== null ? formatInvoiceNumber(invoiceNumber) : recordName;
    return { ...e, record: recordType && recordId && name !== null ? { type: recordType, id: recordId, name } : null };
  });
  return { entries, more: rows.length > AGENT_LOG_PAGE_SIZE };
}

// Every agent with an entry, by the name it last recorded under, A to Z, for the filter.
export async function listLoggedAgents(db: Db): Promise<LoggedAgent[]> {
  const rows = await db.selectDistinctOn([agentLog.clientId], { clientId: agentLog.clientId, name: agentLog.agentName })
    .from(agentLog).orderBy(agentLog.clientId, desc(agentLog.createdAt));
  return rows.sort((a, b) => a.name.localeCompare(b.name, "en") || a.clientId.localeCompare(b.clientId));
}
