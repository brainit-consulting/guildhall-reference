import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { listTaskTargetChoices, listTasks, type TaskLine } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { AddTaskForm } from "../_tasks/add-task-form";
import { TaskItem } from "../_tasks/task-item";
import { TaskRow } from "../_tasks/task-row";

export const metadata: Metadata = { title: "Tasks · Guildhall" };

const KIND = { contact: "Contact", company: "Company", deal: "Deal" } as const;
const PATH = { contact: "/contacts", company: "/companies", deal: "/deals" } as const;

type Search = Promise<{ done?: string | string[] }>;

export default async function TasksPage({ searchParams }: { searchParams: Search }) {
  await requireSession();
  const showDone = (await searchParams).done === "show";
  const [tasks, choices] = await Promise.all([
    listTasks(db, showDone ? {} : { status: "open" }),
    listTaskTargetChoices(db),
  ]);

  return (
    <main className="max-w-5xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Tasks</h1>

      <section aria-labelledby="add-task" className="mt-8 max-w-md">
        <h2 id="add-task" className="font-display text-2xl text-ink">Add task</h2>
        <div className="mt-4">
          <AddTaskForm choices={choices} />
        </div>
      </section>

      <section aria-labelledby="task-list" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="task-list" className="font-display text-2xl text-ink">{showDone ? "Open and done" : "Open"}</h2>
          <ShowDone on={showDone} />
        </div>

        {tasks.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-muted">No open tasks. Add one above, or from a contact, company or deal.</p>
        ) : (
          <>
            {/* Under 768px each task is a stacked block: due day, title, then "Deal: name" (DESIGN.md). */}
            <ol aria-label="Tasks" className="mt-4 border-t border-rule md:hidden">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t}>
                  <p className="mt-1 text-sm wrap-anywhere"><span className="text-muted">{KIND[t.on.type]}:</span> <OnLink t={t} /></p>
                </TaskItem>
              ))}
            </ol>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table aria-label="Tasks" className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule bg-panel text-sm text-muted">
                    <th scope="col" className="w-36 px-3 py-2 font-medium">Due</th>
                    <th scope="col" className="px-3 py-2 font-medium">Task</th>
                    <th scope="col" className="px-3 py-2 font-medium">For</th>
                    <th scope="col" className="w-16 px-3 py-2 font-medium">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} on={
                      <span className="wrap-anywhere"><span className="text-sm text-muted">{KIND[t.on.type]}</span> <OnLink t={t} /></span>
                    } />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function OnLink({ t }: { t: TaskLine }) {
  return <Link href={`${PATH[t.on.type]}/${t.on.id}`} className="text-accent underline-offset-4 hover:underline">{t.on.name}</Link>;
}

// A switch kept in the address (/tasks?done=show): a GET form with one button, so a reload keeps it, Space or Enter
// flips it, and it works before the page has hydrated.
function ShowDone({ on }: { on: boolean }) {
  return (
    <Form action="/tasks" scroll={false}>
      {!on && <input type="hidden" name="done" value="show" />}
      <button type="submit" role="switch" aria-checked={on}
        className="inline-flex cursor-pointer items-center gap-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span aria-hidden className={cn("flex h-5 w-9 items-center rounded-sm border p-0.5", on ? "border-accent bg-accent" : "border-rule bg-panel")}>
          <span className={cn("size-3.5 rounded-[1px] transition-transform", on ? "translate-x-4 bg-paper" : "bg-muted")} />
        </span>
        Show done
      </button>
    </Form>
  );
}
