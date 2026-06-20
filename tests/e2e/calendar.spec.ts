import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("calendar renders recent, month, year, and keyboard day activity", async ({ page }, testInfo) => {
  await page.goto("/calendar?mode=month&month=2026-06&day=2026-06-10");

  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
  await expect(page.getByText(/no-trade day is never painted as zero/i)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Month" })).toHaveAttribute("data-state", "on");
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Day activity" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View SETUPINR trade detail" })).toBeVisible();
  await expect(page.getByText("List days with activity")).toBeVisible();
  await expect(page.getByLabel("Calendar intensity legend")).toContainText("No trade");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Day cells are real keyboard controls; no-trade selection is visibly distinct.
  const noTradeDay = page.getByRole("button", { name: /Thursday, 11 June 2026: no trades or reviews/i });
  await noTradeDay.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No activity.")).toBeVisible();

  const outcomeDay = page.getByRole("button", { name: /Wednesday, 10 June 2026: .*net P&L/i });
  await outcomeDay.click();
  await expect(page.getByRole("link", { name: "View SETUPINR trade detail" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-month.png"), fullPage: true, animations: "disabled" });

  // Currency switching replaces every money cell and day card, never combines them.
  await page.getByRole("combobox", { name: "Currency scope" }).click();
  await page.getByRole("option", { name: "USD" }).click();
  await expect(page.getByRole("link", { name: "View SETUPUSD trade detail" })).toBeVisible();
  await expect(page.getByText(/Money cells are isolated to/)).toContainText("USD");
  await expect(page.getByText("SETUPINR")).toHaveCount(0);

  await page.getByRole("radio", { name: "Recent" }).click();
  await expect(page.getByRole("heading", { name: "Recent 42 days" })).toBeVisible();

  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("From", { exact: true }).fill("2026-06-09");
  await page.getByLabel("To", { exact: true }).fill("2026-06-12");
  await page.getByRole("button", { name: "Apply range" }).click();
  await expect(page).toHaveURL(/mode=custom/);
  await expect(page.getByRole("heading", { name: "Custom date range" })).toBeVisible();

  await page.getByRole("radio", { name: "Year" }).click();
  await expect(page.getByRole("heading", { name: "2026 intensity" })).toBeVisible();
  await expect(page.getByRole("region", { name: "June 2026 intensity" })).toBeVisible();

  // Every activity card deep-links to the source trade.
  await page.getByRole("link", { name: "View SETUPUSD trade detail" }).click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
});
