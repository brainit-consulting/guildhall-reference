# My business's name and colour

Guildhall should carry my business's name and my brand colour, set in one place.

## What it should do
- One file, `src/lib/brand.ts`, holds `BUSINESS_NAME` ("<your business name>") and `BRAND_COLOUR` ("<your colour>").
- The business name replaces "Guildhall" wherever the app names itself: the browser tab's title, the top of the menu,
  the welcome page's heading and the enquiry form.
- The brand colour becomes the accent colour in `src/app/globals.css` (light and dark mode) and in `DESIGN.md`'s colour
  table. Everything that used the old accent now uses it.
- Text and links in the accent colour must stay readable: at least 4.5 to 1 contrast against the page background.
  If the brand colour is lighter than that, use a darker shade of it for text and links, and the brand colour itself
  only for button backgrounds with dark text on them. Write the check as `contrastRatio(a, b)` with unit tests.

## Done when
- [ ] The tab, menu, welcome page and enquiry form show my business's name.
- [ ] Buttons, links and the current menu item use my colour, and every text stays readable in light and dark mode.
- [ ] Tests: unit tests for `contrastRatio`; the Playwright tests that looked for "Guildhall" now look for the
  business name.
- [ ] Tried in a browser
