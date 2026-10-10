# A follow-up when a deal is won

Winning a deal is the best moment to ask for a referral, and I always forget.

## What it should do
- When a deal moves to Won (from the board or the form), create a task on it: "Thank <contact name> and ask for a
  referral", due 7 days later.
- Only once per deal: moving it out of Won and back again doesn't create a second one.
- If the deal has no contact, use the company's name; if neither, "Thank the customer and ask for a referral".

## Done when
- [ ] Moving a deal to Won creates the task, due in 7 days; doing it again doesn't add another.
- [ ] Tests: integration tests for the task, the "once" rule and the names.
- [ ] Tried in a browser
