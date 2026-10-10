"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskTarget } from "@/lib/tasks";
import { addTaskAction } from "./actions";

// One column, labels above fields, the button at the bottom left (DESIGN.md).
export function AddTaskForm({ target }: { target: TaskTarget }) {
  const [state, formAction, pending] = useActionState(addTaskAction.bind(null, target), {
    errors: {}, values: { title: "", dueOn: "" }, attempt: 0,
  });
  const { errors, values } = state;

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" name="title" defaultValue={values.title} autoComplete="off"
          aria-invalid={!!errors.title} aria-describedby={errors.title ? "task-title-error" : undefined} />
        {errors.title && <Problem id="task-title-error">{errors.title}</Problem>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="task-due">Due date</Label>
        <Input id="task-due" name="dueOn" type="date" defaultValue={values.dueOn} className="max-w-48"
          aria-invalid={!!errors.dueOn} aria-describedby={errors.dueOn ? "task-due-error" : undefined} />
        {errors.dueOn && <Problem id="task-due-error">{errors.dueOn}</Problem>}
      </div>
      {errors.target && <Problem>{errors.target}</Problem>}
      <div>
        <Button type="submit" disabled={pending}>Add task</Button>
      </div>
    </form>
  );
}

function Problem({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{children}</p>;
}
