import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("Add Trade previews risk, saves, and renders in My Trades", async ({ page }, testInfo) => {
  await page.goto("/trades/new");
  await expect(page.getByRole("heading", { name: "Add trade", level: 1 })).toBeVisible();

  const symbol = `PW${testInfo.project.name.replace(/[^a-z]/gi, "").slice(0, 8)}`.toUpperCase();
  await page.getByLabel("Instrument / symbol").fill(symbol);
  await page.getByLabel("Entry price").fill("100");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Lot / contract multiplier").fill("5");
  await page.getByLabel("Initial stop").fill("90");
  await page.getByLabel("Planned target").fill("130");

  const preview = page.getByRole("heading", { name: "Live risk preview" }).locator("xpath=ancestor::aside");
  await expect(preview).toContainText("₹100");
  await expect(preview).toContainText("3.00R");
  await expect(preview).toContainText("10");
  await expect(preview).toContainText("₹1,000");

  await page.screenshot({ path: testInfo.outputPath("add-trade.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "Save trade" }).click();
  await expect(page).toHaveURL(/\/trades\?created=1$/);
  await expect(page.getByRole("status")).toContainText("Trade saved");
  await expect(page.getByRole("cell", { name: new RegExp(symbol) })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("my-trades.png"), fullPage: true, animations: "disabled" });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "trade log has no page-level horizontal overflow").toBeLessThanOrEqual(0);
});
