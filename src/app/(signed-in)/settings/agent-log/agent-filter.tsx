"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import type { LoggedAgent } from "@/lib/agent-log";

// Picking an agent shows its entries at once, from the newest; without the script, the Show button sends the form.
// The address holds the agent's client ID (`agent=`), never shown on the page.
export function AgentFilter({ path, agents, current }: { path: string; agents: LoggedAgent[]; current: string | null }) {
  const router = useRouter();
  const show = (clientId: string) => router.push(clientId ? `${path}?${new URLSearchParams({ agent: clientId })}` : path, { scroll: false });
  return (
    <form action={path} method="get" className="flex flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); show(new FormData(e.currentTarget).get("agent") as string); }}>
      <Label htmlFor="log-agent">Agent</Label>
      <div className="flex gap-2">
        <select id="log-agent" name="agent" value={current ?? ""} onChange={(e) => show(e.target.value)}
          className="h-11 min-w-0 max-w-full rounded-sm border border-rule bg-panel px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <option value="">Every agent</option>
          {agents.map((a) => <option key={a.clientId} value={a.clientId}>{a.name}</option>)}
        </select>
        <noscript>
          <button type="submit" className="h-11 rounded-sm border border-rule px-3 text-sm text-ink">Show</button>
        </noscript>
      </div>
    </form>
  );
}
