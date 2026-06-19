import { expect, test } from "@playwright/test";

test("overview preview is scoped, responsive, and visually reviewable", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Good afternoon, Yash/i })).toBeVisible();
  await expect(page.getByText("Sample data · not your journal")).toBeVisible();
  await expect(page.getByText(/INR and USD are never combined/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /INR cumulative net P&L equity curve/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "TradeVault navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation" }).click();
  }

  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByText("$486.75", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("overview-full.png"), fullPage: true, animations: "disabled" });
});
