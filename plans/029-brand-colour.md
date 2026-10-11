# 029 — Brand colour as the one accent

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

The accent is Hollow Oak Joinery's #8A4B2A in light mode and the nearest readable shade of it in dark mode, and a
test fails if the CSS stops matching `BRAND_COLOUR` or drops below 4.5:1.

## Why

Issue #60 (chapter 17, part 4). The starter's teal is still the accent. The owner wants text readable "whatever my
colour is", so the shading is a function, not a hand-picked value.

## Approach

`src/lib/colour.ts` holds `contrastRatio` (WCAG 2) and `readableShade` (mix towards black on light backgrounds, white
on dark, 1% at a time, until 4.5:1 against every background). The CSS holds the values the function gives;
`brand-colours.test.ts` reads `globals.css` and checks each mode's `--accent` against the function and the ratio.

## Tasks

### Task 1: the rule

- [x] **Step 1:** `colour.test.ts`: ratios (21, 1, order, #777777) and shading cases.
- [x] **Step 2:** `colour.ts` until they pass.

### Task 2: the tokens

- [x] **Step 1:** `brand-colours.test.ts` reading `globals.css` for light, the dark media block and `.dark`.
- [x] **Step 2:** Set `--accent` in all three places from `readableShade`.
- [x] **Step 3:** DESIGN.md accent row and the sentence under the table.

### Task 3: Delete stays distinct

- [x] **Step 1:** Look at a company page in light and dark; decide whether `danger` must move.

## Acceptance

- [x] No teal left; buttons, links, current menu item, current stage, picker row and switches use the new accent.
- [x] typecheck, lint, test, test:e2e and build pass.
- [x] Tried in a browser, light and dark.

## Risks / open questions

- The brown sat near the brick-red `danger`. Seen side by side in light mode, #9B2C1F Delete and the #8A4B2A
  buttons read as two russets, so light `danger` moved to #B91C1C (pure red, 5.70:1 on paper). Dark mode's salmon
  #E07A6A stays clearly apart from the dusty #AC7F68, so it is unchanged. `brand-colours.test.ts` checks `danger` too.
