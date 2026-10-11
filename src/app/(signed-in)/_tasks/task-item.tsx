"use client";

import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { formatDay } from "@/lib/dates";
import type { TaskLine } from "@/lib/tasks";
import { setTaskDoneAction } from "./actions";

const noChange = () => () => {};

type Task = Pick<TaskLine, "id" | "title" | "dueOn" | "doneAt">;

type Props = {
  task: Task;
  // under the title, e.g. a link to what the task belongs to on the Tasks page
  children?: React.ReactNode;
};

// Whether a task shows as done, and ticking it: saves at once; the page's list then drops or keeps it as it filters.
export function useTick(task: Task) {
  const [done, setDone] = useOptimistic(task.doneAt !== null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function tick(next: boolean) {
    startTransition(async () => {
      setDone(next);
      setError((await setTaskDoneAction(task.id, next)).error);
    });
  }
  return { done, error, tick };
}

// The tick box, for a list item or a table cell.
export function TickBox({ title, done, tick }: { title: string; done: boolean; tick: (next: boolean) => void }) {
  // A tick before hydration would show as done without saving, so the box waits for JavaScript.
  const hydrated = useSyncExternalStore(noChange, () => true, () => false);
  return (
    // the label widens the tap target without changing the box
    <label className="-m-2 flex shrink-0 cursor-pointer p-2">
      <input type="checkbox" checked={done} disabled={!hydrated} onChange={(e) => tick(e.target.checked)} aria-label={`Done: ${title}`}
        className="size-5 cursor-pointer accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
    </label>
  );
}

export function TickError({ error }: { error: string | null }) {
  return error && <p role="alert" className="mt-1 border-l-2 border-danger pl-3 text-sm text-danger">{error}</p>;
}

// One task: due day, title, tick box.
export function TaskItem({ task, children }: Props) {
  const { done, error, tick } = useTick(task);

  return (
    <li className="flex items-start gap-4 border-b border-rule py-3">
      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
        <p className="text-sm text-muted"><time dateTime={task.dueOn}>{formatDay(task.dueOn)}</time></p>
        <div className="min-w-0">
          <p className={done ? "wrap-anywhere text-muted line-through" : "wrap-anywhere text-ink"}>{task.title}</p>
          {children}
          <TickError error={error} />
        </div>
      </div>
      <TickBox title={task.title} done={done} tick={tick} />
    </li>
  );
}
