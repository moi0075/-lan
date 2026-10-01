import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { chromium } from "@playwright/test";

// Serve the compiled application with the exact headers used by Vercel.
const root = path.resolve("dist");
assert.ok(
  fs.existsSync(path.join(root, "index.html")),
  "Run npm run build first",
);
const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const headers = Object.fromEntries(
  config.headers[0].headers.map(({ key, value }) => [key, value]),
);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = path.resolve(
    root,
    `.${pathname === "/" ? "/index.html" : pathname}`,
  );
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404, headers).end();
    return;
  }
  res.writeHead(200, {
    ...headers,
    "Content-Type": mime[path.extname(file)] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.securityViolations = [];
        document.addEventListener("securitypolicyviolation", (event) =>
          window.securityViolations.push(event.violatedDirective),
        );
      });
      for (const route of [
        "themes",
        "progress",
        "atlas",
        "play/world-place",
        "play/world-name",
      ]) {
        await page.goto(`${base}/#/${route}`);
        await page
          .getByRole("button", {
            name: route.startsWith("play/") ? "Quitter le jeu" : "Se connecter",
            exact: true,
          })
          .waitFor();
        if (route === "play/world-place") {
          await page
            .getByRole("button", { name: "Indice : 5 pays", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Je ne sais pas encore", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Pays suivant", exact: true })
            .click();
        }
        assert.deepEqual(
          await page.evaluate(() => window.securityViolations),
          [],
          `${route}: legitimate content blocked by CSP`,
        );
      }
      await page.goto(`${base}/#/themes`);
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      for (const name of [
        "Créer un compte",
        "Retour à la connexion",
        "Mot de passe oublié ?",
        "Retour à la connexion",
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
      }
      await page.getByRole("button", { name: "Fermer", exact: true }).click();
      assert.deepEqual(
        await page.evaluate(() => window.securityViolations),
        [],
      );
      assert.deepEqual(
        errors,
        [],
        "A page crashed with the production security headers",
      );
      await page.evaluate(() => {
        const script = document.createElement("script");
        script.textContent = "window.injectedScriptRan = true";
        document.body.append(script);
      });
      assert.equal(
        await page.evaluate(() => window.injectedScriptRan),
        undefined,
        "CSP allowed an injected inline script",
      );
      await page.waitForFunction(() =>
        window.securityViolations.includes("script-src-elem"),
      );
      await page.evaluate(() => {
        const key = "atlas-learning-v1";
        const store = JSON.parse(localStorage.getItem(key));
        store.profiles.find((profile) => profile.id === store.activeId).name =
          "<svg/onload=window.pwned=1>";
        localStorage.setItem(key, JSON.stringify(store));
      });
      await page.reload();
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .waitFor();
      assert.equal(
        await page.locator("svg[onload]").count(),
        0,
        "A saved name was rendered as executable HTML",
      );
      assert.equal(await page.evaluate(() => window.pwned), undefined);
      assert.deepEqual(
        await page.evaluate(() => window.securityViolations),
        [],
      );
      console.log(
        `Production security: routes, forms, CSP and HTML injection passed at ${width}px`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
