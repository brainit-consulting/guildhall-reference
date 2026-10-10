import { expect, test } from "@playwright/test";

// Guildhall's look (DESIGN.md) holds at phone and desktop widths: nothing scrolls sideways, the fonts load.
for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`the welcome page at ${size.width}px`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    const fonts = await page.evaluate(() => {
      const family = (sel: string) => getComputedStyle(document.querySelector(sel)!).fontFamily;
      return { heading: family("h1"), body: family("p") };
    });
    expect(fonts.heading).toMatch(/Young Serif/i);
    expect(fonts.body).toMatch(/IBM Plex Sans/i);
    await page.screenshot({ path: info.outputPath(`welcome-${size.width}.png`) });
  });
}
