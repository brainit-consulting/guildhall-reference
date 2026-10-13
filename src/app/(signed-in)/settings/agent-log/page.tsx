import type { Metadata } from "next";
import Link from "next/link";
import { listAgentLog, listLoggedAgents, readPage, type AgentLogEntry } from "@/lib/agent-log";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import type { SearchParams } from "@/lib/list-view";
import { AgentFilter } from "./agent-filter";
import { LocalTime } from "./local-time";

export const metadata: Metadata = { title: "Agent log" };

const PATH = "/settings/agent-log";
const PAGES = { contact: "contacts", company: "companies", deal: "deals", invoice: "invoices" } as const;
const KINDS = { contact: "Contact", company: "Company", deal: "Deal", invoice: "Invoice" } as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function href(agent: string | null, page: number) {
  const q = new URLSearchParams();
  if (agent) q.set("agent", agent);
  if (page > 1) q.set("page", String(page));
  return q.size ? `${PATH}?${q}` : PATH;
}

function Entry({ e }: { e: AgentLogEntry }) {
  return (
    <li className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <p className="text-sm tabular-nums text-muted"><LocalTime at={e.createdAt.toISOString()} /></p>
      <div className="min-w-0">
        <p className="wrap-anywhere text-ink">
          {e.agentName}, for {e.person ?? "someone who no longer has an account"}: {e.summary}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
          {e.record && (
            <Link href={`/${PAGES[e.record.type]}/${e.record.id}`}
              className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 wrap-anywhere md:min-h-0">
              {KINDS[e.record.type]}: {e.record.name}
            </Link>
          )}
          <span className="inline-flex min-h-11 items-center md:min-h-0">Tool: {e.tool}</span>
        </p>
      </div>
    </li>
  );
}

export default async function AgentLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  const agents = await listLoggedAgents(db);
  // an agent that isn't in the log shows everything rather than an empty page
  const agent = agents.find((a) => a.clientId === first(params.agent))?.clientId ?? null;
  const page = readPage(first(params.page));
  const { entries, more } = await listAgentLog(db, { page, clientId: agent });

  return (
    <main className="max-w-3xl px-6 py-12 md:px-12">
      <p>
        <Link href="/settings" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-accent md:min-h-0">
          Settings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6">Agent log</h1>
      <p className="mt-2 text-muted">Every change an agent has made, newest first. What agents only looked at isn&apos;t listed.</p>

      {agents.length > 0 && (
        <div className="mt-8">
          <AgentFilter path={PATH} agents={agents} current={agent} />
        </div>
      )}

      {entries.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-4 text-muted">
          {page > 1 ? <>Nothing on this page. <Link href={href(agent, 1)} className="text-accent underline underline-offset-4">Go to the newest changes.</Link></>
            : "No agent has changed anything yet. Changes appear here once an agent you connected adds or moves something."}
        </p>
      ) : (
        <ol aria-label="Changes" className="mt-8 border-t border-rule">
          {entries.map((e) => <Entry key={e.id} e={e} />)}
        </ol>
      )}

      {(page > 1 || more) && (
        <nav aria-label="Pages" className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          {page > 1 && entries.length > 0 && (
            <Link href={href(agent, page - 1)} className="inline-flex h-11 items-center rounded-sm border border-rule px-4 text-ink hover:border-accent">
              Newer
            </Link>
          )}
          {more && (
            <Link href={href(agent, page + 1)} className="inline-flex h-11 items-center rounded-sm border border-rule px-4 text-ink hover:border-accent">
              Older
            </Link>
          )}
          <span className="text-muted">Page {page}</span>
        </nav>
      )}
    </main>
  );
}
