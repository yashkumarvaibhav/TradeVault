import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("risk studio gates on the minimum sample and never mixes currency", async ({ page }, testInfo) => {
  await page.goto("/risk");

  await expect(page.getByRole("heading", { name: "Monte Carlo", level: 1 })).toBeVisible();
  // The throwaway e2e account has < 30 closed trades, so the honest min-sample
  // empty state must show (and name the requirement) rather than a misleading run.
  await expect(page.getByText(/Not enough closed (INR|USD) trades yet/)).toBeVisible();
  await expect(page.getByText(/at least\s+30\s+closed/i)).toBeVisible();

  // Currency stays isolated — switching the scope currency keeps the gate honest.
  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText(/Not enough closed USD trades yet/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("risk-empty.png"), fullPage: true, animations: "disabled" });
});
