"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { createProject, deleteProject, setProjectStatus, updateProject, type ProjectErrors, type ProjectInput } from "@/lib/projects";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.

// `attempt` changes on every refused save, so the form remounts with what was typed rather than React's reset.
export type ProjectFormState = { errors: ProjectErrors; values: ProjectInput; attempt: number };

function read(form: FormData): ProjectInput {
  const field = (name: string) => String(form.get(name) ?? "");
  return { name: field("name"), clientId: field("clientId"), budget: field("budget"), startOn: field("startOn"), endOn: field("endOn") };
}

export async function createProjectAction(prev: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireSession();
  const values = read(form);
  const saved = await createProject(db, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/projects/${saved.id}`);
}

export async function updateProjectAction(id: string, prev: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  await requireSession();
  const values = read(form);
  const saved = await updateProject(db, id, values);
  if (!saved) redirect("/projects"); // deleted meanwhile
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  redirect(`/projects/${id}`);
}

// "Mark done", and "Mark active" to undo it.
export async function setProjectStatusAction(form: FormData) {
  await requireSession();
  const id = String(form.get("id") ?? "");
  if (!(await setProjectStatus(db, id, String(form.get("status") ?? "")))) redirect("/projects"); // deleted meanwhile
  redirect(`/projects/${id}`);
}

export async function deleteProjectAction(form: FormData) {
  await requireSession();
  await deleteProject(db, String(form.get("id") ?? ""));
  redirect("/projects");
}
