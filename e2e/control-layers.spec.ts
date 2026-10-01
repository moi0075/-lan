import { expect, test, type Page } from "@playwright/test";

async function checkHoverAndClick(page: Page, selector: string, label: string) {
  const button = page.locator(selector);
  await expect(button).toHaveAttribute("aria-label", label);
  const r = (await button.boundingBox())!;
  // Inspect the actual hit target and cursor, not just the button's own styles.
  for (const [dx, dy] of [
    [21, r.height / 2],
    [r.width / 2, r.height / 2],
    [r.width - 4, 4],
    [r.width / 2, r.height + 3],
  ]) {
    const point = { x: r.x + dx, y: r.y + dy };
    await page.mouse.move(point.x, point.y);
    const hit = await page.evaluate(({ x, y }) => {
      const node = document.elementFromPoint(x, y)!;
      const button = node.closest("button");
      const blockers: string[] = [];
      for (
        let ancestor = button?.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        if (getComputedStyle(ancestor).pointerEvents === "none")
          blockers.push(ancestor.className);
      }
      return {
        label: button?.getAttribute("aria-label"),
        cursor: getComputedStyle(node).cursor,
        hover: button?.matches(":hover"),
        blockers,
      };
    }, point);
    expect(hit).toEqual({
      label,
      cursor: "pointer",
      hover: true,
      blockers: [],
    });
  }
  // One physical click, without locator retries or a compensating map click.
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 831, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`controls keep the hand cursor above the map after answers and gestures at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/play");
    for (const answer of ["IND", "BRA"]) {
      const enter = page.getByRole("button", {
        name: "Plein écran",
        exact: true,
      });
      await enter.click();
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      if (
        await page
          .getByRole("button", { name: "Pays suivant", exact: true })
          .isVisible()
      )
        await page
          .getByRole("button", { name: "Pays suivant", exact: true })
          .click();
      await page.locator(`[data-country="${answer}"]`).click();
      await expect(
        page.getByRole("button", { name: "Pays suivant", exact: true }),
      ).toBeVisible();
      const progress = await page.evaluate(() =>
        localStorage.getItem("atlas-learning-v1"),
      );
      await page.getByRole("button", { name: "Zoomer", exact: true }).click();
      await page.mouse.move(viewport.width / 2, viewport.height * 0.75);
      await page.mouse.wheel(130, 80);
      await page.locator(".world-map").dispatchEvent("wheel", {
        ctrlKey: true,
        deltaY: -90,
        clientX: viewport.width / 2,
        clientY: viewport.height * 0.75,
      });
      await checkHoverAndClick(
        page,
        ".focus-fullscreen",
        "Réduire le plein écran",
      );
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(false);
      await checkHoverAndClick(page, ".focus-fullscreen", "Plein écran");
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      await checkHoverAndClick(page, ".focus-exit", "Quitter le jeu");
      await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(false);
      expect(
        await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
      ).toBe(progress);
      await page
        .getByRole("button", { name: "Reprendre le jeu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Recentrer la carte", exact: true })
        .click();
    }
  });
}
