import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/clients";
import { db } from "@/lib/db/client";
import { getProject } from "@/lib/projects";
import { updateProjectAction } from "../../actions";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const p = await getProject(db, id);
  if (!p) notFound();
  const clients = await listClients(db);
  const initial = { name: p.name, clientId: p.clientId, budget: p.budget, startOn: p.startOn, endOn: p.endOn };
  return (
    <main className="max-w-xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6 wrap-anywhere">Edit {p.name}</h1>
      <div className="mt-8 border-t border-rule pt-6">
        <ProjectForm action={updateProjectAction.bind(null, p.id)} initial={initial} clients={clients} submitLabel="Save" cancelHref={`/projects/${p.id}`} />
      </div>
    </main>
  );
}
