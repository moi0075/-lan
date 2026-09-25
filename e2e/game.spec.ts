import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import countries from "../src/data/countries.json" with { type: "json" };
test.beforeAll(() => mkdirSync("artifacts", { recursive: true }));
async function state(page: Page) {
  return await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas-learning-v1")!),
  );
}
async function active(page: Page) {
  const s = await state(page);
  return s.profiles.find((p: { id: string }) => p.id === s.activeId);
}
async function clickCountry(page: Page, id: string) {
  const c = countries.find((c) => c.id === id)!;
  const box = (await page.locator(".world-map").boundingBox())!;
  const scale = Math.min(box.width / 1000, box.height / 510);
  await page.mouse.click(
    box.x + (box.width - 1000 * scale) / 2 + c.point[0] * scale,
    box.y + (box.height - 510 * scale) / 2 + c.point[1] * scale,
  );
}
async function dashboard(page: Page) {
  const exit = page.getByRole("button", { name: "Quitter le mode jeu" });
  if (await exit.isVisible()) await exit.click();
}
test("immediate correction, guided answer, progress and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/play");
  await expect(page.getByRole("heading", { name: "Inde ?" })).toBeVisible();
  await clickCountry(page, "BRA");
  await expect(page.getByText("Un nouveau repère à retenir.")).toBeVisible();
  await expect(page.locator('[data-country="IND"]')).toHaveAttribute(
    "fill",
    "#d5dfdd",
  );
  await expect(page.locator('[data-country="BRA"]')).toHaveAttribute(
    "fill",
    "#d5dfdd",
  );
  expect((await active(page)).learning.memory.IND.errors).toBe(1);
  await page.reload();
  await expect(page.getByText("Un nouveau repère à retenir.")).toBeVisible();
  expect((await active(page)).learning.attempts).toBe(1);
  await page.getByRole("button", { name: "Pays suivant" }).click();
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
  await page.getByRole("button", { name: /Indice : 5 pays/ }).click();
  await expect(page.getByText("5 zones possibles sur la carte")).toBeVisible();
  await clickCountry(page, "CHN");
  await expect(page.getByText("Bien trouvé, avec un indice !")).toBeVisible();
  expect((await active(page)).learning.memory.CHN.streak).toBe(0);
  await dashboard(page);
  await page
    .getByRole("button", { name: "Ma progression", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/progress$/);
  await expect(
    page.getByRole("heading", { name: "Ma progression" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voir le détail · Placer les pays" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Le chemin parcouru." }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.screenshot({ path: "artifacts/progress.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("play continuously beyond 30 questions and unlock the next batch without leaving the game", async ({
  page,
}) => {
  await page.goto("/#/play");
  let count = 0;
  while (
    count < 35 ||
    ((await active(page)).learning.unlocked < 10 && count < 70)
  ) {
    const p = await active(page);
    await clickCountry(page, p.session.current.id);
    await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
    count++;
    await page.getByRole("button", { name: "Pays suivant" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
    await expect(page.locator(".session-finished")).toHaveCount(0);
    await expect(page.locator(".focus-question-count b")).toHaveText(
      String(count + 1).padStart(2, "0"),
    );
  }
  const p = await active(page);
  expect(p.learning.unlocked).toBeGreaterThanOrEqual(10);
  expect(
    countries.slice(0, 5).every((c) => p.learning.memory[c.id].acquired),
  ).toBe(true);
  await page.reload();
  expect((await active(page)).learning.unlocked).toBe(p.learning.unlocked);
  expect((await active(page)).session.answeredCount).toBe(count);
});
test("atlas covers 197 countries, supports search and small-country markers", async ({
  page,
}) => {
  await page.goto("/#/themes/geography/world");
  await page
    .getByRole("button", { name: "Explorer les 197 pays sur la carte" })
    .click();
  await expect(page.locator(".catalog-country")).toHaveCount(197);
  await page
    .getByRole("textbox", { name: "Rechercher dans l’atlas" })
    .fill("Vatican");
  await expect(page.locator(".catalog-country")).toHaveCount(1);
  await page.locator(".catalog-country").click();
  await expect(page.locator(".atlas-detail h2")).toContainText("Vatican");
  await expect(page.locator(".zoom-controls")).toContainText("600%");
  await page.getByRole("button", { name: "Recentrer la carte" }).click();
  await expect(page.locator(".zoom-controls")).toContainText("100%");
  await page.getByRole("button", { name: "Agrandir la carte" }).click();
  await expect(page.locator(".map-expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".map-expanded")).toHaveCount(0);
});
test("microstate placement is playable using its accessible marker", async ({
  page,
}) => {
  await page.goto("/#/play");
  const s = await state(page);
  s.profiles[0].learning.unlocked = 197;
  s.profiles[0].session.current = { id: "VAT", reason: "discovery" };
  await page.evaluate(
    (s) => localStorage.setItem("atlas-learning-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: /Vatican/ })).toBeVisible();
  await page.locator('[data-marker="VAT"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await expect(page.locator(".zoom-controls")).toContainText("100%");
});
test("profiles remain isolated; export and validated import preserve existing progress", async ({
  page,
}) => {
  await page.goto("/#/play");
  await clickCountry(page, "IND");
  await dashboard(page);
  await page.getByRole("button", { name: "Changer de profil" }).click();
  await page.getByLabel("Un nouvel explorateur ?").fill("Camille");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  expect((await active(page)).name).toBe("Camille");
  expect((await active(page)).learning.attempts).toBe(0);
  await dashboard(page);
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs("artifacts/test-backup.json");
  const prior = await state(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("alert")).toContainText("invalide");
  expect((await state(page)).profiles.length).toBe(2);
  await page
    .locator('input[type="file"]')
    .setInputFiles("artifacts/test-backup.json");
  await expect.poll(async () => (await state(page)).profiles.length).toBe(4);
  expect((await state(page)).profiles.slice(0, 2)).toEqual(prior.profiles);
});
test("mobile layout, controls, profile settings and navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto("/#/play");
  await expect(page.getByRole("heading", { name: "Inde ?" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Zoomer", exact: true }).tap();
  await expect(page.locator(".zoom-controls")).toContainText("165%");
  await page.getByRole("button", { name: "Recentrer la carte" }).tap();
  await clickCountry(page, "IND");
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await dashboard(page);
  await page.getByRole("button", { name: "Changer de profil" }).tap();
  await page.getByRole("button", { name: "Réglages et sauvegarde" }).tap();
  await expect(
    page.getByRole("button", { name: "Exporter", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).tap();
  await page.getByRole("button", { name: "Ma progression", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "Ma progression" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("focused play keeps questions above the map and native fullscreen preserves the session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/play");
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await expect(page.locator(".sidebar")).toBeHidden();
  const question = (await page.locator(".focus-question").boundingBox())!;
  const map = (await page.locator(".world-map").boundingBox())!;
  expect(map).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  expect(question.y).toBeGreaterThan(map.y);
  expect(question.y + question.height).toBeLessThan(map.height / 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Plein écran", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await clickCountry(page, "IND");
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await page.getByRole("button", { name: "Pays suivant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await dashboard(page);
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await expect(page.locator(".sidebar")).toBeVisible();
  expect((await active(page)).learning.attempts).toBe(1);
  await page
    .getByRole("button", { name: "Jouer en plein écran", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
  await page
    .getByRole("button", { name: "Réduire le plein écran", exact: true })
    .click();
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
});
test("focused layout remains playable on small portrait and landscape screens, including corrections", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/#/play");
    await expect(page.locator(".focus-question")).toBeVisible();
    if ((await active(page)).session.feedback)
      await page.getByRole("button", { name: "Pays suivant" }).click();
    await page
      .getByRole("button", { name: "Je ne sais pas encore", exact: true })
      .click();
    const overlay = (await page.locator(".focus-question").boundingBox())!;
    const map = (await page.locator(".world-map").boundingBox())!;
    expect(map).toEqual({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    expect(overlay.y).toBeGreaterThan(map.y);
    expect(overlay.y + overlay.height).toBeLessThan(viewport.height - 80);
    await expect(
      page.getByRole("button", { name: "Pays suivant" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/focused-${viewport.width}.png`,
      fullPage: true,
    });
  }
});
test("fullscreen denial keeps the full-window game available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Not supported"));
  });
  await page.goto("/#/play");
  await page.getByRole("button", { name: "Plein écran", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Le mode concentré reste actif",
  );
  await clickCountry(page, "IND");
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await dashboard(page);
  expect((await active(page)).learning.attempts).toBe(1);
});

test("neutral map and optional five-country hint survive reload without revealing acquired countries", async ({
  page,
}) => {
  await page.goto("/#/play");
  const fills = await page
    .locator(".country-path")
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("fill"))),
    ]);
  expect(fills).toEqual(["#d5dfdd"]);
  await expect(page.locator("[data-hint-country]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Indice : 5 pays", exact: true })
    .click();
  await expect(page.locator("[data-hint-country]")).toHaveCount(5);
  const hinted = await active(page);
  const choices = hinted.session.hintIds;
  expect(choices).toContain(hinted.session.current.id);
  expect(new Set(choices).size).toBe(5);
  await page.reload();
  await expect(page.locator("[data-hint-country]")).toHaveCount(5);
  expect((await active(page)).session.hintIds).toEqual(choices);
  await clickCountry(page, "IND");
  await expect(page.getByText("Bien trouvé, avec un indice !")).toBeVisible();
  expect((await active(page)).learning.memory.IND.streak).toBe(0);
  await expect(page.locator("[data-hint-country]")).toHaveCount(0);
  expect(
    await page
      .locator(".country-path")
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((node) => node.getAttribute("fill"))),
      ]),
  ).toEqual(["#d5dfdd"]);
  await page.getByRole("button", { name: "Pays suivant" }).click();
  await expect(page.locator("[data-hint-country]")).toHaveCount(0);
  expect((await active(page)).session.hinted).toBe(false);
});
test("answer and hint overlays never resize or reposition the map, including a manually zoomed view", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/#/play");
    if ((await active(page)).session.feedback)
      await page.getByRole("button", { name: "Pays suivant" }).click();
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
    const bounds = await page.locator(".world-map").boundingBox();
    const transform = await page
      .locator(".world-map > g")
      .getAttribute("transform");
    await page
      .getByRole("button", { name: "Indice : 5 pays", exact: true })
      .click();
    expect(await page.locator(".world-map").boundingBox()).toEqual(bounds);
    expect(await page.locator(".world-map > g").getAttribute("transform")).toBe(
      transform,
    );
    await page
      .getByRole("button", { name: "Je ne sais pas encore", exact: true })
      .click();
    expect(await page.locator(".world-map").boundingBox()).toEqual(bounds);
    expect(await page.locator(".world-map > g").getAttribute("transform")).toBe(
      transform,
    );
    await page.getByRole("button", { name: "Pays suivant" }).click();
    expect(await page.locator(".world-map").boundingBox()).toEqual(bounds);
    expect(await page.locator(".world-map > g").getAttribute("transform")).toBe(
      transform,
    );
  }
});
test("a saved completed expedition resumes at question 11 with all progress preserved", async ({
  page,
}) => {
  await page.goto("/#/play");
  await clickCountry(page, "IND");
  const s = await state(page);
  const p = s.profiles[0];
  p.session.answers = Array.from({ length: 10 }, () => p.session.feedback);
  p.session.finished = true;
  delete p.session.answeredCount;
  delete p.session.hintIds;
  await page.evaluate(
    (s) => localStorage.setItem("atlas-learning-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await expect(page.locator(".focus-question-count b")).toHaveText("11");
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  expect((await active(page)).learning).toEqual(p.learning);
  await page
    .getByRole("button", { name: "Je ne sais pas encore", exact: true })
    .click();
  await page.getByRole("button", { name: "Pays suivant" }).click();
  await expect(page.locator(".focus-question-count b")).toHaveText("12");
});
