"use client";

import { formatDay } from "@/lib/dates";
import type { TaskLine } from "@/lib/tasks";
import { TickBox, TickError, useTick } from "./task-item";

type Props = {
  task: Pick<TaskLine, "id" | "title" | "dueOn" | "doneAt">;
  on: React.ReactNode; // what the task belongs to, as a link
};

// One task as a table row on the Tasks page: due day, title, what it is for, tick box.
export function TaskRow({ task, on }: Props) {
  const { done, error, tick } = useTick(task);

  return (
    <tr className="border-b border-rule align-top">
      <td className="whitespace-nowrap px-3 py-3 text-ink"><time dateTime={task.dueOn}>{formatDay(task.dueOn)}</time></td>
      <td className="px-3 py-3">
        <span className={done ? "wrap-anywhere text-muted line-through" : "wrap-anywhere text-ink"}>{task.title}</span>
        <TickError error={error} />
      </td>
      <td className="px-3 py-3">{on}</td>
      <td className="px-3 py-3"><TickBox title={task.title} done={done} tick={tick} /></td>
    </tr>
  );
}
