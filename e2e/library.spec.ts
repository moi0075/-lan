import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import type { Store } from "../src/engine/storage";
import { emptyLearning, recordAttempt } from "../src/engine/learning";
import countries from "../src/data/countries.json" with { type: "json" };

test.beforeAll(() => mkdirSync("artifacts", { recursive: true }));

test("themes lead to separate games and preserve both sessions on return", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Élan — Le savoir en mouvement");
  await expect(
    page.getByRole("button", { name: "Élan, accueil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Apprendre, à votre rythme." }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Maîtrise de l’ensemble des jeux" }),
  ).toHaveAttribute("max", "394");
  await page.screenshot({
    path: "artifacts/library-themes.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explorer le thème" }).click();
  await expect(
    page.getByRole("heading", { name: "Géographie", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choisir un jeu" }).click();
  await expect(
    page.getByRole("heading", { name: "Le monde", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/library-games.png",
    fullPage: true,
  });
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Géographie", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await page.getByRole("button", { name: "Commencer · Placer" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await page.locator('[data-country="IND"]').click();
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page
    .getByRole("navigation", { name: "Fil d’Ariane" })
    .getByRole("button", { name: "Le monde" })
    .click();
  await expect(
    page.getByRole("button", { name: "Reprendre · Placer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Commencer · Nommer" }).click();
  await page.getByRole("textbox").fill("indea");
  await page.getByRole("textbox").press("Enter");
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page
    .getByRole("navigation", { name: "Fil d’Ariane" })
    .getByRole("button", { name: "Le monde" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Reprendre · Placer" }).click();
  await expect(page.getByText("Bien joué, c’est ici !")).toBeVisible();
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page
    .getByRole("navigation", { name: "Fil d’Ariane" })
    .getByRole("button", { name: "Le monde" })
    .click();
  await page.getByRole("button", { name: "Reprendre · Nommer" }).click();
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas-learning-v1")!),
  );
  expect(saved.profiles[0].learning.attempts).toBe(1);
  expect(saved.profiles[0].naming.learning.attempts).toBe(1);
  expect(errors).toEqual([]);
});

test("saved learning is reflected in global and per-game progress and optional stats", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => !!localStorage.getItem("atlas-learning-v1")),
    )
    .toBe(true);
  const store: Store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas-learning-v1")!),
  );
  const p = store.profiles[0];
  p.mode = "name";
  p.naming = { learning: emptyLearning(), session: null };
  for (let i = 0; i < 3; i++) {
    p.learning = recordAttempt(p.learning, countries, "IND", true);
    p.naming!.learning = recordAttempt(
      p.naming!.learning,
      countries,
      "IND",
      true,
    );
    p.naming!.learning = recordAttempt(
      p.naming!.learning,
      countries,
      "CHN",
      true,
    );
  }
  p.naming!.learning = recordAttempt(
    p.naming!.learning,
    countries,
    "USA",
    false,
    false,
    Date.now(),
    true,
  );
  await page.evaluate(
    (data) => localStorage.setItem("atlas-learning-v1", JSON.stringify(data)),
    store,
  );
  await page.goto("/#/themes/geography/world");
  await page.reload();
  const general = page.getByRole("region", { name: "Progression générale" });
  await expect(general.getByRole("progressbar")).toHaveAttribute("value", "3");
  await expect(general).toContainText("0,8 %");
  await general.getByText("Voir les statistiques générales").click();
  await expect(general.locator(".library-stats")).toContainText("90 %");
  await expect(general.locator(".library-stats")).toContainText(
    "Réponses données10",
  );
  const placement = page.getByRole("article", { name: "Placer les pays" });
  const naming = page.getByRole("article", { name: "Nommer les pays" });
  await expect(placement.getByRole("progressbar")).toHaveAttribute(
    "value",
    "1",
  );
  await expect(naming.getByRole("progressbar")).toHaveAttribute("value", "2");
  await naming.getByText("Statistiques du jeu").click();
  await expect(naming).toContainText("Erreurs proches1");
  const navigation = page.getByRole("navigation", {
    name: "Navigation principale",
  });
  await expect(
    navigation.getByRole("button", { name: "Pays du monde" }),
  ).toHaveCount(0);
  await navigation.getByRole("button", { name: "Ma progression" }).click();
  await expect(page).toHaveURL(/#\/progress$/);
  await expect(
    page.getByRole("heading", { name: "Ma progression" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: "Progression générale de tous les jeux",
    }),
  ).toHaveAttribute("value", "3");
  await expect(
    page.getByRole("region", { name: "Progression par jeu" }),
  ).toContainText("1 / 197 acquis · 3 réponses");
  await expect(
    page.getByRole("region", { name: "Progression par jeu" }),
  ).toContainText("2 / 197 acquis · 7 réponses");
  await page
    .getByRole("button", { name: "Voir le détail · Nommer les pays" })
    .click();
  await expect(page).toHaveURL(/#\/game-progress\/world-name$/);
  await expect(page.locator(".progress-mode")).toContainText("Nommer");
  await expect(page.locator(".near-miss-total")).toContainText(
    "1 réponses proches",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Ma progression" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/general-progress.png",
    fullPage: true,
  });
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Explorer les 197 pays sur la carte" }),
  ).toBeVisible();
  await naming.getByText("Statistiques du jeu").click();
  await naming.getByRole("button", { name: "Voir le suivi par pays" }).click();
  await expect(page).toHaveURL(/#\/game-progress\/world-name$/);
});

test("the library and game cards remain usable on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explorer le thème" }).click();
  await page.getByRole("button", { name: "Choisir un jeu" }).click();
  await expect(
    page.getByRole("heading", { name: "Placer les pays" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nommer les pays" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/library-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Commencer · Nommer" }).click();
  await expect(page.getByRole("textbox")).toBeVisible();
  await page.getByRole("button", { name: "Quitter le jeu" }).click();
  await page
    .getByRole("button", { name: "Ma progression", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ma progression" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/general-progress-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Thèmes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Apprendre, à votre rythme." }),
  ).toBeVisible();
});
