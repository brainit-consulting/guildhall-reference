"use server";

import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { moveDealStage } from "@/lib/deals";

// Checks the session itself: server actions can be called by anyone who can send a POST. Refreshes either way, so a
// card moved after its deal was deleted elsewhere drops off the board rather than staying where it was put.
export async function moveDealAction(id: string, stage: string): Promise<void> {
  await requireSession();
  await moveDealStage(db, id, stage);
  refresh();
}
