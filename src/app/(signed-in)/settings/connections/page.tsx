import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/session";
import { listConnections, type Connection } from "@/lib/connections";
import { db } from "@/lib/db/client";
import { LocalTime } from "../agent-log/local-time";
import { Disconnect } from "./disconnect";

export const metadata: Metadata = { title: "Connected agents" };

const ACCESS = { read: "Read only", change: "Read and change" } as const;

function Row({ c }: { c: Connection }) {
  return (
    <li className="flex flex-col gap-3 border-b border-rule py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h2 className="font-display text-xl text-ink wrap-anywhere">{c.agentName}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Connected by</dt>
          <dd className="text-ink wrap-anywhere">{c.person}</dd>
          <dt className="text-muted">May</dt>
          <dd className="text-ink">{ACCESS[c.access]}</dd>
          <dt className="text-muted">Connected</dt>
          <dd className="text-ink tabular-nums">{c.connectedAt ? <LocalTime at={c.connectedAt.toISOString()} /> : "Not known"}</dd>
          <dt className="text-muted">Last used</dt>
          <dd className="text-ink tabular-nums">{c.lastUsedAt ? <LocalTime at={c.lastUsedAt.toISOString()} /> : "Not used yet"}</dd>
        </dl>
      </div>
      <Disconnect agent={c.agentName} person={c.person} clientId={c.clientId} userId={c.userId} />
    </li>
  );
}

export default async function ConnectionsPage() {
  await requireOwner();
  const connections = await listConnections(db);

  return (
    <main className="max-w-3xl px-6 py-12 md:px-12">
      <p>
        <Link href="/settings" className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-accent md:min-h-0">
          Settings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink -ml-px md:-ml-6">Connected agents</h1>
      <p className="mt-2 text-muted">
        Agents that can reach your Guildhall. Disconnect one and it stops working at once, until it is allowed again.
      </p>

      {connections.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-4 text-muted">
          No agents connected. The Intermediate course&apos;s chapter 6 shows how to connect Claude.
        </p>
      ) : (
        <ul aria-label="Agents" className="mt-8 border-t border-rule">
          {connections.map((c) => <Row key={`${c.clientId} ${c.userId}`} c={c} />)}
        </ul>
      )}
    </main>
  );
}
