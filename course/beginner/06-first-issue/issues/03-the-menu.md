# The menu

Every signed-in page needs the same way around Guildhall.

## What it should do
- A menu down the left of every signed-in page: Home, and Settings for the owner, with "Sign out" at the bottom.
- The page you're on is marked in the accent colour.
- Under 768px wide the menu becomes a bar across the top that opens and closes.
- Later chapters add their own items to this menu, so make adding one a one-line change.

## Done when
- [ ] The menu shows on every signed-in page; the owner sees Settings, others don't.
- [ ] On a phone-sized window the menu is a top bar and nothing scrolls sideways.
- [ ] Tests: a Playwright test that moves between Home and Settings using the menu, at desktop and phone width.
- [ ] Tried in a browser

Depends on #<number of the issue "The first person to sign up owns the Guildhall">
