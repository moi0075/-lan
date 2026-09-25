import { test, expect, type Page } from "@playwright/test";

async function mapView(page: Page) {
  return page.locator(".map-content").evaluate((node) => {
    const matrix = (node as SVGGElement).transform.baseVal.consolidate()!
      .matrix;
    return { x: matrix.e, y: matrix.f, k: matrix.a };
  });
}
async function attempts(page: Page) {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
    return store.profiles.find(
      (profile: { id: string }) => profile.id === store.activeId,
    ).learning.attempts;
  });
}

test("trackpad pans both axes and pinches around the cursor without scrolling or answering", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  await page.mouse.move(1060, 550);
  await page.mouse.wheel(120, 80);
  await expect.poll(async () => (await mapView(page)).x).toBeLessThan(0);
  const panned = await mapView(page);
  expect(panned.y).toBeLessThan(0);
  expect(panned.k).toBe(1);

  const pointUnderCursor = () =>
    page.locator(".map-content").evaluate((node) => {
      const point = new DOMPoint(1060, 550).matrixTransform(
        (node as SVGGElement).getScreenCTM()!.inverse(),
      );
      return { x: point.x, y: point.y };
    });
  const before = await pointUnderCursor();
  const prevented = await page.locator(".world-map").evaluate((node) => {
    const event = new WheelEvent("wheel", {
      clientX: 1060,
      clientY: 550,
      deltaY: -70,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect.poll(async () => (await mapView(page)).k).toBeGreaterThan(2);
  const after = await pointUnderCursor();
  expect(after.x).toBeCloseTo(before.x, 3);
  expect(after.y).toBeCloseTo(before.y, 3);
  expect(await attempts(page)).toBe(0);
  expect(
    await page.evaluate(() => ({
      x: scrollX,
      y: scrollY,
      scale: visualViewport!.scale,
    })),
  ).toEqual({ x: 0, y: 0, scale: 1 });

  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  expect(await mapView(page)).toEqual({ x: 0, y: 0, k: 1 });
  // A gesture on the question itself must never move the map underneath it.
  await page
    .locator(".focus-question")
    .dispatchEvent("wheel", { deltaY: 80, deltaX: 70 });
  expect(await mapView(page)).toEqual({ x: 0, y: 0, k: 1 });
});

test("native gesture events zoom once and release normal trackpad navigation", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  await page.locator(".world-map").evaluate((node) => {
    const gesture = (type: string, scale: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { scale, clientX: 1000, clientY: 500 });
      node.dispatchEvent(event);
    };
    gesture("gesturestart", 1);
    gesture("gesturechange", 2);
    node.dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -100,
        cancelable: true,
      }),
    );
    gesture("gestureend", 2);
  });
  await expect.poll(async () => (await mapView(page)).k).toBe(2);
  const before = await mapView(page);
  await page.mouse.move(1000, 500);
  await page.mouse.wheel(100, 50);
  await expect.poll(async () => (await mapView(page)).x).toBeLessThan(before.x);
  expect(await attempts(page)).toBe(0);
});

test("dragging a country never submits it, and a later click still works", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  const start = await page.locator('[data-country="IND"]').evaluate((node) => {
    const bounds = (node as SVGPathElement).getBBox();
    const point = new DOMPoint(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    ).matrixTransform((node as SVGPathElement).getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 150, start.y + 70, { steps: 8 });
  await page.mouse.up();
  expect(await attempts(page)).toBe(0);
  expect((await mapView(page)).x).toBeGreaterThan(0);
  await page.mouse.click(start.x + 150, start.y + 70);
  await expect.poll(() => attempts(page)).toBe(1);
});

test("two touch points can pan and pinch without selecting a country", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 120, y: 440, id: 1 },
      { x: 240, y: 440, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 80, y: 470, id: 1 },
      { x: 300, y: 470, id: 2 },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(async () => (await mapView(page)).k).toBeGreaterThan(1.5);
  expect(await attempts(page)).toBe(0);
  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  expect(await mapView(page)).toEqual({ x: 0, y: 0, k: 1 });
  await client.detach();
});

test("hint and correction outlines include every polygon and sit above all neighbouring fills", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page.locator(".focus-question")).toBeVisible();
  await expect(page.locator("[data-outline-country]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Indice : 5 pays", exact: true })
    .click();
  await expect(page.locator("[data-hint-country]")).toHaveCount(5);
  const coverage = await page.locator(".world-map").evaluate((svg) => {
    const fills = [...svg.querySelectorAll(".country-path")];
    return [...svg.querySelectorAll("[data-hint-country]")].map((hint) => {
      const id = hint.getAttribute("data-hint-country");
      const outlines = [
        ...svg.querySelectorAll(`[data-outline-country="${id}"]`),
      ];
      const geometry = fills.filter(
        (fill) => fill.getAttribute("data-country") === id,
      );
      return {
        complete:
          JSON.stringify(
            outlines.map((outline) => outline.getAttribute("d")),
          ) === JSON.stringify(geometry.map((fill) => fill.getAttribute("d"))),
        above: outlines.every((outline) =>
          fills.every(
            (fill) =>
              !!(
                fill.compareDocumentPosition(outline) &
                Node.DOCUMENT_POSITION_FOLLOWING
              ),
          ),
        ),
        nonInteractive: outlines.every(
          (outline) => getComputedStyle(outline).pointerEvents === "none",
        ),
        constantWidth: outlines.every(
          (outline) =>
            outline.getAttribute("vector-effect") === "non-scaling-stroke",
        ),
      };
    });
  });
  expect(coverage).toHaveLength(5);
  expect(
    coverage.every((country) => Object.values(country).every(Boolean)),
  ).toBe(true);
  await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  await page
    .getByRole("button", { name: "Je ne sais pas encore", exact: true })
    .click();
  await expect(page.locator("[data-outline-country]")).toHaveCount(1);
  await expect(page.locator("[data-outline-country]")).toHaveAttribute(
    "data-outline-country",
    "IND",
  );
  await page.getByRole("button", { name: "Pays suivant" }).click();
  await expect(page.locator("[data-outline-country]")).toHaveCount(0);
});
