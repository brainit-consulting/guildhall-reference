"use server";

import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { createTask, createTaskOn, setTaskDone, type TaskErrors, type TaskInput, type TaskTarget } from "@/lib/tasks";

// `attempt` changes on every answer, so the form remounts: with what was typed after a refusal, emptied after a save.
// `on` is what the Tasks page's picker sent ("deal:<id>"); a record page leaves it empty.
export type AddTaskState = { errors: TaskErrors; values: TaskInput & { on: string }; attempt: number };

const KINDS: unknown[] = ["contact", "company", "deal"] satisfies TaskTarget["type"][];

// Bound arguments still arrive from the browser, so their shape is checked; createTask checks the record exists.
const isTarget = (t: unknown): t is TaskTarget =>
  typeof t === "object" && t !== null && KINDS.includes((t as TaskTarget).type) && typeof (t as TaskTarget).id === "string";

// Each action checks the session itself: server actions can be called by anyone who can send a POST.
// A record page binds its target; the Tasks page binds null and sends the picked record as `on`.
export async function addTaskAction(target: TaskTarget | null, prev: AddTaskState, form: FormData): Promise<AddTaskState> {
  await requireSession();
  const input: TaskInput = { title: String(form.get("title") ?? ""), dueOn: String(form.get("dueOn") ?? "") };
  const on = String(form.get("on") ?? "");
  const saved = target === null ? await createTaskOn(db, on, input)
    : isTarget(target) ? await createTask(db, target, input)
    : { errors: { target: "That record has been deleted, so no task was added." } };
  if (saved.errors) return { errors: saved.errors, values: { ...input, on }, attempt: prev.attempt + 1 };
  refresh(); // the list is rendered by the page
  return { errors: {}, values: { title: "", dueOn: "", on: "" }, attempt: prev.attempt + 1 };
}

// Ticks or unticks; setTaskDone checks the id.
export async function setTaskDoneAction(taskId: string, done: boolean): Promise<{ error: string | null }> {
  await requireSession();
  const result = await setTaskDone(db, String(taskId), done === true);
  if (!result.error) refresh(); // a ticked task leaves the open list
  return result;
}
