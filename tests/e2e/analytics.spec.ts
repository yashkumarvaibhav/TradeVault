import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// Analytics lives behind auth; reuse the session created in auth.setup.
test.use({ storageState: AUTH_STATE });

test("analytics renders per-currency performance, diagnostics, and scope", async ({ page }, testInfo) => {
  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
  await expect(page.getByText(/INR and USD are never combined/i)).toBeVisible();
  await expect(page.getByText("Profit factor")).toBeVisible();
  await expect(page.getByText("Max drawdown")).toBeVisible();
  await expect(page.getByRole("img", { name: /INR cumulative net P&L equity curve/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Net P&L by weekday bar chart/i })).toBeVisible();

  // No horizontal page overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Distribution diagnostics tab → R-multiple histogram.
  await page.getByRole("tab", { name: "R-multiple" }).click();
  await expect(page.getByRole("img", { name: /R-multiple distribution histogram/i })).toBeVisible();

  // Equity → drawdown toggle.
  await page.getByRole("radio", { name: "Drawdown" }).click();
  await expect(page.getByRole("img", { name: /INR underwater drawdown curve/i })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("analytics.png"), fullPage: true, animations: "disabled" });

  // Currency isolation: switch to USD.
  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText(/Money metrics are isolated to/)).toContainText("USD");

  // Date scope navigates and resets.
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page).toHaveURL(/\/analytics\?period=30d/);
  await expect(page.getByRole("link", { name: "Reset scope" })).toBeVisible();
  await page.getByRole("link", { name: "Reset scope" }).click();
  await expect(page).toHaveURL(/\/analytics$/);
});
