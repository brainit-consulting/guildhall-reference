# 032 — List pages: 44px tap targets

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

On a touch screen under 1200px wide, every control on /contacts, /companies and /deals can be tapped in at least
44×44px, and the desktop look at 1280px is unchanged (issue #73).

## Why

The phone-ready check (`window.__phoneCheck`) measured, before this change: the Sort by choices 34px tall at 375px;
the record-name links 19px tall wherever they stand alone; the column-heading sort links 27–38px wide at 844 and
810px. The three list pages share SearchBox, SortBy and SortHeading, so all three had the same faults.

## Approach

Follow the house rule in globals.css: touch sizes apply under `(pointer: coarse)`, so a mouse never sees a change. A
`tap-target` utility grows a standalone link's box to 44×44 on touch; the Sort by summary and its choices get a 44px
minimum height there. Root font is 15px, so sizes are in px, not Tailwind's rem steps (`min-h-11` would be 41px).

## Tasks

### Task 1: Shared controls

- [x] **Step 1:** `tap-target` utility in globals.css.
- [x] **Step 2:** SortHeading links use it (adds the missing width).
- [x] **Step 3:** SortBy summary and choices are 44px tall on touch.

### Task 2: List pages

- [x] **Step 1:** Name links and table company links on /contacts, /companies and /deals use `tap-target`.

### Task 3: Tests and checks

- [x] **Step 1:** Playwright test measuring every list control on a touch screen at 375×667, 844×390, 810×1080, and
      that the 1280 desktop sizes don't change.
- [x] **Step 2:** typecheck, lint, test, test:e2e, build; phone check by hand at the four sizes.

## Acceptance

- [x] `__phoneCheck()` reports no problems on the three list pages at 375×667, 844×390, 810×1080 and 1366×1024.
- [x] 1280×800 screenshots match the ones taken before the change.

## Risks / open questions

- The issue says "below 1200px wide"; the house rule and the check both key on a touch pointer. A narrow mouse window
  keeps desktop sizes, which matches what the check measures.
