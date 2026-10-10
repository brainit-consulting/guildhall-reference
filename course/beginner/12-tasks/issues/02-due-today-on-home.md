# Overdue and due today on Home

When I open Guildhall, the first thing I should see is what I owe people today.

## What it should do
- Home gets two sections: "Overdue" (open tasks due before today) and "Due today".
- Each line shows the task, what it belongs to (linked) and a tick box to mark it done.
- If both are empty: "Nothing due today."
- "Today" is the business's local date, not the server's.

## Done when
- [ ] A task due yesterday shows under Overdue; one due today under Due today; ticking it removes it.
- [ ] Tests: a unit test for deciding overdue and due today; a Playwright test for Home's sections.
- [ ] Tried in a browser

Depends on #<number of the issue "Tasks">
