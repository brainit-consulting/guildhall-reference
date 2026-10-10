# 007 — Deals

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

A Deals item in the menu opens `/deals`: every deal with its company, value, stage and expected close date, the open
deals' count and total above the table, and a page per deal with Edit and Delete.

## Why

Issue #13 (spec B9). The pipeline board, activities, the dashboard and the MCP `get_deal` / `list_pipeline` tools all
read deals, so reads, writes and the open total live in plain functions on `db`, as contacts and companies do.

## Approach

A `deal` table: title required; value `numeric(12,2)` (a string in TypeScript, null when left blank); stage a Postgres
enum of the five fixed stages, default New; optional contact and company (on delete set null, so deleting either
keeps the deal); expected close as a `date`. `src/lib/money.ts` holds `CURRENCY`, `formatMoney` (Intl formats the
decimal string exactly, no float) and `parseMoney` (what was typed to "1234.50"). `src/lib/deals.ts` holds
`checkDeal`, list/get/create/update/delete and `openDealsTotal` (the sum is done by Postgres in numeric).

The deal form picks a contact and a company with the same type-to-narrow combobox as the contact form, so that
combobox moves to `src/components/record-picker.tsx` and the company picker becomes a thin wrapper over it.

## Tasks

### Task 1: Money

- [x] **Step 1:** `src/lib/money.ts`: `CURRENCY`, `formatMoney`, `parseMoney`; `money.test.ts`.

### Task 2: Data

- [x] **Step 1:** `deal_stage` enum and `deal` in `schema.ts`; `npm run db:generate`.
- [x] **Step 2:** `src/lib/deals.ts`: `DEAL_STAGES`, `checkDeal`, `listDeals`, `getDeal`, `createDeal`, `updateDeal`,
  `deleteDeal`, `openDealsTotal`, `listContactChoices`.
- [x] **Step 3:** `deals.test.ts` (checkDeal) and `deals.integration.test.ts` (every read and write, the open total).

### Task 3: Pages

- [x] **Step 1:** Deals in `MENU`, after Companies.
- [x] **Step 2:** `record-picker.tsx`; company picker wraps it; a contact picker for deals.
- [x] **Step 3:** `/deals`: open count and total, the table (stacked rows under 768px), the empty state.
- [x] **Step 4:** `/deals/new` and `/deals/[id]/edit` sharing `deal-form.tsx`; `/deals/[id]` with Edit and Delete.

### Task 4: Tests and checks

- [x] **Step 1:** `e2e/deals.spec.ts`: add, edit, delete, the open total; a missing title and a bad value are
  explained; phone width; signed out goes to sign-in.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; tried in a browser.

## Acceptance

- [x] I can add, edit and delete a deal, and the open total adds up.
- [x] Changing `CURRENCY` to "ZAR" or "EUR" changes how every amount shows.

## Risks / open questions

- A blank value is stored as null (unknown), shown as "Not given", and counts as nothing in the open total.
- Money is shown with `en-US` grouping and the currency's narrow symbol ("$1,234.50", "R 1,234.50", "€1,234.50"),
  one locale for server and browser so both render the same.
- Typed values may include grouping commas, spaces and a leading currency symbol; more than two decimals, negatives
  and anything over 9,999,999,999.99 (the numeric(12,2) limit) are refused with a sentence.
- The stage list lives in `src/lib/deal-stages.ts` (no imports), so the browser-side form can list the stages
  without bundling the database code; `schema.ts` builds the enum from it.
- Picking a contact does not fill in their company; both are chosen separately, as the issue lists them.
