import { db } from "@/lib/db/client";
import { listTasks, type TaskTarget } from "@/lib/tasks";
import { AddTaskForm } from "./add-task-form";
import { TaskItem } from "./task-item";

// The Tasks section of a contact, company or deal page: its open tasks by due day, then Add task.
export async function Tasks({ target }: { target: TaskTarget }) {
  const tasks = await listTasks(db, { on: target, status: "open" });

  return (
    <section aria-labelledby="tasks" className="mt-12">
      <h2 id="tasks" className="font-display text-2xl text-ink">Tasks</h2>
      {tasks.length === 0 ? (
        <p className="mt-4 border-t border-rule pt-4 text-muted">No open tasks. Add one below.</p>
      ) : (
        <ol aria-label="Open tasks" className="mt-4 border-t border-rule">
          {tasks.map((t) => <TaskItem key={t.id} task={t} />)}
        </ol>
      )}
      <div className="mt-8">
        <AddTaskForm target={target} />
      </div>
    </section>
  );
}
