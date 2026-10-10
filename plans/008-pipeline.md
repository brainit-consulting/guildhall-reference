# 008 — The pipeline board

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

A Pipeline item in the menu opens `/pipeline`: five columns, New to Lost, each with its deal count and total, cards
that open their deal, and two ways to move a card: drag it, or its "Move to…" menu.

## Why

Issue #15 (spec B10). The MCP `move_deal_stage` tool and B11's "Moved from X to Y" activity will move deals too, so
the move is one plain function on `db` that says which stage the deal left.

## Approach

No schema change: `deal.stage` exists. `moveDealStage(db, id, stage)` in `src/lib/deals.ts` returns `{ from, to }`
(null for no such deal or stage). `pipelineColumns(deals)` groups deals into the five stages with a count and an
exact total; `addMoney` in `money.ts` sums decimal strings in whole cents with BigInt, so the browser can redo the
totals at once when a card moves, without floats. The board is a client component over `useOptimistic`: the card
moves on the frame it is dropped, the server action saves it and calls `refresh()`. Dragging is `@dnd-kit/core`
6.3.1 (named in the issue), with mouse and touch sensors only; keyboards use "Move to…".

## Tasks

### Task 1: Rules and data

- [x] **Step 1:** `addMoney` in `money.ts`; tests.
- [x] **Step 2:** `moveDealStage` in `deals.ts`, `pipelineColumns` in `pipeline.ts` (no database imports); unit and
  integration tests.

### Task 2: The page

- [x] **Step 1:** Pipeline in `MENU`, after Deals.
- [x] **Step 2:** `moveDealAction`; `/pipeline` page; `board.tsx` with columns, cards, drag and "Move to…".

### Task 3: Tests and checks

- [x] **Step 1:** `e2e/pipeline.spec.ts`: move with "Move to…", totals follow; drag; phone width scrolls inside the
  board only; signed out goes to sign-in.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] Dragging a card, or "Move to…", changes the deal's stage and the column totals.

## Risks / open questions

- Stage changes are not logged as activities yet: activities arrive with B11, which will log from `moveDealStage`'s
  `{ from, to }`.
- Cards within a column are newest first, as on `/deals`; there is no manual ordering within a column.
- A deal with no value shows "No value" on its card and adds nothing to its column's total.
- From 1280px the five columns share the width; below that each is 16rem and the board scrolls sideways.
- The "Move to…" menu opens inside its card rather than floating: the board's sideways scroll box would clip a
  floating menu on the bottom card (seen in the browser at phone width).
- Touch dragging uses dnd-kit's TouchSensor (press and hold); it was not tried on a real touch screen, only a mouse.
