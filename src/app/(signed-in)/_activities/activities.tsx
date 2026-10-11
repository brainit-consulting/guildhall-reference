import { listActivities, KIND_NAMES, type ActivityTarget } from "@/lib/activities";
import { db } from "@/lib/db/client";
import { LocalDay } from "./local-day";
import { LogActivityForm } from "./log-activity-form";

// The Activity section of a contact, company or deal page: Log activity, then the timeline, newest first.
export async function Activities({ target }: { target: ActivityTarget }) {
  const entries = await listActivities(db, target);

  return (
    <section aria-labelledby="activity" className="mt-12">
      <h2 id="activity" className="font-display text-2xl text-ink">Activity</h2>
      <div className="mt-4 border-t border-rule pt-4">
        <LogActivityForm target={target} />
      </div>
      {entries.length === 0 ? (
        <p className="mt-8 border-t border-rule pt-4 text-muted">Nothing logged yet. Log a call, meeting or note above.</p>
      ) : (
        <ol aria-label="Timeline" className="mt-8 border-t border-rule">
          {entries.map((a) => (
            <li key={a.id} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <p className="text-sm text-muted">{KIND_NAMES[a.kind]}</p>
              <div>
                <p className="whitespace-pre-line wrap-anywhere text-ink">{a.body}</p>
                <p className="mt-1 text-sm text-muted">
                  {a.who ?? "Someone who no longer has an account"}, <LocalDay at={a.createdAt.toISOString()} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
