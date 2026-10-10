// What an activity can be (spec B11). Kept apart from activities.ts, with no imports, so the browser-side form can list
// them without bundling the database code. Stage changes are written by Guildhall itself, never picked on the form.
export const ACTIVITY_KINDS = ["note", "call", "meeting", "stage_change"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const LOGGABLE_KINDS = ["note", "call", "meeting"] as const satisfies readonly ActivityKind[];

export const KIND_NAMES: Record<ActivityKind, string> = {
  note: "Note", call: "Call", meeting: "Meeting", stage_change: "Stage change",
};
