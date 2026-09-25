import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${process.env.ATLAS_PORT || "5173"}/#/play`);
  await page.locator(".focus-question").waitFor();
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  console.log("Desktop and mobile captures saved in artifacts/.");
} finally {
  await browser.close();
}
