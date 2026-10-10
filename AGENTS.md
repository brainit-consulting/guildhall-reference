# Guildhall CRM: house rules

## 1. What this is

Guildhall is a CRM for one small business per copy. Read `docs/spec.md` for the product and `DESIGN.md` before any
UI work. Each issue you're given adds one piece; build that piece, nothing more.

## 2. Stack

Next.js 16.3.5 (App Router), React 19.2.4, TypeScript, Better-Auth 1.7.5, Drizzle ORM 0.45.2, Tailwind v4, Zod 4,
Vitest 4, Playwright 1.63. Versions are pinned exactly: don't upgrade or add a library unless the issue asks for it.
Before Next.js-specific code, read the docs bundled in `node_modules/next/dist/docs/`. Middleware lives in
`src/proxy.ts` (Next 16's name for it).

## 3. Database

- On this computer the app uses PGlite, a Postgres that runs inside the app, in `.data/` (git-ignored; every copy has
  its own). On Vercel it uses Neon through `DATABASE_URL`. Never require `DATABASE_URL` locally.
- To change the schema: edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit the new SQL in
  `drizzle/migrations/`. `npm run dev` and `npm run build` apply it (`scripts/migrate.mjs`).
- Never edit or delete a migration that's already on `main`; add a new one.
- Import the database as `db` from `src/lib/db/client.ts`.

## 4. Settings

Read settings only through `src/lib/env.ts`; never read `process.env` anywhere else. A new setting goes in its schema,
its tests and `.env.example`, with a default that works locally.

## 5. Working rules

- Never show internal IDs (database keys) in the UI. URLs may contain them.
- Anything touching more than three files starts with a plan in `plans/NNN-slug.md` from `plans/_template.md`; tick
  its steps as you go.
- Money is `numeric(12,2)` in the database and a string in TypeScript; never a float.
- Signed-in pages call `requireSession()` from `src/lib/auth/session.ts`.
- MCP tools (from the Intermediate course) may return record IDs to agents; the UI still never shows them.

## 6. Tests ship with the issue

- A rule or calculation: a unit test next to it (`*.test.ts`).
- Anything that reads or writes data: an integration test (`*.integration.test.ts`) on `createTestDb()` from
  `src/test/db.ts`, a fresh in-memory database.
- A new page: a Playwright test in `e2e/`. Before your first run on this computer: `npx playwright install chromium`.

## 7. Done means

`npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e` all pass, and you've tried the change in a
browser yourself.

## 8. Style

Terse comments that say why. No emojis. Words in the UI follow `DESIGN.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
