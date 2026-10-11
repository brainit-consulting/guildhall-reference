import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { quietDays } from "@/lib/cold";
import { checkInColdDeals } from "@/lib/cold-check-in";
import { monthIn, TIME_ZONE, todayIn } from "@/lib/dates";
import { db } from "@/lib/db/client";
import {
  coldDeals, coldDealsTotal, dealsPerStage, HOME_COLD_LIMIT, openDealsTotal, wonInMonth, type DealWithNames,
} from "@/lib/deals";
import { formatMoney } from "@/lib/money";
import { dueTasks, type TaskLine } from "@/lib/tasks";
import { TaskItem } from "../_tasks/task-item";
import { Ledger } from "./ledger";

export const metadata: Metadata = { title: "Home" };

const PATH = { contact: "/contacts", company: "/companies", deal: "/deals" } as const;

export default async function Home() {
  // Reading the session reads the request, so the page renders on every visit and today is never a cached one.
  const { user } = await requireSession();
  // One moment for every figure, so today, this month and going cold agree with each other: the ledger's Going cold
  // and the section's "All N going cold" read the same count.
  const now = new Date();
  const month = monthIn(TIME_ZONE, now);
  // B16: today's check-ins first, so they are in Due today and its count on this same load.
  await checkInColdDeals(db, now);
  const [due, open, won, stages, cold, coldList] = await Promise.all([
    dueTasks(db, todayIn(TIME_ZONE, now)), openDealsTotal(db, undefined, now), wonInMonth(db, month), dealsPerStage(db),
    coldDealsTotal(db, now), coldDeals(db, now, HOME_COLD_LIMIT),
  ]);
  const nothing = due.overdue.length === 0 && due.today.length === 0;

  return (
    // wide enough for Going cold's four columns
    <main className="max-w-3xl px-6 py-12 md:px-12">
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
      <GoingCold deals={coldList} count={cold.count} now={now} />
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

// Open deals with nothing logged for 14 days (src/lib/cold.ts), longest quiet first; `count` is all of them, `deals`
// the first few. Always shown, so the owner can see there are none.
function GoingCold({ deals, count, now }: { deals: DealWithNames[]; count: number; now: Date }) {
  const quiet = (d: DealWithNames) => `Nothing for ${quietDays(d, now)} days`;
  return (
    <section aria-labelledby="going-cold" className="mt-12">
      <h2 id="going-cold" className="font-display text-2xl text-ink">Going cold</h2>
      {deals.length === 0 ? (
        <p className="mt-4 border-t border-rule pt-4 text-muted">No deals going cold.</p>
      ) : (
        <>
          {/* Under 768px each deal is a stacked block: the title as the link, then "Label: value" lines (DESIGN.md). */}
          <ul aria-label="Deals going cold" className="mt-4 border-t border-rule md:hidden">
            {deals.map((d) => (
              <li key={d.id} className="border-b border-rule py-3">
                <DealLink d={d} />
                {d.companyId && (
                  <p className="mt-1 text-sm text-ink wrap-anywhere"><span className="text-muted">Company:</span> <CompanyLink d={d} /></p>
                )}
                {d.value && (
                  <p className="mt-1 text-sm text-ink"><span className="text-muted">Value:</span> <span className="tabular-nums">{formatMoney(d.value)}</span></p>
                )}
                <p className="mt-1 text-sm text-ink">{quiet(d)}</p>
              </li>
            ))}
          </ul>

          <table aria-label="Deals going cold" className="mt-4 hidden w-full border-collapse text-left md:table">
            <thead>
              <tr className="border-y border-rule bg-panel text-sm text-muted">
                {/* the title gets the larger share; a long company name wraps instead */}
                <th scope="col" className="w-2/5 px-3 py-2 font-normal">Title</th>
                <th scope="col" className="w-1/4 px-3 py-2 font-normal">Company</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Value</th>
                <th scope="col" className="px-3 py-2 font-normal">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-rule">
                  <td className="px-3 py-2 wrap-anywhere"><DealLink d={d} /></td>
                  <td className="px-3 py-2 wrap-anywhere">{d.companyId && <CompanyLink d={d} />}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">{d.value && formatMoney(d.value)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{quiet(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {count > deals.length && (
            <p className="mt-4">
              <Link href="/deals?cold=1" className="text-accent underline-offset-4 hover:underline">All {count} going cold</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DealLink({ d }: { d: DealWithNames }) {
  return <Link href={`/deals/${d.id}`} className="text-accent underline-offset-4 wrap-anywhere hover:underline">{d.title}</Link>;
}

function CompanyLink({ d }: { d: DealWithNames }) {
  return <Link href={`/companies/${d.companyId}`} className="text-accent underline-offset-4 hover:underline">{d.companyName}</Link>;
}
