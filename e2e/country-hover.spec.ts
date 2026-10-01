import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 831, height: 700 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`country names stay clear of the question at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/play");
    await page.locator('[data-country="BRA"]').click();
    await expect(
      page.getByRole("button", { name: "Pays suivant", exact: true }),
    ).toBeVisible();

    for (const fullscreen of [false, true]) {
      if (fullscreen) {
        await page
          .getByRole("button", { name: "Plein écran", exact: true })
          .click();
        await expect
          .poll(() => page.evaluate(() => !!document.fullscreenElement))
          .toBe(true);
      }
      await page.mouse.move(1, viewport.height / 2);
      await page.locator('[data-country="BRA"]').hover();
      const label = page.locator(".map-hover");
      await expect(label).toHaveText("Brésil");
      const rect = (await label.boundingBox())!;
      const question = (await page.locator(".focus-question").boundingBox())!;
      const controls = (await page.locator(".map-bottom").boundingBox())!;
      expect(rect.y).toBeGreaterThanOrEqual(question.y + question.height);
      expect(rect.y + rect.height).toBeLessThanOrEqual(controls.y);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
      await page.mouse.move(1, viewport.height / 2);
      await expect(label).toHaveCount(0);
    }
  });
}
