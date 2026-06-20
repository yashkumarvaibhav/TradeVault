import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("review center renders behavioral evidence and opens the review queue", async ({ page }, testInfo) => {
  await page.goto("/review");

  await expect(page.getByRole("heading", { name: "Review Center", level: 1 })).toBeVisible();
  await expect(page.getByText(/Evidence stays currency-separated/i)).toBeVisible();
  await expect(page.getByText("Discipline score")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rule compliance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compliance impact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journaling impact" })).toBeVisible();
  await expect(page.getByRole("img", { name: /42-day review outcome heatmap/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trades waiting for review" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("tab", { name: "Mistake" }).click();
  await expect(page.getByText(/No tagged losing trades|tagged loss is counted/i)).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("review-center.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText(/Money metrics are isolated to/)).toContainText("USD");

  const reviewLink = page.locator('a[href^="/trades/"][href*="mode=review"]:visible').first();
  await expect(reviewLink).toBeVisible();
  await reviewLink.click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}\?mode=review/);
  await expect(page.getByRole("heading", { name: "Review this trade" })).toBeVisible();

  await page.goto("/review");
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page).toHaveURL(/\/review\?period=30d/);
  await expect(page.getByText(/Latest 30 days vs prior 30 days/)).toBeVisible();
  await page.getByRole("link", { name: "Reset scope" }).click();
  await expect(page).toHaveURL(/\/review$/);
});
