import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import type { Store } from "../src/engine/storage";
import { emptyLearning } from "../src/engine/learning";
const host = "https://edogylmvtddskmikshyr.supabase.co";
const player = (id: string, rank: number, name: string, xp = 500) => ({
  player_id: id,
  rank,
  display_name: name,
  xp,
  attempts: 100,
  correct: 80,
  mastered: 12,
  item_count: 394,
  accuracy: 80,
});

test("leaderboard filters, search, sorting and pagination use server ranks", async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route(
    `${host}/rest/v1/rpc/learning_leaderboard`,
    async (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      const rows = body.p_search
        ? [player("search", 42, "Éléonore")]
        : body.p_offset
          ? [player("26", 26, "Dernier joueur")]
          : Array.from({ length: 25 }, (_, i) =>
              player(
                String(i),
                i + 1,
                i === 0 ? "Téo" : `Joueur ${i + 1}`,
                7065 - i * 10,
              ),
            );
      await route.fulfill({
        json: {
          rows,
          total: body.p_search ? 1 : 26,
          player_count: 26,
          mine: null,
        },
      });
    },
  );
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Classement", exact: true }).click();
  await expect(page).toHaveURL(/#\/leaderboard$/);
  await expect(
    page.getByRole("heading", { name: "Chaque progrès compte." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Fil d’Ariane" }),
  ).toHaveText("ThèmesClassement");
  await expect(
    page.getByRole("rowheader", { name: "Téo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Page suivante", exact: true })
    .click();
  await expect(
    page.getByRole("rowheader", { name: "Dernier joueur" }),
  ).toBeVisible();
  expect(requests.at(-1)?.p_offset).toBe(25);
  await page.getByLabel("Thème", { exact: true }).selectOption("geography");
  await expect(
    page.getByRole("rowheader", { name: "Téo", exact: true }),
  ).toBeVisible();
  expect(requests.at(-1)?.p_theme).toBe("geography");
  expect(requests.at(-1)?.p_offset).toBe(0);
  await page.getByLabel("Jeu", { exact: true }).selectOption("world-name");
  await expect.poll(() => requests.at(-1)?.p_game).toBe("world-name");
  await page
    .getByLabel("Classer par", { exact: true })
    .selectOption("mastered");
  await expect.poll(() => requests.at(-1)?.p_sort).toBe("mastered");
  await page.getByRole("searchbox").fill("eleonore");
  await expect(page.getByRole("rowheader", { name: "Éléonore" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
  expect(requests.at(-1)?.p_search).toBe("eleonore");
  await page.getByLabel("Thème", { exact: true }).selectOption("");
  await expect(page.getByLabel("Jeu", { exact: true })).toHaveValue("");
  await expect.poll(() => requests.at(-1)?.p_game).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chaque progrès compte." }),
  ).toBeVisible();
});

test("leaderboard handles errors, empty search, and fits mobile", async ({
  page,
}) => {
  let fails = true;
  await page.route(
    `${host}/rest/v1/rpc/learning_leaderboard`,
    async (route) => {
      if (fails)
        await route.fulfill({
          status: 503,
          json: { message: "Temporarily unavailable" },
        });
      else {
        const body = route.request().postDataJSON();
        await route.fulfill({
          json: {
            rows: body.p_search ? [] : [player("1", 1, "Téo", 7065)],
            total: body.p_search ? 0 : 1,
            player_count: 1,
            mine: null,
          },
        });
      }
    },
  );
  await page.goto("/#/leaderboard");
  await expect(page.getByRole("alert")).toContainText(
    "classement ne peut pas être chargé",
  );
  fails = false;
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: "Téo", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("inconnu");
  await expect(
    page.getByRole("heading", { name: "Aucun joueur trouvé." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await expect(
    page.getByRole("rowheader", { name: "Téo", exact: true }),
  ).toBeVisible();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/leaderboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Classement", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/leaderboard-mobile.png",
    fullPage: true,
  });
});

test("signed player edits only their public alias and sees their position", async ({
  page,
}) => {
  const userId = "11111111-1111-4111-8111-111111111111";
  let alias = "Joueur public";
  let failAliasWrite = false;
  const initialStore: Store = {
    version: 1,
    activeId: "22222222-2222-4222-8222-222222222222",
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Explorateur",
        createdAt: Date.now(),
        session: null,
        learning: { ...emptyLearning(), xp: 500, attempts: 100, correct: 80 },
      },
    ],
  };
  let remote: { store: typeof initialStore; revision: number } | null = {
    store: initialStore,
    revision: 1,
  };
  await page.route(`${host}/rest/v1/learning_accounts**`, async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: remote });
    else {
      const body = route.request().postDataJSON();
      remote = { store: body.store, revision: body.revision };
      await route.fulfill({ json: [{ revision: body.revision }] });
    }
  });
  await page.route(
    `${host}/rest/v1/rpc/my_leaderboard_identity`,
    async (route) => {
      const body = route.request().postDataJSON();
      if (body.p_name && failAliasWrite) {
        await route.fulfill({
          status: 503,
          json: { message: "Temporary failure" },
        });
        return;
      }
      if (body.p_name) alias = body.p_name;
      await route.fulfill({ json: { player_id: "mine", display_name: alias } });
    },
  );
  await page.route(
    `${host}/rest/v1/rpc/learning_leaderboard`,
    async (route) => {
      await route.fulfill({
        json: {
          rows: [player("mine", 4, alias)],
          mine: route.request().postDataJSON().p_self
            ? player("mine", 4, alias)
            : null,
          total: 1,
          player_count: 1,
        },
      });
    },
  );
  await page.addInitScript(
    ({ userId }) => {
      const enc = (v: unknown) =>
        btoa(JSON.stringify(v))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        "sb-edogylmvtddskmikshyr-auth-token",
        JSON.stringify({
          access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: userId, exp, role: "authenticated" })}.mock-signature`,
          refresh_token: "test",
          token_type: "bearer",
          expires_at: exp,
          expires_in: 3600,
          user: {
            id: userId,
            email: "test@example.test",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: { provider: "google" },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { userId },
  );
  await page.goto("/#/leaderboard");
  await expect(page.locator(".leaderboard-personal")).toContainText("4e");
  await expect(page.getByText("Vous", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mon pseudo public" }).click();
  await page
    .getByLabel("Votre pseudo public", { exact: true })
    .fill("email@example.test");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("sans adresse e-mail");
  await page
    .getByLabel("Votre pseudo public", { exact: true })
    .fill("Téo Curieux");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: "Téo Curieux Vous" }),
  ).toBeVisible();
  await expect(
    page.getByText("test@example.test", { exact: true }),
  ).toHaveCount(0);
  const before = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem(`elan-account-${id}`)!).profiles[0]
        .learning,
    userId,
  );
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  const editor = page.locator(".account-pseudo");
  await expect(editor.getByLabel("Pseudo", { exact: true })).toHaveValue(
    "Téo Curieux",
  );
  await editor.getByLabel("Pseudo", { exact: true }).fill("email@example.test");
  await editor.getByRole("button", { name: "Enregistrer mon pseudo" }).click();
  await expect(editor.getByRole("alert")).toContainText("sans adresse e-mail");
  expect(alias).toBe("Téo Curieux");
  failAliasWrite = true;
  await editor.getByLabel("Pseudo", { exact: true }).fill("Nouvel Élan");
  await editor.getByRole("button", { name: "Enregistrer mon pseudo" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "pas pu être enregistré",
  );
  expect(alias).toBe("Téo Curieux");
  failAliasWrite = false;
  await editor.getByRole("button", { name: "Enregistrer mon pseudo" }).click();
  await expect(
    editor.getByText("Votre pseudo a été mis à jour.", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => remote?.store.profiles[0].name).toBe("Nouvel Élan");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    editor.getByRole("button", { name: "Enregistrer mon pseudo" }),
  ).toBeVisible();
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".account-pseudo")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/account-pseudo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(
    page.getByRole("rowheader", { name: "Nouvel Élan Vous" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(editor.getByLabel("Pseudo", { exact: true })).toHaveValue(
    "Nouvel Élan",
  );
  await editor.getByLabel("Pseudo", { exact: true }).fill("Élan du matin");
  await editor.getByRole("button", { name: "Enregistrer mon pseudo" }).click();
  await expect.poll(() => remote?.store.profiles[0].name).toBe("Élan du matin");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("rowheader", { name: "Élan du matin Vous" }),
  ).toBeVisible();
  const restored = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`elan-account-${id}`)!).profiles[0],
    userId,
  );
  expect(restored.name).toBe("Élan du matin");
  expect(restored.learning).toEqual(before);
});

test("public ranking reads real account totals while private journeys remain inaccessible", async ({
  page,
  request,
}) => {
  const { readFileSync } = await import("node:fs");
  const env = readFileSync(".env.local", "utf8");
  const key = env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1].trim();
  test.skip(!key, "Supabase public configuration required");
  const headers = { apikey: key! };
  const response = await request.post(
    `${host}/rest/v1/rpc/learning_leaderboard`,
    { headers, data: {} },
  );
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.rows.length).toBeGreaterThan(0);
  expect(result.rows[0].attempts).toBeGreaterThan(0);
  expect(JSON.stringify(result)).not.toMatch(/email|user_id|history|profiles/);
  const privateResponse = await request.get(
    `${host}/rest/v1/learning_accounts?select=store`,
    { headers },
  );
  expect(privateResponse.status()).toBe(401);
  await page.goto("/#/leaderboard");
  await expect(
    page.getByRole("rowheader", {
      name: result.rows[0].display_name,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Jeu", { exact: true }).selectOption("world-name");
  await expect(
    page.getByRole("cell", { name: "18", exact: true }),
  ).toBeVisible();
});

test("leaderboard controls and table meet basic accessibility checks", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.route(`${host}/rest/v1/rpc/learning_leaderboard`, (route) =>
    route.fulfill({
      json: {
        rows: [player("1", 1, "Téo", 7065)],
        total: 1,
        player_count: 1,
        mine: null,
      },
    }),
  );
  await page.goto("/#/leaderboard");
  await expect(
    page.getByRole("rowheader", { name: "Téo", exact: true }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include(".leaderboard-page")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});
