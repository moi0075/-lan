import { expect, test, type Page } from "@playwright/test";

async function view(page: Page) {
  return page.locator(".map-content").evaluate((node) => {
    const matrix = (node as SVGGElement).transform.baseVal.consolidate()!
      .matrix;
    return { x: matrix.e, y: matrix.f, k: matrix.a };
  });
}
async function freezeTime(page: Page) {
  await page.clock.install({ time: new Date("2026-10-06T15:00:00Z") });
  await page.goto("/#/play/world-place");
  await expect(page.locator(".focus-question")).toBeVisible();
  await page.clock.pauseAt(
    new Date(await page.evaluate(() => Date.now() + 1000)),
  );
}
async function drag(page: Page, pauseBeforeRelease = 0) {
  await page.mouse.move(950, 500);
  await page.mouse.down();
  for (const x of [980, 1010, 1040, 1070]) {
    await page.clock.runFor(16);
    await page.mouse.move(x, 500);
  }
  if (pauseBeforeRelease) await page.clock.runFor(pauseBeforeRelease);
  await page.mouse.up();
  return view(page);
}
async function attempts(page: Page) {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
    return store.profiles.find(
      (profile: { id: string }) => profile.id === store.activeId,
    ).learning.attempts;
  });
}

test("a mouse fling slows smoothly, settles and never answers a country", async ({
  page,
}) => {
  await freezeTime(page);
  const released = await drag(page);
  await page.clock.runFor(100);
  const early = await view(page);
  await page.clock.runFor(100);
  const later = await view(page);
  expect(early.x).toBeGreaterThan(released.x + 5);
  expect(later.x).toBeGreaterThan(early.x);
  expect(later.x - early.x).toBeLessThan(early.x - released.x);
  expect(later.k).toBe(1);
  await page.clock.runFor(1000);
  const settled = await view(page);
  await page.clock.runFor(500);
  expect(await view(page)).toEqual(settled);
  expect(await attempts(page)).toBe(0);
});

test("a tap stops a fling without answering, and the following deliberate click still answers", async ({
  page,
}) => {
  await freezeTime(page);
  await drag(page);
  await page.clock.runFor(80);
  await page.mouse.click(1070, 500);
  const stopped = await view(page);
  await page.clock.runFor(1000);
  expect(await view(page)).toEqual(stopped);
  expect(await attempts(page)).toBe(0);
  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  await page.locator('[data-country="IND"]').click();
  expect(await attempts(page)).toBe(1);
});

test("reset, zoom and leaving the game cancel the remaining motion", async ({
  page,
}) => {
  await freezeTime(page);
  await drag(page);
  await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  const zoomed = await view(page);
  expect(zoomed.k).toBeCloseTo(1.65);
  await page.clock.runFor(1000);
  expect(await view(page)).toEqual(zoomed);
  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  expect(await view(page)).toEqual({ x: 0, y: 0, k: 1 });
  await drag(page);
  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  await page.clock.runFor(1000);
  expect(await view(page)).toEqual({ x: 0, y: 0, k: 1 });
  await drag(page);
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page.clock.runFor(1000);
  await expect(page.locator(".focus-question")).toHaveCount(0);
  expect(await attempts(page)).toBe(0);
});

test("holding still before releasing and reduced-motion preferences avoid a fling", async ({
  page,
}) => {
  await freezeTime(page);
  const held = await drag(page, 120);
  await page.clock.runFor(1000);
  expect(await view(page)).toEqual(held);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await drag(page);
  await page.clock.runFor(1000);
  expect(await view(page)).toEqual(reduced);
  expect(await attempts(page)).toBe(0);
});

test("a single-finger phone fling glides and a pinch does not keep zooming or drifting", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  try {
    await freezeTime(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 120, y: 450, id: 1 }],
    });
    for (const x of [145, 170, 195, 220]) {
      await page.clock.runFor(16);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: 450, id: 1 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const released = await view(page);
    await page.clock.runFor(160);
    expect((await view(page)).x).toBeGreaterThan(released.x + 5);
    await page.getByRole("button", { name: "Recentrer la carte" }).click();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 120, y: 450, id: 1 },
        { x: 240, y: 450, id: 2 },
      ],
    });
    await page.clock.runFor(16);
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
    const pinched = await view(page);
    await page.clock.runFor(1000);
    expect(await view(page)).toEqual(pinched);
    expect(pinched.k).toBeGreaterThan(1.5);
    expect(await attempts(page)).toBe(0);
  } finally {
    await client.detach();
    await context.close();
  }
});
