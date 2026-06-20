import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// The overview lives behind auth; use the session created in auth.setup.
test.use({ storageState: AUTH_STATE });

test("overview preview is scoped, responsive, and visually reviewable", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Good afternoon, Yash/i })).toBeVisible();
  await expect(page.getByText("Sample data · not your journal")).toBeVisible();
  await expect(page.getByText(/INR and USD are never combined/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /INR cumulative net P&L equity curve/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Monthly net P&L bar chart/i })).toBeVisible();

  const overflowAudit = await page.evaluate(() => ({
    hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className.toString(),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter(({ right }) => right > document.documentElement.clientWidth + 1)
      .slice(0, 5),
  }));
  expect(overflowAudit.hasOverflow, JSON.stringify(overflowAudit.offenders, null, 2)).toBe(false);

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "TradeVault navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation" }).click();
  }

  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText("$486.75", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();

  await page.getByRole("radio", { name: "Drawdown" }).click();
  await expect(page.getByRole("img", { name: /USD underwater drawdown curve/i })).toBeVisible();
  await page.getByRole("radio", { name: "Equity" }).click();

  await page.getByRole("tab", { name: "Return distribution" }).click();
  await expect(page.getByRole("img", { name: /Return distribution histogram/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Long vs Short donut chart/i })).toBeVisible();

  await page.getByRole("tab", { name: "Outcome intensity" }).click();
  await expect(page.getByRole("img", { name: /Daily outcome intensity heatmap/i })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("overview-full.png"), fullPage: true, animations: "disabled" });
});
