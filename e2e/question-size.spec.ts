import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 831, height: 700 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`placement panel stays stable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const answer of ["skip", "IND", "BRA", "hint"]) {
      await page.goto("/#/play");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const panel = page.locator(".stable-question");
      await expect(panel).toBeVisible();
      const before = await panel.boundingBox();
      const skip = await page
        .getByRole("button", { name: "Je ne sais pas encore", exact: true })
        .boundingBox();
      const heading = await page
        .locator(".focus-question-heading")
        .boundingBox();
      if (answer === "hint") {
        await page
          .getByRole("button", { name: "Indice : 5 pays", exact: true })
          .click();
        await expect(
          page.getByText("5 zones possibles sur la carte"),
        ).toBeVisible();
        expect(await panel.boundingBox()).toEqual(before);
        await expect(page.getByText(/Une seule zone est correcte/)).toHaveCount(
          0,
        );
        await page.locator('[data-country="IND"]').click();
      } else if (answer === "skip") {
        await page
          .getByRole("button", { name: "Je ne sais pas encore", exact: true })
          .click();
      } else {
        await page.locator(`[data-country="${answer}"]`).click();
      }
      const next = page.getByRole("button", {
        name: "Pays suivant",
        exact: true,
      });
      await expect(next).toBeVisible();
      expect(await panel.boundingBox()).toEqual(before);
      expect(
        await page.locator(".focus-question-heading").boundingBox(),
      ).toEqual(heading);
      expect(await next.boundingBox()).toEqual(skip);
      await next.click();
      await expect(
        page.getByRole("heading", { name: "Chine ?" }),
      ).toBeVisible();
      expect(await panel.boundingBox()).toEqual(before);
    }
  });
}
