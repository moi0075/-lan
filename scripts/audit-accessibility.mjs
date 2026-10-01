import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

fs.mkdirSync("artifacts", { recursive: true });
const base = `http://127.0.0.1:${process.env.ATLAS_PORT || "5173"}`;
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const reports = [];
const scenarios = [
  { name: "catalogue", route: "themes" },
  { name: "progression", route: "progress" },
  { name: "atlas", route: "atlas" },
  { name: "placement", route: "play/world-place" },
  { name: "nommage", route: "play/world-name" },
  { name: "connexion", route: "themes", account: true },
  {
    name: "inscription",
    route: "themes",
    account: true,
    action: "Créer un compte",
  },
  {
    name: "mot-de-passe-oublie",
    route: "themes",
    account: true,
    action: "Mot de passe oublié ?",
  },
  { name: "connexion-mobile", route: "themes", account: true, mobile: true },
];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: scenario.mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    });
    try {
      const page = await context.newPage();
      await page.goto(`${base}/#/${scenario.route}`);
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .or(page.getByRole("button", { name: "Quitter le jeu", exact: true }))
        .waitFor();
      if (scenario.account) {
        await page
          .getByRole("button", { name: "Se connecter", exact: true })
          .click();
        if (scenario.action)
          await page
            .getByRole("button", { name: scenario.action, exact: true })
            .click();
        await page.getByRole("dialog").waitFor();
      }
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      reports.push({ scenario: scenario.name, violations });
      console.log(`${scenario.name}: ${violations.length} violation(s)`);
    } finally {
      await context.close();
    }
  }
  fs.writeFileSync(
    "artifacts/accessibility.json",
    JSON.stringify(reports, null, 2),
  );
  const failures = reports.filter(({ violations }) => violations.length);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
