import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
const host = "https://edogylmvtddskmikshyr.supabase.co";
const userId = "11111111-1111-4111-8111-111111111111";
test.beforeEach(async ({ page }) => {
  let alias = "Joueur test";
  await page.route(`${host}/rest/v1/rpc/my_leaderboard_identity`, (route) => {
    const name = route.request().postDataJSON().p_name;
    if (name) alias = name;
    return route.fulfill({
      json: { player_id: "test-public-player", display_name: alias },
    });
  });
});

test("Google button reports disabled provider without leaving the game library", async ({
  page,
}) => {
  await page.route(`${host}/auth/v1/settings`, (route) =>
    route.fulfill({ json: { external: { google: false } } }),
  );
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/google-account.png" });
  await page.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "connexion Google n’est pas disponible",
  );
  await expect(page).toHaveURL(/#\/themes$/);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
});

test("Google uses the project callback flow and PKCE, keeping guest progress", async ({
  page,
}) => {
  await page.route(`${host}/auth/v1/settings`, (route) =>
    route.fulfill({ json: { external: { google: true } } }),
  );
  await page.route(`${host}/auth/v1/authorize**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Google authorization mock</h1>",
    }),
  );
  await page.goto("/#/themes");
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  let guest = await page.evaluate(() =>
    localStorage.getItem("atlas-learning-v1"),
  );
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("button", { name: "Continuer avec Google" }).click();
  await expect(page).toHaveURL(/auth\/v1\/authorize/);
  const url = new URL(page.url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(url.searchParams.get("redirect_to")).toMatch(
    /^http:\/\/127.0.0.1:\d+\/$/,
  );
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
  ).toBe(guest);
});

test("account cache and cloud are separate from guests, restores guest on logout", async ({
  page,
}) => {
  await page.goto("/#/themes");
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  let guest = await page.evaluate(() =>
    localStorage.getItem("atlas-learning-v1"),
  );
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
    store.profiles[0].learning.xp = 10;
    store.profiles[0].learning.attempts = 1;
    localStorage.setItem("atlas-learning-v1", JSON.stringify(store));
  });
  guest = await page.evaluate(() => localStorage.getItem("atlas-learning-v1"));
  let remote: { store: unknown; revision: number } | null = null;
  await page.route(`${host}/rest/v1/learning_accounts**`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: remote });
      return;
    }
    const body = route.request().postDataJSON();
    remote = { store: body.store, revision: body.revision };
    await route.fulfill({ json: [{ revision: body.revision }] });
  });
  await page.route(`${host}/auth/v1/logout**`, (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.evaluate(
    ({ userId }) => {
      const encode = (v: unknown) =>
        btoa(JSON.stringify(v))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp, role: "authenticated" })}.mock-signature`;
      localStorage.setItem(
        "sb-edogylmvtddskmikshyr-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_at: exp,
          expires_in: 3600,
          user: {
            id: userId,
            email: "test@example.test",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: { provider: "google" },
            user_metadata: { full_name: "Test account" },
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { userId },
  );
  await page.reload();
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await expect(page.getByText("Test account", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("test@example.test", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Pseudo", { exact: true })).toHaveValue(
    "Joueur test",
  );
  await expect(
    page.getByRole("button", { name: "Récupérer mon meilleur parcours" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Parcours sauvegardé sur votre compte", { exact: true }),
  ).toBeVisible();
  const count = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem(`elan-account-${id}`)!).profiles.length,
    userId,
  );
  expect(count).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
  ).toBe(guest);
  expect(remote).not.toBeNull();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("atlas-learning-v1")),
  ).toBe(guest);
});

function mockSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp, role: "authenticated" })}.mock-signature`,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_at: exp,
    expires_in: 3600,
    user: {
      id: userId,
      email: "test@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}
async function mockCloud(page: import("@playwright/test").Page) {
  await page.route(`${host}/rest/v1/learning_accounts**`, (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? null
          : [{ revision: route.request().postDataJSON().revision }],
    }),
  );
  await page.route(`${host}/auth/v1/logout**`, (route) =>
    route.fulfill({ status: 204 }),
  );
}

test("email password signs in and signs out without profile or backup tools", async ({
  page,
}) => {
  await mockCloud(page);
  let credentials: unknown;
  await page.route(`${host}/auth/v1/token**`, (route) => {
    credentials = route.request().postDataJSON();
    expect(new URL(route.request().url()).searchParams.get("grant_type")).toBe(
      "password",
    );
    return route.fulfill({ json: mockSession() });
  });
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse e-mail").fill("test@example.test");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("test-password-123");
  await dialog
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  expect(credentials).toMatchObject({
    email: "test@example.test",
    password: "test-password-123",
  });
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await expect(
    page.getByText("test@example.test", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Pseudo", { exact: true })).toHaveValue(
    "Joueur test",
  );
  await expect(
    page.getByRole("button", { name: /Exporter|Importer|Gérer les profils/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
});

test("email sign-in handles invalid credentials without saving passwords", async ({
  page,
}) => {
  await page.route(`${host}/auth/v1/token**`, (route) =>
    route.fulfill({
      status: 400,
      json: {
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      },
    }),
  );
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse e-mail").fill("test@example.test");
  await dialog.getByLabel("Mot de passe", { exact: true }).fill("bad-password");
  await dialog
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "Adresse e-mail ou mot de passe incorrect.",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "bad-password",
  );
});

test("email registration requests confirmation and recovery sends a reset link", async ({
  page,
}) => {
  let signup: unknown;
  let recovery: unknown;
  await page.route(`${host}/auth/v1/signup**`, (route) => {
    signup = route.request().postDataJSON();
    return route.fulfill({ json: mockSession().user });
  });
  await page.route(`${host}/auth/v1/recover**`, (route) => {
    recovery = route.request().postDataJSON();
    return route.fulfill({ json: {} });
  });
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await page.getByLabel("Adresse e-mail").fill("test@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("new-password-123");
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "confirmer votre compte",
  );
  expect(signup).toMatchObject({
    email: "test@example.test",
    password: "new-password-123",
  });
  await page.getByRole("button", { name: "Retour à la connexion" }).click();
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Si un compte correspond",
  );
  expect(recovery).toMatchObject({ email: "test@example.test" });
});

test("recovery callback opens a new password form and updates the authenticated account", async ({
  page,
}) => {
  await mockCloud(page);
  const session = mockSession();
  let newPassword: unknown;
  await page.route(`${host}/auth/v1/token**`, (route) =>
    route.fulfill({ json: session }),
  );
  await page.route(`${host}/auth/v1/user**`, (route) => {
    if (route.request().method() === "PUT")
      newPassword = route.request().postDataJSON();
    return route.fulfill({ json: session.user });
  });
  await page.goto("/#/themes");
  await page.evaluate(() =>
    localStorage.setItem(
      "sb-edogylmvtddskmikshyr-auth-token-code-verifier",
      JSON.stringify("test-verifier/recovery"),
    ),
  );
  await page.goto("/?code=test-recovery-code#/themes");
  await expect(
    page.getByRole("dialog", { name: "Nouveau mot de passe" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Nouveau mot de passe" }),
  ).toBeVisible();
  await page.locator("#account-new-password").fill("changed-password-123");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Votre mot de passe a été mis à jour." }),
  ).toBeVisible();
  expect(newPassword).toMatchObject({ password: "changed-password-123" });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "changed-password-123",
  );
});

test("changing account forms clears stale errors and uses the correct heading", async ({
  page,
}) => {
  await page.route(`${host}/auth/v1/token**`, (route) =>
    route.fulfill({
      status: 400,
      json: { error_code: "invalid_credentials", msg: "Invalid credentials" },
    }),
  );
  await page.goto("/#/themes");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse e-mail").fill("test@example.test");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("wrong-password");
  await dialog
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Créer un compte", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Retour à la connexion" }).click();
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await expect(
    page.getByRole("dialog", { name: "Mot de passe oublié", exact: true }),
  ).toBeVisible();
});

async function seedSession(page: import("@playwright/test").Page) {
  const session = mockSession();
  await page.goto("/#/themes");
  await page.evaluate(
    (session) =>
      localStorage.setItem(
        "sb-edogylmvtddskmikshyr-auth-token",
        JSON.stringify(session),
      ),
    session,
  );
}

test("account loading errors allow retry instead of trapping the user", async ({
  page,
}) => {
  await mockCloud(page);
  await seedSession(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (
        key.startsWith("elan-account-") &&
        !sessionStorage.getItem("allow-account-cache")
      )
        throw Error("Storage unavailable");
      return original.call(this, key);
    };
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Réessayer le chargement" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Se déconnecter" }),
  ).toBeVisible();
  await page.evaluate(() =>
    sessionStorage.setItem("allow-account-cache", "true"),
  );
  await page.getByRole("button", { name: "Réessayer le chargement" }).click();
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
});

test("a failed offline retry keeps the current journey visible and can be retried", async ({
  page,
}) => {
  let offline = true;
  await page.route(`${host}/rest/v1/learning_accounts**`, (route) => {
    if (offline)
      return route.fulfill({ status: 503, json: { message: "offline" } });
    return route.fulfill({
      json:
        route.request().method() === "GET"
          ? null
          : [{ revision: route.request().postDataJSON().revision }],
    });
  });
  await seedSession(page);
  await page.reload();
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Réessayer la sauvegarde" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("elan-account-"))
        throw Error("Cache temporarily unavailable");
      return original.call(this, key);
    };
    (window as typeof window & { restoreStorage?: () => void }).restoreStorage =
      () => {
        Storage.prototype.getItem = original;
      };
  });
  await page.getByRole("button", { name: "Réessayer la sauvegarde" }).click();
  await expect(
    page.getByRole("dialog", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Impossible de charger le parcours",
  );
  await page.evaluate(() =>
    (
      window as typeof window & { restoreStorage?: () => void }
    ).restoreStorage?.(),
  );
  offline = false;
  await page.getByRole("button", { name: "Réessayer la sauvegarde" }).click();
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await expect(
    page.getByText("Parcours sauvegardé sur votre compte", { exact: true }),
  ).toBeVisible();
});

async function playedGuest(page: import("@playwright/test").Page) {
  await page.goto("/#/play/world-place");
  await page.locator('[data-country="IND"]').click();
  await expect(
    page.getByRole("button", { name: "Pays suivant", exact: true }),
  ).toBeVisible();
  await page.goto("/#/play/world-name");
  const input = page.getByRole("textbox", {
    name: "Nommez le pays surligné en violet.",
  });
  await input.fill("inde");
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "Pays suivant", exact: true }),
  ).toBeVisible();
  await page.goto("/#/themes");
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas-learning-v1")!),
  );
}
async function startSignup(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await page.getByLabel("Adresse e-mail").fill("test@example.test");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("new-password-123");
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
}
async function cachedAccount(page: import("@playwright/test").Page) {
  return page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`elan-account-${id}`)!),
    userId,
  );
}
async function restoreSession(
  page: import("@playwright/test").Page,
  session = mockSession(),
) {
  await page.evaluate(
    (session) =>
      localStorage.setItem(
        "sb-edogylmvtddskmikshyr-auth-token",
        JSON.stringify(session),
      ),
    session,
  );
  await page.reload();
}
for (const accept of [true, false]) {
  test(`new email account asks once and ${accept ? "keeps both games" : "respects declining guest progress"}`, async ({
    page,
  }) => {
    let remote: { store: any; revision: number } | null = null;
    await page.route(`${host}/rest/v1/learning_accounts**`, (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: remote });
      const body = route.request().postDataJSON();
      remote = { store: body.store, revision: body.revision };
      return route.fulfill({ json: [{ revision: body.revision }] });
    });
    await page.route(`${host}/auth/v1/signup**`, (route) =>
      route.fulfill({ json: mockSession() }),
    );
    const guest = await playedGuest(page);
    await startSignup(page);
    const offer = page.getByRole("dialog", {
      name: "Garder votre progression ?",
    });
    await expect(offer).toBeVisible();
    expect(remote).toBeNull();
    await page.reload();
    await expect(offer).toBeVisible();
    await offer
      .getByRole("button", {
        name: accept
          ? "Oui, garder ma progression"
          : "Commencer un nouveau parcours",
        exact: true,
      })
      .click();
    await expect(offer).toHaveCount(0);
    await expect
      .poll(
        async () => (await cachedAccount(page)).profiles[0].learning.attempts,
      )
      .toBe(accept ? 1 : 0);
    if (accept) {
      expect((await cachedAccount(page)).profiles[0].naming.learning).toEqual(
        guest.profiles[0].naming.learning,
      );
      expect((await cachedAccount(page)).profiles[0].session).toEqual(
        guest.profiles[0].session,
      );
      await expect
        .poll(() => remote?.store.profiles[0].learning.attempts)
        .toBe(1);
      expect(remote!.store.profiles).toHaveLength(1);
    }
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("atlas-learning-v1")!),
      ),
    ).toEqual(guest);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Mon compte", exact: true }),
    ).toBeVisible();
    await expect(offer).toHaveCount(0);
  });
}
test("signup offer survives email confirmation on the same browser", async ({
  page,
}) => {
  await mockCloud(page);
  await page.route(`${host}/auth/v1/signup**`, (route) =>
    route.fulfill({ json: mockSession().user }),
  );
  await playedGuest(page);
  await startSignup(page);
  await expect(page.getByRole("status")).toContainText(
    "confirmer votre compte",
  );
  await page.reload();
  await restoreSession(page);
  await expect(
    page.getByRole("dialog", { name: "Garder votre progression ?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Oui, garder ma progression", exact: true })
    .click();
  await expect
    .poll(async () => (await cachedAccount(page)).profiles[0].learning.attempts)
    .toBe(1);
});
test("normal email login never offers guest progress, even with an empty account", async ({
  page,
}) => {
  await mockCloud(page);
  await page.route(`${host}/auth/v1/token**`, (route) =>
    route.fulfill({ json: mockSession() }),
  );
  await playedGuest(page);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse e-mail").fill("test@example.test");
  await dialog
    .getByLabel("Mot de passe", { exact: true })
    .fill("new-password-123");
  await dialog
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Garder votre progression ?" }),
  ).toHaveCount(0);
  expect((await cachedAccount(page)).profiles[0].learning.attempts).toBe(0);
});
test("signup never replaces an existing cloud journey", async ({ page }) => {
  const guest = await playedGuest(page);
  const remote = structuredClone(guest);
  remote.profiles[0].name = "Compte déjà sauvegardé";
  let writes = 0;
  await page.route(`${host}/rest/v1/learning_accounts**`, (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { store: remote, revision: 3 } });
    writes++;
    return route.fulfill({ json: [{ revision: 4 }] });
  });
  await page.route(`${host}/auth/v1/signup**`, (route) =>
    route.fulfill({ json: mockSession() }),
  );
  await startSignup(page);
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Garder votre progression ?" }),
  ).toHaveCount(0);
  expect((await cachedAccount(page)).profiles[0].name).toBe(
    "Compte déjà sauvegardé",
  );
  expect(writes).toBe(0);
});
for (const existing of [false, true]) {
  test(`Google signup ${existing ? "does not import to an existing account" : "offers progress for a newly created account"}`, async ({
    page,
  }) => {
    await mockCloud(page);
    await page.route(`${host}/auth/v1/settings`, (route) =>
      route.fulfill({ json: { external: { google: true } } }),
    );
    await page.route(`${host}/auth/v1/authorize**`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>Google mock</h1>" }),
    );
    await playedGuest(page);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();

    await page
      .getByRole("button", { name: "Continuer avec Google", exact: true })
      .click();
    await expect(page).toHaveURL(/auth\/v1\/authorize/);
    await page.goto("/#/themes");
    const session = mockSession();
    session.user.app_metadata.provider = "google";
    if (existing) session.user.created_at = "2020-01-01T00:00:00Z";
    await restoreSession(page, session);
    const offer = page.getByRole("dialog", {
      name: "Garder votre progression ?",
    });
    if (existing) {
      await expect(
        page.getByRole("button", { name: "Mon compte", exact: true }),
      ).toBeVisible();
      await expect(offer).toHaveCount(0);
    } else {
      await expect(offer).toBeVisible();
    }
  });
}

test("signup without guest progress does not ask to transfer", async ({
  page,
}) => {
  await mockCloud(page);
  await page.route(`${host}/auth/v1/signup**`, (route) =>
    route.fulfill({ json: mockSession() }),
  );
  await page.goto("/#/themes");
  await startSignup(page);
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Garder votre progression ?" }),
  ).toHaveCount(0);
});
test("mobile signup choice is accessible and imported progress survives an upload failure", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.setViewportSize({ width: 390, height: 844 });
  let offline = true;
  let saved: any = null;
  await page.route(`${host}/rest/v1/learning_accounts**`, (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved });
    if (offline)
      return route.fulfill({ status: 503, json: { message: "offline" } });
    const body = route.request().postDataJSON();
    saved = { store: body.store, revision: body.revision };
    return route.fulfill({ json: [{ revision: body.revision }] });
  });
  await page.route(`${host}/auth/v1/signup**`, (route) =>
    route.fulfill({ json: mockSession() }),
  );
  await playedGuest(page);
  await startSignup(page);
  const offer = page.getByRole("dialog", {
    name: "Garder votre progression ?",
  });
  await expect(offer).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/signup-transfer-mobile.png" });
  await page
    .getByRole("button", { name: "Oui, garder ma progression", exact: true })
    .click();
  await expect(offer).toHaveCount(0);
  expect((await cachedAccount(page)).profiles[0].learning.attempts).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mon compte", exact: true }),
  ).toBeVisible();
  await expect(offer).toHaveCount(0);
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await expect(page.locator(".account-sync")).toContainText(
    "Vos progrès restent sur cet appareil",
  );
  offline = false;
  await page
    .getByRole("button", { name: "Réessayer la sauvegarde", exact: true })
    .click();
  await expect.poll(() => saved?.store.profiles[0].learning.attempts).toBe(1);
  expect(saved.store.profiles[0].naming.learning.attempts).toBe(1);
});
