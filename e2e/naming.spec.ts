import { test, expect, type Page } from "@playwright/test";

async function active(page: Page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
    return s.profiles.find((p: { id: string }) => p.id === s.activeId);
  });
}
async function nameMode(page: Page) {
  await page.goto("/#/play");
  await page.getByRole("button", { name: "Nommer", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nommez le pays surligné en violet." }),
  ).toBeVisible();
}
async function seedCountry(page: Page, id: string, unlocked: number) {
  await page.evaluate(
    ({ id, unlocked }) => {
      const s = JSON.parse(localStorage.getItem("atlas-learning-v1")!);
      const p = s.profiles.find((p: { id: string }) => p.id === s.activeId);
      p.naming.learning.unlocked = unlocked;
      p.naming.session.current = { id, reason: "discovery" };
      localStorage.setItem("atlas-learning-v1", JSON.stringify(s));
    },
    { id, unlocked },
  );
  await page.reload();
}

test("naming keeps the answer hidden, supports keyboard play and preserves independent learning", async ({
  page,
}) => {
  await nameMode(page);
  const original = (await active(page)).learning;
  const map = page.locator(".map-content");
  const transform = await map.getAttribute("transform");
  await expect(
    page.getByRole("heading", { name: "Quel est ce pays ?" }),
  ).toBeVisible();
  await expect(page.locator('[data-country="IND"]')).toHaveAttribute(
    "data-naming-target",
    "true",
  );
  await expect(page.locator(".naming-question .flag")).toHaveCount(0);
  await expect(page.locator(".map-pin")).toHaveCount(0);
  await page.locator('[data-country="IND"]').click();
  expect((await active(page)).naming.learning.attempts).toBe(0);
  await page.getByRole("textbox").fill("indea");
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  expect((await active(page)).naming.learning.memory.IND).toMatchObject({
    errors: 1,
    correct: 0,
    nearMisses: 1,
    acquired: false,
  });
  expect((await active(page)).learning).toEqual(original);
  expect(await map.getAttribute("transform")).toBe(transform);
  await expect(
    page.getByRole("button", { name: "Pays suivant", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pays suivant", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.getByRole("textbox").fill("chine");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText("Exactement, bien joué !")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pays suivant", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Placer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inde ?", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".naming-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Nommer", exact: true }).click();
  await expect(page.getByText("Exactement, bien joué !")).toBeVisible();
  await page.getByRole("button", { name: "Quitter le mode jeu" }).click();
  await page
    .getByRole("button", { name: "Ma progression", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Voir le détail · Nommer les pays" })
    .click();
  await expect(page.locator(".near-miss-total")).toContainText(
    "1 réponses proches",
  );
});

test("francece is a saved close error while another country's exact name remains a full error", async ({
  page,
}) => {
  await nameMode(page);
  await seedCountry(page, "FRA", 25);
  await page.getByRole("textbox").fill("francece");
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(
    page.getByText("Presque ! Le nom est à corriger."),
  ).toBeVisible();
  await expect(page.locator(".focus-feedback")).toContainText(
    "On écrit France",
  );
  expect((await active(page)).naming.session.feedback).toMatchObject({
    correct: false,
    nameMatch: "close",
    typedName: "francece",
  });
  await page.screenshot({ path: "artifacts/naming-close-desktop.png" });
  await page.getByRole("button", { name: "Pays suivant", exact: true }).click();
  await seedCountry(page, "NGA", 25);
  await page.getByRole("textbox").fill("Niger");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText("Un nouveau nom à retenir.")).toBeVisible();
  expect((await active(page)).naming.session.feedback.nameMatch).toBe(
    "incorrect",
  );
});

test("small countries remain visible and recognised through French aliases", async ({
  page,
}) => {
  await nameMode(page);
  await seedCountry(page, "VAT", 197);
  await expect(page.locator('[data-marker="VAT"]')).toHaveAttribute(
    "data-naming-target",
    "true",
  );
  await expect(page.locator(".zoom-controls")).toContainText("400%");
  await expect(
    page.getByRole("button", { name: "Valider", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox").fill("   ");
  await expect(
    page.getByRole("button", { name: "Valider", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox").fill("Vatican");
  await page.getByRole("textbox").press("Enter");
  await expect(page.getByText("Exactement, bien joué !")).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`naming stays playable in fullscreen at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await nameMode(page);
    await page
      .getByRole("button", { name: "Plein écran", exact: true })
      .click();
    await expect(page.locator(".focus-fullscreen")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const target = (await page.locator(".naming-pin").boundingBox())!;
    const overlay = (await page.locator(".focus-question").boundingBox())!;
    expect(target.y).toBeGreaterThan(overlay.y + overlay.height);
    await page.screenshot({ path: `artifacts/naming-${viewport.width}.png` });
    await page.getByRole("textbox").fill("fraance");
    const button = (await page.locator(".focus-fullscreen").boundingBox())!;
    await page.getByRole("textbox").press("Enter");
    await page.mouse.click(
      button.x + button.width / 2,
      button.y + button.height / 2,
    );
    await expect(page.locator(".focus-fullscreen")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Quitter le mode jeu" }).click();
    await expect(page.locator(".question-panel.naming-question")).toBeVisible();
    await page
      .getByRole("button", { name: "Pays suivant", exact: true })
      .click();
    await expect(page.getByRole("textbox")).toBeVisible();
    await page.screenshot({
      path: `artifacts/naming-dashboard-${viewport.width}.png`,
    });
  });
}
