"use client";

import { useActionState } from "react";
import { RecordPicker } from "@/components/record-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskTarget, TaskTargetChoice } from "@/lib/tasks";
import { addTaskAction } from "./actions";

// On a record page the task is for that record; on the Tasks page the form picks it from `choices`.
type Props = { target: TaskTarget; choices?: never } | { target?: never; choices: TaskTargetChoice[] };

// One column, labels above fields, the button at the bottom left (DESIGN.md).
export function AddTaskForm({ target, choices }: Props) {
  const [state, formAction, pending] = useActionState(addTaskAction.bind(null, target ?? null), {
    errors: {}, values: { title: "", dueOn: "", on: "" }, attempt: 0,
  });
  const { errors, values } = state;

  return (
    <form key={state.attempt} action={formAction} noValidate className="flex flex-col gap-5">
      {choices && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="task-on">Contact, company or deal</Label>
          <RecordPicker
            id="task-on"
            name="on"
            choices={choices.map((c) => ({ id: c.value, name: c.name, detail: c.detail }))}
            defaultId={values.on}
            noneLabel="Nothing picked"
            listLabel="Contacts, companies and deals"
            noMatch={(typed) => `Nothing matches “${typed}”. Add the contact, company or deal first.`}
            invalid={!!errors.target}
            describedBy={errors.target ? "task-on-error" : undefined}
          />
          {errors.target && <Problem id="task-on-error">{errors.target}</Problem>}
        </div>
      )}
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
      {errors.target && !choices && <Problem>{errors.target}</Problem>}
      <div>
        <Button type="submit" disabled={pending}>Add task</Button>
      </div>
    </form>
  );
}

function Problem({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{children}</p>;
}
