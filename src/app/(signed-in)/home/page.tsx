import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { monthIn, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { coldDealsTotal, dealsPerStage, openDealsTotal, wonInMonth } from "@/lib/deals";
import { dueTasks, type TaskLine } from "@/lib/tasks";
import { TaskItem } from "../_tasks/task-item";
import { Ledger } from "./ledger";

export const metadata: Metadata = { title: "Home · Guildhall" };

const PATH = { contact: "/contacts", company: "/companies", deal: "/deals" } as const;

export default async function Home() {
  // Reading the session reads the request, so the page renders on every visit and today is never a cached one.
  const { user } = await requireSession();
  // One moment for every figure, so today, this month and going cold agree with each other.
  const now = new Date();
  const month = monthIn(TIME_ZONE, now);
  const [due, open, won, stages, cold] = await Promise.all([
    dueTasks(db, todayIn(TIME_ZONE, now)), openDealsTotal(db, undefined, now), wonInMonth(db, month), dealsPerStage(db),
    coldDealsTotal(db, now),
  ]);
  const nothing = due.overdue.length === 0 && due.today.length === 0;

  return (
    <main className="max-w-2xl px-6 py-12 md:px-12">
      <h1 className="font-display text-4xl text-ink -ml-px md:-ml-6">Welcome, {user.name}.</h1>
      <Ledger f={{ open, won, month, stages, overdue: due.overdue.length, dueToday: due.today.length, cold: cold.count }} />
      {nothing ? (
        <p className="mt-12 border-t border-rule pt-4 text-muted">Nothing due today.</p>
      ) : (
        <>
          <Due id="overdue" heading="Overdue" tasks={due.overdue} />
          <Due id="due-today" heading="Due today" tasks={due.today} />
        </>
      )}
    </main>
  );
}

// A section of Home's tasks; left out when it has none.
function Due({ id, heading, tasks }: { id: string; heading: string; tasks: TaskLine[] }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="font-display text-2xl text-ink">{heading}</h2>
      <ol aria-labelledby={id} className="mt-4 border-t border-rule">
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t}>
            <Link href={`${PATH[t.on.type]}/${t.on.id}`} className="text-sm text-accent underline-offset-4 wrap-anywhere hover:underline">
              {t.on.name}
            </Link>
          </TaskItem>
        ))}
      </ol>
    </section>
  );
}
