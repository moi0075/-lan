import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the new learning identity keeps the catalogue accessible", async ({
  page,
}) => {
  for (const route of [
    "/#/themes",
    "/#/themes/geography/world",
    "/#/progress",
  ]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      result.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map(({ target }) => target),
      })),
    ).toEqual([]);
  }
});
