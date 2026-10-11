# 025 — The won follow-up

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

When a deal reaches Won, Guildhall adds one task on it, "Thank Ann Lee and ask for a referral", due a week after
the deal's won day. Once per deal, ever.

## Why

Issue #52, B16. The owner's words: "When I win a deal, remind me a week later to thank the customer and ask for a
referral." #51 added `task.automation` and the unique index `task_one_won_follow_up`.

## Approach

`src/lib/won-follow-up.ts` holds the rule: read the deal's `won_on` and its contact's and company's names, then one
insert with `on conflict do nothing`, so the index decides "once" and nothing selects for an existing task.
`deals.ts` calls it from `createDeal` (added at Won) and, through `afterMove`, from `updateDeal` and `moveDealStage`
when the deal moves from another stage to Won. No migration, no page change.

## Tasks

### Task 1: The rule

- [x] **Step 1:** `won-follow-up.ts`: `wonFollowUpDue` (won day + 7 via `addDays`) and `addWonFollowUp`.
- [x] **Step 2:** `won-follow-up.test.ts`: the due day, across a month and a year.

### Task 2: The three ways in

- [x] **Step 1:** `createDeal` calls it when the deal is added at Won; `updateDeal` and `moveDealStage` on a move
  into Won only.
- [x] **Step 2:** `won-follow-up.integration.test.ts`: each way in; saving at Won adds nothing; out and back, ticked
  done first, moves at once (Promise.all) and two adds at once all leave one; the three name cases and a renamed
  contact; the due day at 11pm New York on 31 Oct.

### Task 3: In the browser

- [x] **Step 1:** `e2e/won-follow-up.spec.ts`: contact, deal, Won on the board, the task on the deal page and on
  /tasks with today + 7 worked out by `todayIn(TIME_ZONE, …)`; Lost and back, open and ticked, still one.
- [x] **Step 2:** Tried it on the dev server.

## Acceptance

- [x] typecheck, lint, test, test:e2e and build pass.
- [x] Moving a deal to Won on the board shows the follow-up on the deal page and /tasks.

## Risks / open questions

- The task keeps the names it was made with; renaming the contact later doesn't retitle it (the issue says "as they
  are at that moment").
- A deal deleted between the read and the insert would fail the insert on the foreign key; not guarded, as it needs a
  delete within the same few milliseconds.
