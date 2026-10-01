import { test, expect, type Page } from "@playwright/test";

async function beginDrag(page: Page) {
  await page.mouse.move(1060, 550);
  await page.mouse.down();
  await page.mouse.move(1130, 610, { steps: 5 });
  await expect(page.locator(".world-map")).toHaveClass(/dragging/);
}

async function singleClick(page: Page, selector: string) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

for (const interruption of ["blur", "fullscreenchange"] as const) {
  test(`interrupted map drag releases the pointer on ${interruption} so exit responds immediately`, async ({
    page,
  }) => {
    await page.goto("/#/play");
    await expect(page.locator(".focus-question")).toBeVisible();
    await beginDrag(page);
    await page.evaluate((event) => {
      (event === "blur" ? window : document).dispatchEvent(new Event(event));
    }, interruption);
    await expect(page.locator(".world-map")).not.toHaveClass(/dragging/);
    expect(
      await page
        .locator(".world-map")
        .evaluate((node) => (node as SVGSVGElement).hasPointerCapture(1)),
    ).toBe(false);
    await page.mouse.up();
    await singleClick(page, ".focus-exit");
    await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
  });
}

test("a missed mouse release never restarts dragging when the cursor returns", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  // Simulate a press whose release happened outside the browser's event stream.
  await page.locator(".world-map").dispatchEvent("pointerdown", {
    pointerId: 91,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    clientX: 1000,
    clientY: 500,
  });
  const initial = await page.locator(".map-content").getAttribute("transform");
  await page.locator(".world-map").dispatchEvent("pointermove", {
    pointerId: 91,
    pointerType: "mouse",
    buttons: 0,
    clientX: 1100,
    clientY: 600,
  });
  await expect(page.locator(".world-map")).not.toHaveClass(/dragging/);
  expect(await page.locator(".map-content").getAttribute("transform")).toBe(
    initial,
  );
  expect(errors).toEqual([]);
  await singleClick(page, ".focus-exit");
  await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
});

test("reduce and quit respond to the first click after dragging and trackpad gestures in fullscreen", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  const progress = await page.evaluate(() =>
    localStorage.getItem("atlas-learning-v1"),
  );
  for (let cycle = 0; cycle < 3; cycle++) {
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await beginDrag(page);
    await page.mouse.up();
    await page.mouse.wheel(90, 60);
    await page.locator(".world-map").dispatchEvent("wheel", {
      ctrlKey: true,
      deltaY: -20,
      clientX: 1000,
      clientY: 550,
    });
    await singleClick(page, ".focus-fullscreen");
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await singleClick(page, ".focus-exit");
    await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
    expect(
      await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
    ).toBe(progress);
    if (cycle < 2) {
      await page
        .getByRole("button", { name: "Reprendre le jeu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Plein écran", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Réduire le plein écran", exact: true })
        .click();
    }
  }
});
