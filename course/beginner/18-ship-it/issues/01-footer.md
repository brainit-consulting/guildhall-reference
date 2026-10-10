# A footer on every page

Guildhall is about to go live. Give every page a small footer, so I can see at a glance which version I'm looking at.

## What it should do
- A footer at the bottom of every page, signed in or not: the business's name (as set in chapter 17), the year, and the app's version from
  `package.json`, in the muted colour.
- For the owner, signed-in pages also show a "Settings" link in it.
- It never covers content, and stays at the bottom on short pages.

## Done when
- [ ] The footer shows on the welcome page, sign-in and Home, with the version number.
- [ ] Tests: a Playwright test that the footer shows the version on the welcome page.
- [ ] Tried in a browser
