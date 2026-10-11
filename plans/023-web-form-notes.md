# 023 — The enquiry's note says who sent it

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

The note an enquiry adds to its deal reads "Web form" on the timeline; notes from removed people still read "Someone
no longer in Guildhall".

## Why

Issue #49. The enquiry note has no user, so the timeline credited it to a removed person.

## Approach

A nullable `activity.source` column, like `deal.source`: "Web form" for the enquiry's note, null otherwise. The
timeline's `who` is the person's name, else the source, else null (a removed person). The migration also marks
notes already written by enquiries: the earliest note on each enquiry's deal, when it has no user.

## Tasks

### Task 1: Schema and rule

- [x] **Step 1:** `activity.source`; `npm run db:generate`; backfill existing enquiry notes in the new migration.
- [x] **Step 2:** `addActivity` takes an optional source; `receiveEnquiry` passes `WEB_FORM`; `listActivities` falls back to it.

### Task 2: Tests

- [x] **Step 1:** integration: an enquiry's note reads "Web form"; a removed person's note still reads null.
- [x] **Step 2:** e2e: the deal's timeline shows "Web form".

## Acceptance

- [x] Sending the enquiry form adds a note shown as from "Web form".
- [x] Notes from removed people still read "Someone no longer in Guildhall".

## Risks / open questions

- Matching on the deal's exact `created_at` was tried and rejected: PGlite's clock is coarse enough that a note
  added straight after in another transaction shared it (measured). "Earliest note on the deal" holds because the
  enquiry writes its note with the deal, before anyone can open it.
