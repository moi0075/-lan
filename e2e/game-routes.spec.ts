import { expect, test } from "@playwright/test";

test("game URLs keep independent sessions on reload and browser back, without in-game switching", async ({
  page,
}) => {
  await page.goto("/#/play/world-name");
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Variante du jeu" }),
  ).toHaveCount(0);
  await page.getByRole("textbox").fill("indea");
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await expect(page).toHaveURL(/#\/themes\/geography\/world$/);
  await expect(
    page.locator(".game-card, .world-map, .question-panel"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^(Placer|Nommer)$/ }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Fil d’Ariane" })
    .getByRole("button", { name: "Le monde" })
    .click();
  await page.getByRole("button", { name: "Commencer · Placer" }).click();
  await expect(page).toHaveURL(/#\/play\/world-place$/);
  await expect(page.getByRole("heading", { name: "Inde ?" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Variante du jeu" }),
  ).toHaveCount(0);
  await page.locator('[data-country="IND"]').click();
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/#\/play\/world-place$/);
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Le monde", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/play\/world-name$/);
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  // A saved last-played preference must not override a bookmarked game URL.
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
    store.profiles[0].mode = "place";
    localStorage.setItem("atlas-learning-v1", JSON.stringify(store));
  });
  await page.reload();
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  const profile = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atlas-learning-v1")!).profiles[0],
  );
  expect(profile.learning.attempts).toBe(1);
  expect(profile.naming.learning.attempts).toBe(1);
});

test("legacy play links resolve to a game URL and unknown games return to the library", async ({
  page,
}) => {
  await page.goto("/#/play");
  await expect(page).toHaveURL(/#\/play\/world-place$/);
  await page.goto("/#/play/unknown-game");
  await expect(
    page.getByRole("heading", { name: "Apprendre, à votre rythme." }),
  ).toBeVisible();
});
