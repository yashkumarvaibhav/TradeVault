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
  await page.getByLabel("Initial stop", { exact: true }).fill("90");
  await page.getByLabel("Planned target").fill("130");
  await page.getByLabel("Strategy").selectOption({ label: "Breakout" });
  await expect(page.getByRole("group", { name: "Setup checklist" }).getByRole("checkbox")).toHaveCount(5);
  await page.getByRole("group", { name: "Setup checklist" }).getByRole("checkbox").first().check();

  const preview = page.getByRole("heading", { name: "Live risk preview" }).locator("xpath=ancestor::aside");
  await expect(preview).toContainText("₹100");
  await expect(preview).toContainText("3.00R");
  await expect(preview).toContainText("10");
  await expect(preview).toContainText("₹1,000");

  await page.screenshot({ path: testInfo.outputPath("add-trade.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: "Save trade" }).click();
  await expect(page).toHaveURL(/\/trades\?created=1$/);
  await expect(page.getByRole("status")).toContainText("Trade saved");
  await expect(page.locator(`:visible:text-is("${symbol}")`).first()).toBeVisible();

  await page.getByPlaceholder(/Search symbol, style/i).fill(symbol);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${symbol}`));
  await expect(page.getByText("1 matching records")).toBeVisible();

  if ((page.viewportSize()?.width ?? 1280) >= 768) {
    const header = page.getByRole("columnheader", { name: "Symbol" });
    const firstRowLink = page.getByRole("link", { name: symbol });
    const [headerBox, rowBox] = await Promise.all([header.boundingBox(), firstRowLink.boundingBox()]);
    expect(headerBox && rowBox && headerBox.y + headerBox.height <= rowBox.y + 1, "header renders before and does not overlap the first row").toBeTruthy();
  }
  await page.screenshot({ path: testInfo.outputPath("my-trades.png"), fullPage: true, animations: "disabled" });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "trade log has no page-level horizontal overflow").toBeLessThanOrEqual(0);

  await page.getByText("Columns", { exact: true }).click();
  await page.getByLabel("Side").uncheck();
  await page.getByRole("button", { name: "Apply columns" }).click();
  await expect(page).toHaveURL(/columns=1/);
  await expect(page.getByRole("columnheader", { name: "Side" })).toHaveCount(0);

  const visibleSelection = page.locator('input[name="tradeId"]:visible').first();
  const tradeId = await visibleSelection.getAttribute("value");
  await visibleSelection.check();
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    const mobileDetails = visibleSelection.locator("xpath=following-sibling::details");
    await mobileDetails.locator("summary").click();
    await expect(mobileDetails.getByText("Asset / side")).toBeVisible();
  }
  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByRole("status")).toContainText("Marked 1 selected trade reviewed");

  await page.goto(`/trades/${tradeId}`);
  await expect(page.getByRole("heading", { name: symbol, level: 1 })).toBeVisible();
  // Close is enabled for open trades (P4 lifecycle).
  await expect(page.getByRole("link", { name: "Close" })).toBeVisible();
  await page.getByRole("link", { name: "Review" }).click();
  await page.getByLabel("Review note").fill("E2E review: waited for confirmation.");
  await page.getByRole("button", { name: "Save review" }).first().click();
  await expect(page.getByRole("status")).toContainText("Review saved");
  await expect(page.getByText("E2E review: waited for confirmation.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trade-detail.png"), fullPage: true, animations: "disabled" });

  // Close the open trade — oracle-correct realized P&L/R, currency-safe. (130-100)*2*5 = ₹300 = 3.00R.
  await page.getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(/mode=close/);
  await page.getByLabel("Exit price").fill("130");
  const closePreview = page.getByText("Close preview").locator("xpath=ancestor::aside");
  await expect(closePreview).toContainText("₹300");
  await expect(closePreview).toContainText("3.00R");
  await page.getByRole("button", { name: "Close trade" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}\\?closed=1`));
  await expect(page.getByRole("status")).toContainText("Trade closed");
  const result = page.getByRole("region", { name: "Trade result" });
  await expect(result).toContainText("₹300");
  await expect(result).toContainText("3.00R");
  await expect(page.getByRole("button", { name: "Closed" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("trade-closed.png"), fullPage: true, animations: "disabled" });

  // Edit the trade — metrics recompute through the same oracle. Exit 130→140 ⇒ ₹400 = 4.00R.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}/edit`));
  await expect(page.getByLabel("Quantity")).toHaveValue("2");
  await page.getByLabel("Exit price").fill("140");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}\\?updated=1`));
  await expect(page.getByRole("status")).toContainText("Trade updated");
  const editedResult = page.getByRole("region", { name: "Trade result" });
  await expect(editedResult).toContainText("₹400");
  await expect(editedResult).toContainText("4.00R");

  await page.goto("/trades/new");
  await page.getByLabel("Instrument / symbol").fill(symbol);
  await expect(page.getByRole("status")).toContainText(`Saved defaults applied for ${symbol}`);
  await expect(page.getByLabel("Quantity")).toHaveValue("2.000000");
  await expect(page.getByLabel("Lot / contract multiplier")).toHaveValue("5.000000");

  // Whole-row navigation (P4): clicking anywhere on a desktop row except the checkbox opens the detail.
  if ((page.viewportSize()?.width ?? 1280) >= 768) {
    await page.goto("/trades");
    const firstRow = page.locator("tbody tr").first();
    const rowTradeId = await firstRow.locator('input[name="tradeId"]').getAttribute("value");
    await firstRow.click({ position: { x: 280, y: 18 } });
    await expect(page).toHaveURL(new RegExp(`/trades/${rowTradeId}(\\?|$)`));
  }
});
