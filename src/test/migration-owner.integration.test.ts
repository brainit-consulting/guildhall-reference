// The B6 migration makes the earliest existing account the owner, for copies that had accounts before it.
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const dir = "drizzle/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const run = (client: PGlite, file: string) => client.exec(readFileSync(`${dir}/${file}`, "utf8").split("--> statement-breakpoint").join(""));

describe("the owner migration", () => {
  it("promotes the earliest account when there is no owner", async () => {
    const client = new PGlite();
    await run(client, files[0]);
    await client.exec(`insert into "user" (id, name, email, created_at) values
      ('b', 'Later', 'later@lynn.example', '2026-10-02'), ('a', 'First', 'first@lynn.example', '2026-10-01')`);
    for (const f of files.slice(1)) await run(client, f);
    const { rows } = await client.query<{ email: string; role: string }>(`select email, role from "user" order by email`);
    expect(rows).toEqual([{ email: "first@lynn.example", role: "owner" }, { email: "later@lynn.example", role: "member" }]);
    await client.close();
  });
});
