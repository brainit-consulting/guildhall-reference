import { expect, test, type Locator } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const look = (field: Locator) => field.evaluate((el) => ({ tag: el.tagName, size: getComputedStyle(el).fontSize }));

// Safari zooms into any field under 16px, on an iPhone held sideways or an iPad as much as on a phone held upright.
for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ storageState: OWNER_STATE, viewport });

    test("an input and a select on /tasks are 16px", async ({ page }) => {
      await page.goto("/tasks");
      await expect(page.getByLabel("Title")).toBeVisible(COLD);
      expect(await look(page.getByLabel("Title"))).toEqual({ tag: "INPUT", size: "16px" });
      expect(await look(page.getByRole("combobox", { name: "Due", exact: true }))).toEqual({ tag: "SELECT", size: "16px" });
    });
  });
}
