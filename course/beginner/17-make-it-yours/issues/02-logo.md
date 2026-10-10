# My logo

My logo should be the first thing people see in the menu, and the icon in their browser tab.

## What it should do
- The logo is the file in `public/brand/` (an SVG or PNG; there is only one).
- Show it at the top of the menu, about 40 pixels high, with the business name beside it, and above the heading on
  the welcome page. Its alternative text is the business name.
- Use it as the browser tab's icon (`src/app/icon.png` or `src/app/icon.svg`, Next.js's own convention).
- If `public/brand/` is empty, show the business name alone, in the heading font, and keep the current icon.

## Done when
- [ ] The logo shows in the menu, on the welcome page and in the browser tab, sharp on a phone too.
- [ ] Tests: a Playwright test that the menu shows an image whose alternative text is the business name.
- [ ] Tried in a browser

Depends on #<number of the issue "My business's name and colour">
