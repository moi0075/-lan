import { test, expect } from "@playwright/test";
const host = "https://edogylmvtddskmikshyr.supabase.co";
for (const choice of ["save", "later", "existing"] as const) {
  test(`pseudo welcome: ${choice}`, async ({ page }) => {
    await page.setViewportSize({
      width: choice === "later" ? 390 : 1440,
      height: 900,
    });
    let alias = "Joueur a12b3c";
    let remote: any = null;
    let metadata: any = null;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const enc = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const user = {
      id: "22222222-2222-4222-8222-222222222222",
      email: "welcome@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at:
        choice === "existing"
          ? "2020-01-01T00:00:00Z"
          : new Date().toISOString(),
    };
    await page.route(`${host}/rest/v1/rpc/my_leaderboard_identity`, (route) => {
      const name = route.request().postDataJSON().p_name;
      if (name) alias = name;
      return route.fulfill({
        json: { player_id: "welcome-player", display_name: alias },
      });
    });
    await page.route(`${host}/rest/v1/learning_accounts**`, (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: remote });
      const body = route.request().postDataJSON();
      remote = { store: body.store, revision: body.revision };
      return route.fulfill({ json: [{ revision: body.revision }] });
    });
    await page.route(`${host}/auth/v1/signup**`, (route) =>
      route.fulfill({
        json: {
          access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: user.id, exp, role: "authenticated" })}.mock`,
          refresh_token: "test",
          token_type: "bearer",
          expires_at: exp,
          expires_in: 3600,
          user,
        },
      }),
    );
    await page.route(`${host}/auth/v1/user**`, (route) => {
      metadata = route.request().postDataJSON();
      return route.fulfill({ json: { ...user, user_metadata: metadata.data } });
    });
    await page.goto("/#/themes");
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Créer un compte", exact: true })
      .click();
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("password-test-123");
    await page
      .getByRole("button", { name: "Créer mon compte", exact: true })
      .click();
    const welcome = page.getByRole("dialog", {
      name: "Choisissez votre pseudo",
      exact: true,
    });
    if (choice === "existing") {
      await expect(
        page.getByRole("button", { name: "Mon compte", exact: true }),
      ).toBeVisible();
      await expect(welcome).toHaveCount(0);
      return;
    }
    await expect(welcome).toBeVisible();
    await expect(welcome.getByLabel("Pseudo", { exact: true })).toHaveValue(
      alias,
    );
    if (choice === "save") {
      await welcome
        .getByLabel("Pseudo", { exact: true })
        .fill("Nouveau pseudo");
      await welcome
        .getByRole("button", { name: "Enregistrer mon pseudo" })
        .click();
      await expect.poll(() => alias).toBe("Nouveau pseudo");
      await expect.poll(() => remote?.store.profiles[0].name).toBe(alias);
    } else
      await welcome
        .getByRole("button", { name: "Plus tard", exact: true })
        .click();
    await expect(welcome).toHaveCount(0);
    await expect.poll(() => metadata?.data.pseudo_welcome_completed).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Mon compte", exact: true }),
    ).toBeVisible();
    await expect(welcome).toHaveCount(0);
  });
}
