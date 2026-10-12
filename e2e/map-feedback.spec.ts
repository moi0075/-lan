import { expect, test } from "@playwright/test";

test("touch names expire after 2.5 seconds, restart on another tap and clear on next question", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.clock.install();
    await page.goto("/#/play/world-place");
    await page
      .getByRole("button", { name: "Je ne sais pas encore", exact: true })
      .click();
    const name = page.locator(".map-hover");
    await expect(name).toHaveText("Inde");
    await page.clock.runFor(2501);
    await expect(name).toHaveCount(0);
    const brazil = page.locator('[data-country="BRA"]');
    await brazil.tap();
    await expect(name).toHaveText("Brésil");
    await page.clock.runFor(2000);
    await expect(name).toBeVisible();
    await brazil.tap();
    await page.clock.runFor(2000);
    await expect(name).toHaveText("Brésil");
    await page.clock.runFor(501);
    await expect(name).toHaveCount(0);
    await brazil.tap();
    await page
      .getByRole("button", { name: "Pays suivant", exact: true })
      .click();
    await expect(name).toHaveCount(0);
    await page.clock.runFor(3000);
    await expect(name).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
        return store.profiles.find(
          (p: { id: string }) => p.id === store.activeId,
        ).learning.attempts;
      }),
    ).toBe(1);
  } finally {
    await context.close();
  }
});

test("touch hardware gets 4800% even when requesting a wide desktop viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 980, height: 700 },
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 }),
    );
    await page.goto("/#/play/world-place");
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    ).toBe(false);
    const zoom = page.getByRole("button", { name: "Zoomer", exact: true });
    for (let i = 0; i < 8; i++) await zoom.click();
    await expect(page.locator(".zoom-controls")).toContainText("4800%");
    await expect(zoom).toBeDisabled();
    await page
      .getByRole("button", { name: "Recentrer la carte", exact: true })
      .click();
    await expect(page.locator(".zoom-controls")).toContainText("100%");
  } finally {
    await context.close();
  }
});

for (const mode of ["place", "name"]) {
  for (const correct of [true, false]) {
    test(`${mode}: ${correct ? "correct" : "incorrect"} answers gradually color the border without blocking controls`, async ({
      page,
    }) => {
      await page.goto(`/#/play/world-${mode}`);
      const panel = page.locator(".focus-question");
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      if (mode === "place")
        await page
          .locator(`[data-country="${correct ? "IND" : "BRA"}"]`)
          .click();
      else {
        await page.getByRole("textbox").fill(correct ? "Inde" : "Brésil");
        await page
          .getByRole("button", { name: "Valider", exact: true })
          .click();
      }
      await expect(panel).toHaveClass(
        new RegExp(`answer-${correct ? "correct" : "incorrect"}`),
      );
      await expect(panel).toHaveCSS("animation-duration", "0.7s");
      await expect(panel).toHaveCSS(
        "border-top-color",
        correct ? "rgb(39, 134, 89)" : "rgb(191, 69, 69)",
      );
      if (mode === "place") expect(await panel.boundingBox()).toEqual(bounds);
      else {
        const after = (await panel.boundingBox())!;
        expect({ x: after.x, y: after.y, width: after.width }).toEqual({
          x: bounds!.x,
          y: bounds!.y,
          width: bounds!.width,
        });
      }
      const country = mode === "name" || correct ? "IND" : "BRA";
      const outline = page.locator(
        `.country-outlines [data-outline-country="${country}"]`,
      );
      await expect(outline.first()).toHaveCSS(
        "stroke",
        correct ? "rgb(39, 134, 89)" : "rgb(191, 69, 69)",
      );
      if (correct) {
        await expect(page.locator(".answer-confetti span")).toHaveCount(8);
        await expect(page.locator(".answer-confetti")).toHaveCSS(
          "pointer-events",
          "none",
        );
        await expect(page.locator(".answer-confetti span").last()).toHaveCSS(
          "opacity",
          "0",
        );
      } else await expect(page.locator(".answer-confetti")).toHaveCount(0);
      await page.screenshot({
        path: `artifacts/answer-${mode}-${correct ? "correct" : "incorrect"}.png`,
      });
      await page
        .getByRole("button", { name: "Pays suivant", exact: true })
        .click();
      await expect(panel).not.toHaveClass(/answer-correct|answer-incorrect/);
      await expect(page.locator(".answer-confetti")).toHaveCount(0);
    });
  }
}

test("reduced motion shows the answer color immediately and hides confetti", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/play/world-place");
  await page.locator('[data-country="IND"]').click();
  await expect(page.locator(".focus-question")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".focus-question")).toHaveCSS(
    "border-top-color",
    "rgb(39, 134, 89)",
  );
  await expect(page.locator(".answer-confetti")).toBeHidden();
});

test("the complete active outline sits above every other map contour", async ({
  page,
}) => {
  await page.goto("/#/play/world-place");
  await page
    .getByRole("button", { name: "Indice : 5 pays", exact: true })
    .click();
  await page.locator('[data-country="BRA"]').hover();
  const active = page.locator(
    '.interaction-outlines [data-outline-country="BRA"]',
  );
  await expect(active).toBeVisible();
  expect(
    await active.evaluate((outline) => {
      const svg = outline.closest("svg")!;
      const fills = [...svg.querySelectorAll('[data-country="BRA"]')];
      const activePaths = [
        ...svg.querySelectorAll(
          '.interaction-outlines [data-outline-country="BRA"]',
        ),
      ];
      return {
        complete:
          JSON.stringify(fills.map((p) => p.getAttribute("d"))) ===
          JSON.stringify(activePaths.map((p) => p.getAttribute("d"))),
        above: [
          ...svg.querySelectorAll(
            ".country-path, .country-marker, .country-outlines path, .hint-map-marker",
          ),
        ].every(
          (node) =>
            !!(
              node.compareDocumentPosition(outline) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
        nonInteractive: getComputedStyle(outline).pointerEvents === "none",
        constantWidth:
          outline.getAttribute("vector-effect") === "non-scaling-stroke",
      };
    }),
  ).toEqual({
    complete: true,
    above: true,
    nonInteractive: true,
    constantWidth: true,
  });
  await page.locator('[data-country="BRA"]').click();
  await page.mouse.move(1, 500);
  await page.locator('[data-country="CAN"]').click();
  await expect(
    page.locator('.interaction-outlines [data-outline-country="CAN"]'),
  ).toBeVisible();
  await page.mouse.move(1, 500);
  await expect(
    page.locator('.interaction-outlines [data-outline-country="CAN"]'),
  ).toBeVisible();
  await expect(page.locator('[data-country="CAN"]')).toHaveCSS(
    "fill",
    "rgb(170, 191, 192)",
  );
});
