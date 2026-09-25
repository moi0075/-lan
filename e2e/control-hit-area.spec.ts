import { test, expect } from "@playwright/test";

test("ordinary held clicks activate the full button surface including icons, edges and visual halo", async ({
  page,
}) => {
  await page.goto("/#/play");
  const initialProgress = await page.evaluate(() =>
    localStorage.getItem("atlas-learning-v1"),
  );

  const clickSpot = async (selector: string, spot: string) => {
    const rect = (await page.locator(selector).boundingBox())!;
    const x = rect.x + (spot === "icon" ? 21 : rect.width / 2);
    const y =
      rect.y +
      (spot === "top"
        ? 0.5
        : spot === "bottom-halo"
          ? rect.height + 3
          : rect.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(220);
    await page.mouse.up();
  };
  for (const spot of ["bottom-halo", "icon", "text", "top"]) {
    await clickSpot(".focus-fullscreen", spot);
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await clickSpot(".focus-fullscreen", spot);
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await clickSpot(".focus-exit", spot);
    await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
    await page
      .getByRole("button", { name: "Jouer en plein écran", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Réduire le plein écran", exact: true })
      .click();
  }
  expect(
    await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
  ).toBe(initialProgress);
});
