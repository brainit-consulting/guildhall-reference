# 031 — A footer on every page

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

Every page ends with a muted footer: the business's name, the year and the version from `package.json`; the owner's
signed-in pages add a Settings link.

## Why

Issue #67. Guildhall is about to go live and the owner wants to see which version they're looking at.

## Approach

One server component, `AppFooter`, reads `BUSINESS_NAME` from `src/lib/brand.ts` and `APP_VERSION` (package.json) and
the year per request (`connection()`, so a prerendered page never shows last year). Signed-in pages get it from the
`(signed-in)` layout, inside the content column beside the menu; the public pages (welcome, sign-in, sign-up, enquiry
form) move into a `(public)` route group whose layout adds it. URLs don't change. Both layouts are flex columns at least
the screen's height with the footer last, never fixed, so it can't cover content and sits at the foot of short pages.

## Tasks

### Task 1: the footer

- [x] **Step 1:** `src/lib/version.ts` and its unit test.
- [x] **Step 2:** `src/components/app-footer.tsx`.

### Task 2: the layouts

- [x] **Step 1:** move `page.tsx`, `signin`, `signup`, `enquire` into `src/app/(public)/` with a layout that adds the
  footer; their `min-h-screen` becomes `flex-1`.
- [x] **Step 2:** `(signed-in)/layout.tsx`: footer in the content column, Settings for the owner.

### Task 3: tests and checks

- [x] **Step 1:** `e2e/footer.spec.ts`: welcome, sign-in, Home at 390px and 1280px, a short page, a member without
  Settings.
- [x] **Step 2:** typecheck, lint, unit, e2e, build; look at it in a browser, light and dark.

## Acceptance

- [x] The welcome page, sign-in and Home show the name, the year and the version in the muted colour.
- [x] The owner's footer has Settings; a member's and a visitor's don't.
- [x] On a short page the footer's bottom edge is the screen's.

## Risks / open questions

- Moving four pages into a group renames them in git; a teammate editing one at the same time gets a rename to merge.
- The 404 page is Next's built-in one, outside both groups, so it has no footer.
- At 390px the line wraps; each dot is kept with the item after it so none is left hanging at a line's end.
- `connection()` makes /enquire render per request; it reads no session, so it could otherwise be prerendered.
