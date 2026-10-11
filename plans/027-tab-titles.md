# 027 — Tab titles and sign-in say the business's name

**Status:** done
**Owner:** Aldric the Smith
**Last updated:** 2026-10-11

## Goal

Every browser tab reads "<page> · <business name>", the welcome tab reads the bare name, and sign-in and sign-up name
the business, all from `BUSINESS_NAME` in `src/lib/brand.ts`.

## Why

Chapter 17 (Make it yours), issue #58. Pages typed "· Guildhall" into their own titles, so changing the name meant
editing 19 files. #57 sets the name; this makes everything follow it.

## Approach

The root layout's metadata gets `title: { default: BUSINESS_NAME, template: "%s · BUSINESS_NAME" }`. Each page gives
only its own part, and Next applies the template. `src/app/page.tsx` sits in the root segment, so the template doesn't
apply to it and it shows the default; it is not edited (the logo issue rebuilds it).

## Tasks

### Task 1: the template

- [x] **Step 1:** `src/app/layout.tsx`: title template and a plain description naming the business.

### Task 2: the pages

- [x] **Step 1:** Drop "· Guildhall" from every page's `metadata` / `generateMetadata` (18 pages) and from `/enquire`.
- [x] **Step 2:** Sign-in "Welcome back to <name>."; sign-up "Create your account for <name>."

### Task 3: tests

- [x] **Step 1:** `e2e/titles.spec.ts`: welcome, `/signin`, `/enquire`, `/contacts`, a new deal's page.
- [x] **Step 2:** typecheck, lint, unit, e2e, build; check the tabs in a browser.

## Acceptance

- [x] No page types "Guildhall" into its title (`grep "· Guildhall" src` finds nothing).
- [x] The welcome tab reads the bare name, seen in a browser.
- [x] Sign-in and sign-up name the business.

## Risks / open questions

- `e2e/enquire.spec.ts` still checks "Ask for a quote · Guildhall"; that's the string produced while the name is
  Guildhall, and #57 changes that file, so it is left alone here.
