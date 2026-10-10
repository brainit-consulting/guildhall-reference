# Guildhall's look

Read this before any UI work. Use only these tokens; no one-off colours, fonts or shadows.

## Tone

A market-town guildhall's ledger: businesslike first, warm second, never a game. Pages read like a well-kept
account book: ruled lines, clear figures, plain words.

## Colours

Defined once in `src/app/globals.css` and used through Tailwind as `bg-paper`, `text-ink`, `border-rule` and so on.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#F5F0E6` | `#1B1916` | page background |
| `panel` | `#FBF8F2` | `#24211D` | forms, the menu, table headers |
| `ink` | `#22201C` | `#EDE6D8` | text |
| `muted` | `#6B645A` | `#A79E8F` | secondary text, hints, empty states |
| `rule` | `#D9CFBD` | `#3A352E` | hairline borders and table rules |
| `accent` | `#1E5E57` | `#5FA89E` | the one accent: links, primary buttons, the current menu item, the current stage |
| `danger` | `#9B2C1F` | `#E07A6A` | delete buttons and error messages only |

One accent. Stages, statuses and charts use `ink`, `muted` and `accent` shades, not a rainbow.

## Type

- Headings: **Young Serif** (`font-display`).
- Everything else, including tables and forms: **IBM Plex Sans** (`font-sans`), 15px body.
- Numbers in tables and totals: `tabular-nums`, right-aligned.

## Layout

- Left-aligned. Lists are tables with hairline `rule` lines, not grids of cards.
- Square corners (2px at most). No shadows, gradients, glows, glass or blur.
- One deliberate break: page titles hang into the left margin (`-ml-px` on small screens, `md:-ml-6` from 768px).
- Forms: one column, labels above fields, the primary button at the bottom left.
- Under 768px the menu becomes a top bar; nothing scrolls sideways.

## Words in the UI

- Plain verbs on buttons: "Add contact", "Move to Won", "Save", "Delete".
- Never show internal IDs. Dates as "12 Oct 2026".
- Money: right-aligned, two decimals, the currency from `src/lib/money.ts` (Beginner 9 adds it).
- Empty states say what to do next: "No contacts yet. Add your first."
- Errors say what happened and what to do, in one sentence.
