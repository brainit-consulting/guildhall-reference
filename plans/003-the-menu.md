# 003 — The menu

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-10

## Goal

Every signed-in page has the same menu: Home, Settings (owner only), Sign out at the bottom; a top bar under 768px.

## Why

Issue #3 (spec B6, DESIGN.md "Layout"). Later chapters each add a page to this menu, so adding one must be one line.

## Approach

Move `/home` and `/settings` into a `(signed-in)` route group whose layout calls `requireSession()` and renders the
menu. URLs don't change. The menu items are one array in `src/lib/menu.ts`, with pure helpers (which items a role
sees, which item is current) that get unit tests. A client component reads `usePathname()` to mark the current item
and owns the open/closed state of the phone bar.

## Tasks

### Task 1: Menu rules

- [x] **Step 1:** `src/lib/menu.ts`: `MENU` array, `menuFor(role)`, `isCurrent(pathname, href)`.
- [x] **Step 2:** `src/lib/menu.test.ts`.

### Task 2: Layout and menu

- [x] **Step 1:** `src/components/app-menu.tsx`: left column from 768px, top bar with a Menu button below it.
- [x] **Step 2:** `src/app/(signed-in)/layout.tsx`; move `home/` and `settings/` into the group.
- [x] **Step 3:** Home loses its own Sign out button (the menu has it) and the full-height centring.

### Task 3: Tests

- [x] **Step 1:** `e2e/menu.spec.ts`: owner moves Home ↔ Settings at 1280px and 390px; member has no Settings;
  nothing scrolls sideways.

## Acceptance

- [x] The menu shows on Home and Settings; the owner sees Settings, a member doesn't.
- [x] At 390px the menu is a top bar that opens and closes, and the page doesn't scroll sideways.
- [x] typecheck, lint, test, test:e2e, build pass; tried in a browser.

## Risks / open questions

- The theme toggle stays out of the menu: the issue doesn't ask for it.
