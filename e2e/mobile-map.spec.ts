import { expect, test } from "@playwright/test";

test.use({
  isMobile: true,
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

test("mobile pinch and buttons reach 48x without answering, then reset", async ({
  page,
  context,
}) => {
  await page.goto("/#/play/world-place");
  const zoom = page.getByRole("button", { name: "Zoomer", exact: true });
  const controls = page.locator(".zoom-controls");
  await expect(zoom).toBeVisible();
  const client = await context.newCDPSession(page);
  try {
    for (let i = 0; i < 8; i++) {
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
      await expect(controls).toContainText(
        `${Math.round(Math.min(48, (220 / 120) ** (i + 1)) * 100)}%`,
      );
    }
    await expect(controls).toContainText("4800%");
    await expect(zoom).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Je ne sais pas encore", exact: true }),
    ).toBeVisible();
    const attempts = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      return store.profiles.find(
        (profile: { id: string }) => profile.id === store.activeId,
      ).learning.attempts;
    });
    expect(attempts).toBe(0);
    await page
      .getByRole("button", { name: "Recentrer la carte", exact: true })
      .click();
    await expect(controls).toContainText("100%");
    for (let i = 0; i < 8; i++) await zoom.click();
    await expect(controls).toContainText("4800%");
    await expect(zoom).toBeDisabled();
    await page.getByRole("button", { name: "Dézoomer", exact: true }).click();
    await expect(zoom).toBeEnabled();
  } finally {
    await client.detach();
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`country names stay 22 screen pixels on a phone at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/play/world-place");
    await page
      .getByRole("button", { name: "Je ne sais pas encore", exact: true })
      .click();
    const name = page.locator(".map-hover");
    await expect(name).toHaveText("Inde");
    await expect(name).toHaveCSS("font-size", "22px");
    const label = (await name.boundingBox())!;
    const question = (await page.locator(".focus-question").boundingBox())!;
    const controls = (await page.locator(".map-bottom").boundingBox())!;
    expect(label.y).toBeGreaterThanOrEqual(question.y + question.height);
    expect(label.y + label.height).toBeLessThanOrEqual(controls.y);
    expect(label.x).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.locator(".map-pin text")).toHaveCount(0);
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
    await expect(name).toHaveCSS("font-size", "22px");
    if (viewport.width > 700) {
      for (let i = 0; i < 7; i++)
        await page.getByRole("button", { name: "Zoomer", exact: true }).click();
      await expect(page.locator(".zoom-controls")).toContainText("4800%");
    }
    await page
      .getByRole("button", { name: "Recentrer la carte", exact: true })
      .click();
    await page.screenshot({
      path: `artifacts/mobile-map-${viewport.width}.png`,
    });
    // A long name must fit the viewport and stay clear of the question too.
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      const profile = store.profiles.find(
        (p: { id: string }) => p.id === store.activeId,
      );
      profile.learning.unlocked = 197;
      profile.session.current.id = "VCT";
      profile.session.feedback.targetId = "VCT";
      localStorage.setItem("atlas-learning-v1", JSON.stringify(store));
    });
    await page.reload();
    await expect(name).toHaveText("Saint-Vincent-et-les-Grenadines");
    const longLabel = (await name.boundingBox())!;
    const currentQuestion = (await page
      .locator(".focus-question")
      .boundingBox())!;
    const currentControls = (await page.locator(".map-bottom").boundingBox())!;
    expect(longLabel.height).toBeLessThanOrEqual(90);
    expect(longLabel.x).toBeGreaterThanOrEqual(0);
    expect(longLabel.x + longLabel.width).toBeLessThanOrEqual(viewport.width);
    expect(longLabel.y).toBeGreaterThanOrEqual(
      currentQuestion.y + currentQuestion.height,
    );
    expect(longLabel.y + longLabel.height).toBeLessThanOrEqual(
      currentControls.y,
    );
    await page.screenshot({
      path: `artifacts/mobile-map-long-${viewport.width}.png`,
    });
  });
}
