import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asksToChange } from "@/lib/agent-access";
import { agentName } from "@/lib/agents";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Connect an agent" };

type SearchParams = Record<string, string | string[] | undefined>;

// Better-Auth sends the person here, with the agent's signed request in the address, when an agent asks to sign in
// as them (I5). Not signed in: sign in first, keeping the request, and Better-Auth brings them back.
export default async function ConsentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);

  const session = await getSession();
  if (!session) redirect(`/signin?${query}`);

  const clientId = query.get("client_id");
  const name = clientId && query.has("sig") ? await agentName(db, clientId) : null;
  return (
    <main className="mx-auto flex w-full flex-1 max-w-md flex-col justify-center px-6 py-12">
      {name ? (
        <>
          <h1 className="font-display text-4xl break-words text-ink -ml-px md:-ml-6">{name} wants to use your Guildhall</h1>
          <p className="mt-3 text-muted">
            You are signed in as {session.user.name}. Whatever you allow, {name} does as you.
          </p>
          <ConsentForm agent={name} canChange={asksToChange(query.get("scope"))} requested={query.get("scope") ?? ""} />
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Connect an agent</h1>
          <p role="alert" className="mt-6 border-l-2 border-danger pl-3 text-danger">
            This link doesn&apos;t work any more. Go back to the agent and connect it again.
          </p>
        </>
      )}
    </main>
  );
}
