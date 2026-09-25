import { test, expect } from "@playwright/test";

test("fullscreen controls avoid native title-bar interception and reduce immediately after a country answer", async ({
  page,
}) => {
  await page.goto("/#/play");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect(page.locator(".focus-fullscreen")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const reduce = (await page.locator(".focus-fullscreen").boundingBox())!;
    const exit = (await page.locator(".focus-exit").boundingBox())!;
    // Account for the 8px click halo as well. Native title-bar hit regions
    // live outside the DOM and cannot be reproduced with synthetic clicks.
    expect(reduce.y - 8).toBeGreaterThanOrEqual(64);
    expect(exit.y - 8).toBeGreaterThanOrEqual(64);
    const country = (await page.locator('[data-country="CHN"]').boundingBox())!;

    // No locator auto-wait, DOM assertion, pan or delay between these clicks.
    await page.mouse.click(
      country.x + country.width / 2,
      country.y + country.height / 2,
    );
    await page.mouse.click(
      reduce.x + reduce.width / 2,
      reduce.y + reduce.height / 2,
    );

    await expect(page.locator(".focus-fullscreen")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(
      page.getByRole("button", { name: "Pays suivant", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Pays suivant", exact: true })
      .click();
  }
});
