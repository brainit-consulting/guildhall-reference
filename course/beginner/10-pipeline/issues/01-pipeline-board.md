# The pipeline board

I want to see all my deals as cards on a board, one column per stage, and move them along as they progress.

## What it should do
- A Pipeline item in the menu, opening `/pipeline`.
- Five columns in stage order: New, Contacted, Proposal, Won, Lost. Each shows its number of deals and their total
  value.
- Each card shows the deal's title, company and value, and opens the deal when clicked.
- Drag a card to another column to change its stage. Use `@dnd-kit/core`.
- Every card also has a "Move to…" menu that does the same without dragging, for keyboards and touch screens.
- On a phone the columns scroll sideways inside the board; the page itself doesn't.

## Done when
- [ ] Dragging a card, or using "Move to…", changes the deal's stage and the column totals.
- [ ] Tests: an integration test for changing a stage; a Playwright test that moves a deal with "Move to…".
- [ ] Tried in a browser
