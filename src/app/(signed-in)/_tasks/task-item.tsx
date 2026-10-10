"use client";

import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { formatDay } from "@/lib/dates";
import type { TaskLine } from "@/lib/tasks";
import { setTaskDoneAction } from "./actions";

const noChange = () => () => {};

type Props = {
  task: Pick<TaskLine, "id" | "title" | "dueOn" | "doneAt">;
  // under the title, e.g. a link to what the task belongs to on the Tasks page
  children?: React.ReactNode;
};

// One task: due day, title, tick box. Ticking saves at once; the page's list then drops or keeps it as it filters.
export function TaskItem({ task, children }: Props) {
  const [done, setDone] = useOptimistic(task.doneAt !== null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // A tick before hydration would show as done without saving, so the box waits for JavaScript.
  const hydrated = useSyncExternalStore(noChange, () => true, () => false);

  function tick(next: boolean) {
    startTransition(async () => {
      setDone(next);
      setError((await setTaskDoneAction(task.id, next)).error);
    });
  }

  return (
    <li className="flex items-start gap-4 border-b border-rule py-3">
      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
        <p className="text-sm text-muted"><time dateTime={task.dueOn}>{formatDay(task.dueOn)}</time></p>
        <div className="min-w-0">
          <p className={done ? "wrap-anywhere text-muted line-through" : "wrap-anywhere text-ink"}>{task.title}</p>
          {children}
          {error && <p role="alert" className="mt-1 border-l-2 border-danger pl-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
      {/* the label widens the tap target without changing the box */}
      <label className="-m-2 flex shrink-0 cursor-pointer p-2">
        <input type="checkbox" checked={done} disabled={!hydrated} onChange={(e) => tick(e.target.checked)} aria-label={`Done: ${task.title}`}
          className="size-5 cursor-pointer accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      </label>
    </li>
  );
}
