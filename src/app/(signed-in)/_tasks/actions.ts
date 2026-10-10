"use server";

import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { createTask, setTaskDone, type TaskErrors, type TaskInput, type TaskTarget } from "@/lib/tasks";

// `attempt` changes on every answer, so the form remounts: with what was typed after a refusal, emptied after a save.
export type AddTaskState = { errors: TaskErrors; values: TaskInput; attempt: number };

const KINDS: unknown[] = ["contact", "company", "deal"] satisfies TaskTarget["type"][];

// Bound arguments still arrive from the browser, so their shape is checked; createTask checks the record exists.
const isTarget = (t: unknown): t is TaskTarget =>
  typeof t === "object" && t !== null && KINDS.includes((t as TaskTarget).type) && typeof (t as TaskTarget).id === "string";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.
export async function addTaskAction(target: TaskTarget, prev: AddTaskState, form: FormData): Promise<AddTaskState> {
  await requireSession();
  const values: TaskInput = { title: String(form.get("title") ?? ""), dueOn: String(form.get("dueOn") ?? "") };
  const saved = isTarget(target)
    ? await createTask(db, target, values)
    : { errors: { target: "That record isn't in Guildhall any more, so no task was added." } };
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  refresh(); // the list is rendered by the page
  return { errors: {}, values: { title: "", dueOn: "" }, attempt: prev.attempt + 1 };
}

// Ticks or unticks; setTaskDone checks the id.
export async function setTaskDoneAction(taskId: string, done: boolean): Promise<{ error: string | null }> {
  await requireSession();
  const result = await setTaskDone(db, String(taskId), done === true);
  if (!result.error) refresh(); // a ticked task leaves the open list
  return result;
}
