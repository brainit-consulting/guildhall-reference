import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients";
import { db } from "@/lib/db/client";
import { EMPTY_PROJECT } from "@/lib/projects";
import { createProjectAction } from "../actions";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Add project" };

// "Add project" on a client's page opens this with ?client=<id>, so that client is already picked.
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  await requireSession();
  const asked = (await searchParams).client;
  const clients = await listClients(db);
  const picked = clients.find((c) => c.id === (Array.isArray(asked) ? asked[0] : asked));
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Add project</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <ProjectForm action={createProjectAction} initial={{ ...EMPTY_PROJECT, clientId: picked?.id ?? "" }} clients={clients}
          submitLabel="Add project" cancelHref={picked ? `/clients/${picked.id}` : "/projects"} />
      </div>
    </main>
  );
}
