import { test, expect } from "@playwright/test";

for (const answer of ["IND", "BRA"]) {
  test(`mouse answer ${answer} keeps focus on the map and lets fullscreen controls respond immediately`, async ({
    page,
  }) => {
    await page.goto("/#/play");
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await page.locator(`[data-country="${answer}"]`).click();
    const next = page.getByRole("button", {
      name: "Pays suivant",
      exact: true,
    });
    await expect(next).toBeVisible();
    await expect(next).not.toBeFocused();
    await page
      .getByRole("button", { name: "Réduire le plein écran", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await page
      .getByRole("button", { name: "Quitter le jeu", exact: true })
      .click();
    await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await expect(
      page.getByRole("button", { name: "Pays suivant", exact: true }),
    ).toHaveCount(0);
  });
}

test("keyboard answers still move focus to the next country without scrolling", async ({
  page,
}) => {
  await page.goto("/#/play");
  await page.keyboard.press("Tab");
  await page.locator('[data-country="IND"]').focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Pays suivant", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({
    x: 0,
    y: 0,
  });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
});
