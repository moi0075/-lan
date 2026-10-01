import { expect, test } from "@playwright/test";

test("Space advances once after a map answer", async ({ page }) => {
  await page.goto("/#/play");
  const answeredCountry = page.locator('[data-country="IND"]').first();
  await answeredCountry.click();
  await expect(
    page.getByRole("button", { name: "Pays suivant" }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
  await expect(page.locator('[data-outline-country="IND"]')).toHaveCount(0);
  await expect
    .poll(() =>
      answeredCountry.evaluate((path) => ({
        fill: getComputedStyle(path).fill,
        stroke: getComputedStyle(path).stroke,
      })),
    )
    .toEqual({ fill: "rgb(213, 223, 221)", stroke: "rgb(246, 248, 248)" });
  expect(
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      return store.profiles[0].session.answeredCount;
    }),
  ).toBe(1);
});

test("Space types normally in a country name, then advances after feedback", async ({
  page,
}) => {
  await page.goto("/#/play/world-name");
  const input = page.getByRole("textbox", {
    name: "Nommez le pays surligné en violet.",
  });
  await input.fill("États");
  await input.press("Space");
  await expect(input).toHaveValue("États ");
  await expect(
    page.getByRole("heading", { name: "Quel est ce pays ?" }),
  ).toBeVisible();
  await input.fill("Inde");
  await input.press("Enter");
  const next = page.getByRole("button", { name: "Pays suivant" });
  await expect(next).toBeFocused();
  await page.keyboard.press("Space");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  expect(
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      return store.profiles[0].naming.session.answeredCount;
    }),
  ).toBe(1);
});

test("Space outside the game preserves the question and remains available on other controls", async ({
  page,
}) => {
  await page.goto("/#/play");
  await page.locator('[data-country="IND"]').click();
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Le monde", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".world-map")).toHaveCount(0);
  await page.getByRole("button", { name: "Reprendre · Placer" }).click();
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await page.locator(".world-map").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Chine ?" })).toBeVisible();
  await page.locator('[data-country="CHN"]').click();
  const fullscreen = page.getByRole("button", {
    name: "Plein écran",
    exact: true,
  });
  await fullscreen.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".focus-fullscreen")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Chine ?" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pays suivant" }),
  ).toBeVisible();
});
