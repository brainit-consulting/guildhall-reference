// The B14 migration gives deals already at Won the day they were won, so they don't drop out of "Won this month".
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const dir = "drizzle/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const wonOn = files.findIndex((f) => readFileSync(`${dir}/${f}`, "utf8").includes(`ADD COLUMN "won_on"`));
const run = (client: PGlite, file: string) => client.exec(readFileSync(`${dir}/${file}`, "utf8").split("--> statement-breakpoint").join(""));

describe("the won_on migration", () => {
  it("fills the business's day of the latest move into Won, else of the last edit, for Won deals only", async () => {
    const client = new PGlite();
    for (const f of files.slice(0, wonOn)) await run(client, f);
    await client.exec(`
      insert into deal (id, title, stage, updated_at) values
        ('00000000-0000-4000-8000-00000000000a', 'Moved twice', 'Won', '2026-10-06 12:00'),
        ('00000000-0000-4000-8000-00000000000b', 'Added at Won', 'Won', '2026-10-03 15:00'),
        ('00000000-0000-4000-8000-00000000000c', 'Late evening', 'Won', '2026-11-01 03:30'),
        ('00000000-0000-4000-8000-00000000000d', 'Won then lost', 'Lost', '2026-10-02 12:00');
      insert into activity (kind, body, deal_id, created_at) values
        ('stage_change', 'Moved from Proposal to Won', '00000000-0000-4000-8000-00000000000a', '2026-09-15 12:00'),
        ('stage_change', 'Moved from Won to Proposal', '00000000-0000-4000-8000-00000000000a', '2026-09-20 12:00'),
        -- 03:30 UTC on 1 Oct is 11:30pm on 30 Sep in New York
        ('stage_change', 'Moved from Proposal to Won', '00000000-0000-4000-8000-00000000000a', '2026-10-01 03:30'),
        ('note', 'Sent the invoice', '00000000-0000-4000-8000-00000000000a', '2026-10-05 12:00'),
        ('stage_change', 'Moved from Proposal to Won', '00000000-0000-4000-8000-00000000000d', '2026-10-01 12:00'),
        ('stage_change', 'Moved from Won to Lost', '00000000-0000-4000-8000-00000000000d', '2026-10-02 12:00');
    `);
    for (const f of files.slice(wonOn)) await run(client, f);
    const { rows } = await client.query<{ title: string; won_on: string | null }>(
      `select title, won_on::text from deal order by title`);
    expect(rows).toEqual([
      { title: "Added at Won", won_on: "2026-10-03" },
      { title: "Late evening", won_on: "2026-10-31" }, // updated_at, in New York
      { title: "Moved twice", won_on: "2026-09-30" },
      { title: "Won then lost", won_on: null },
    ]);
    await client.close();
  });
});
