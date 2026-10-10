# Guildhall CRM

A CRM for a small business: contacts, companies, deals on a pipeline board, tasks, a dashboard, a public enquiry
form and, later, agents such as Claude connected over MCP. This repo is the **starter**: sign-in, a database and the
house rules. The features are built by [Code Dungeon](https://codedungeon-guide.vercel.app)'s coders, one issue at a
time, in the Guildhall courses.

## Start your own

1. On GitHub, press **Use this template**, then **Create a new repository** (private is fine).
2. Connect it to Code Dungeon as a chamber. The course's lessons say exactly how.

Nothing needs setting up on your computer: the app keeps its data in a built-in database in `.data/`. Going live on
Vercel needs two settings, described in `.env.example`.

## For the coders

Read `AGENTS.md`. Commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | brings the built-in database up to date, then runs the app |
| `npm test` | unit and integration tests (in-memory database) |
| `npm run test:e2e` | browser tests on this copy's own port |
| `npm run db:generate` | writes a migration after a schema change |

## What's in `course/`

The issues and briefs students file in each chapter of the courses. The app never reads that folder.

## Licence

MIT. See `LICENSE`.
