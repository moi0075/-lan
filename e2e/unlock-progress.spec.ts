import { test, expect } from "@playwright/test";
for (const mode of ["place", "name"]) {
  test(`unlock border advances and regresses without moving the ${mode} question`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: mode === "name" ? 390 : 1440,
      height: 900,
    });
    await page.goto(`/#/play/world-${mode}`);
    const bar = page.getByRole("progressbar", {
      name: "Progression vers les 5 prochains pays",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
    await page.evaluate((mode) => {
      const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      const p = store.profiles[0];
      const track = mode === "name" ? p.naming : p;
      const id = track.session.current.id;
      track.learning.memory[id] = {
        attempts: 2,
        correct: 2,
        errors: 0,
        streak: 2,
        acquired: false,
        lastSeen: 0,
        due: 0,
      };
      track.learning.attempts = 2;
      track.learning.correct = 2;
      localStorage.setItem("atlas-learning-v1", JSON.stringify(store));
    }, mode);
    await page.reload();
    await expect(bar).toHaveAttribute("aria-valuenow", "13");
    const before = await page.locator(".focus-question").boundingBox();
    await page
      .getByRole("button", { name: "Je ne sais pas encore", exact: true })
      .click();
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
    const after = await page.locator(".focus-question").boundingBox();
    expect(after?.y).toBe(before?.y);
    await page
      .getByRole("button", { name: "Pays suivant", exact: true })
      .click();
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
  });
}
