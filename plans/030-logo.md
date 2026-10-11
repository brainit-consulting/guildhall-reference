# 030 — The logo in the menu, on the welcome page and as the tab icon

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

The menu and the welcome page show Hollow Oak Joinery's logo and name from `src/lib/brand.ts`, and the browser tab
shows the logo.

## Why

Chapter 17 (Make it yours), issue #61. The menu and the welcome heading say a hard-coded "Guildhall", the welcome page
still has starter copy, and there is no tab icon.

## Approach

One `BrandMark` component draws the logo (`BRAND_LOGO`) and the name (`BUSINESS_NAME`), or the name alone when there is
no logo. The menu uses it small with the image as the accessible name; the welcome page puts a larger, decorative logo
above an `h1` of the name. The tab icon is Next's `src/app/icon.svg` file convention, a copy of the logo, kept in step by
a unit test. A plain `<img>` keeps the SVG sharp without the image optimiser.

## Tasks

### Task 1: the mark

- [x] **Step 1:** `src/components/brand-mark.tsx`.

### Task 2: menu and welcome page

- [x] **Step 1:** `src/components/app-menu.tsx` uses the mark (logo 40px, name wraps in the 224px sidebar).
- [x] **Step 2:** `src/app/page.tsx`: 64px logo above the name heading; one plain line replaces the starter copy.

### Task 3: tab icon

- [x] **Step 1:** `src/app/icon.svg`, a copy of `public/brand/hollow-oak.svg`.
- [x] **Step 2:** `src/lib/brand-icon.test.ts`: the icon is byte-for-byte the logo file.

### Task 4: tests and checks

- [x] **Step 1:** `e2e/starter.spec.ts` heading is the name; `e2e/brand.spec.ts` menu image, welcome logo, icon link.
- [x] **Step 2:** typecheck, lint, unit, e2e, build; look at 390px and 1280px, light and dark, 3x scale, and with a
  40-character name (not committed).

## Acceptance

- [x] Signed in, the menu shows the logo with the name beside it at 390px and 1280px, light and dark.
- [x] The welcome page shows the logo above the name heading; no starter copy.
- [x] The head has `link rel="icon"` whose address serves the SVG.

## Risks / open questions

- The icon test can't tell Next's file convention to follow `BRAND_LOGO`; if the logo becomes a PNG, the test fails until
  `src/app/icon.png` replaces `icon.svg`, which is the point.
- With a 40-character name the 224px sidebar wraps it, but a single word wider than about 124px ("Cabinetmaker")
  breaks mid-word. `hyphens: auto` was tried and measured: headless Chromium applied it and still did not hyphenate,
  so it was left out. `break-words` keeps the page from scrolling sideways.
