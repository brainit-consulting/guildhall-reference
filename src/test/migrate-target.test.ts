import { describe, expect, it } from "vitest";
import { migrationTarget } from "../../scripts/migrate-target.mjs";

describe("migrationTarget", () => {
  it("uses the built-in database on this computer", () => {
    expect(migrationTarget({})).toBe("pglite");
  });
  it("uses Neon when DATABASE_URL is set locally", () => {
    expect(migrationTarget({ DATABASE_URL: "postgres://x" })).toBe("neon");
  });
  it("migrates Neon for Vercel's production build", () => {
    expect(migrationTarget({ VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: "postgres://x" })).toBe("neon");
  });
  it("never migrates the live database from a pull request's preview build", () => {
    expect(migrationTarget({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" })).toBe("skip");
  });
});
