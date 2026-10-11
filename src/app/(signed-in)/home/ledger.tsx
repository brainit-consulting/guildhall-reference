import Link from "next/link";
import type { DealsTotal } from "@/lib/deals";
import { DEAL_STAGES, type DealStage } from "@/lib/deal-stages";
import { formatMoney } from "@/lib/money";

export type Figures = {
  open: DealsTotal;
  won: DealsTotal;
  month: string; // YYYY-MM, the business's month the won figures are for
  stages: Record<DealStage, number>;
  overdue: number;
  dueToday: number;
  cold: number;
};

const deals = (n: number) => `${n} ${n === 1 ? "deal" : "deals"}`;
const tasks = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;

// Each figure links to the list it was counted from; the link's name says what it counts, since "3" alone doesn't.
const FIGURE = "font-display tabular-nums text-ink underline decoration-rule underline-offset-4 hover:text-accent hover:decoration-accent";

// Home's figures as a page of the ledger (DESIGN.md): labels in muted on hairline rules, figures in Young Serif.
export function Ledger({ f }: { f: Figures }) {
  return (
    <section aria-label="Figures" className="mt-8">
      <dl className="border-t border-rule">
        <Total label="Open deals" href="/deals?open=1" total={f.open} />
        <Total label="Won this month" href={`/deals?won=${f.month}`} total={f.won} />
      </dl>

      <h2 className="mt-8 text-sm text-muted">Deals at each stage</h2>
      <dl className="mt-2 grid grid-cols-3 border-t border-rule md:grid-cols-5">
        {DEAL_STAGES.map((s) => (
          <Count key={s} label={s} href={`/deals?stage=${s}`} name={`${s}: ${deals(f.stages[s])}`} n={f.stages[s]} />
        ))}
      </dl>

      <h2 className="mt-8 text-sm text-muted">Needs attention</h2>
      <dl className="mt-2 grid grid-cols-3 border-t border-rule">
        <Count label="Overdue" href="/tasks?due=overdue" name={`Overdue: ${tasks(f.overdue)}`} n={f.overdue} />
        <Count label="Due today" href="/tasks?due=today" name={`Due today: ${tasks(f.dueToday)}`} n={f.dueToday} />
        <Count label="Going cold" href="/deals?cold=1" name={`Going cold: ${deals(f.cold)}`} n={f.cold} />
      </dl>
    </section>
  );
}

// A line of the ledger: the label on the left, the count and what it is worth on the right.
function Total({ label, href, total }: { label: string; href: string; total: DealsTotal }) {
  const money = formatMoney(total.total);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-rule py-3">
      <dt className="text-muted">{label}</dt>
      <dd>
        <Link href={href} aria-label={`${label}: ${deals(total.count)}, worth ${money}`} className={`${FIGURE} text-2xl`}>
          {total.count}
          <span className="ml-6">{money}</span>
        </Link>
      </dd>
    </div>
  );
}

function Count({ label, href, name, n }: { label: string; href: string; name: string; n: number }) {
  return (
    <div className="border-b border-rule py-3 pr-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">
        <Link href={href} aria-label={name} className={`${FIGURE} text-2xl`}>{n}</Link>
      </dd>
    </div>
  );
}
