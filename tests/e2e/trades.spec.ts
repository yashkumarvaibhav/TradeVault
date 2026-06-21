import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("Add Trade previews risk, saves, and renders in My Trades", async ({ page }, testInfo) => {
  await page.goto("/trades/new");
  await expect(page.getByRole("heading", { name: "Add trade", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Switch to International/USD Trades" }).click();
  await expect(page.getByLabel("Trade currency")).toHaveValue("USD");
  await expect(page.getByLabel("Currency pair")).toBeVisible();
  await expect(page.getByText(/automatic risk and price-based P&L assume a USD-quoted pair/i)).toBeVisible();
  await page.getByRole("button", { name: "Switch to Indian/INR Trades" }).click();
  await expect(page.getByLabel("Trade currency")).toHaveValue("INR");
  await page.getByText("Futures", { exact: true }).click();

  const symbol = `PW${testInfo.project.name.replace(/[^a-z]/gi, "").slice(0, 8)}`.toUpperCase();
  await page.getByLabel("Futures contract").fill(symbol);
  await page.getByLabel("Entry price").fill("100");
  await page.getByLabel("Number of lots / contracts").fill("2");
  await page.getByLabel("Lot / contract size").fill("5");
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
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByLabel("Review note").fill("E2E review: waited for confirmation.");
  await page.getByRole("button", { name: "Save review" }).first().click();
  await expect(page.getByRole("status")).toContainText("Review saved");
  await expect(page.getByText("E2E review: waited for confirmation.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trade-detail.png"), fullPage: true, animations: "disabled" });

  // Close the open trade — oracle-correct realized P&L/R, currency-safe. (130-100)*2*5 = ₹300 = 3.00R.
  await page.getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(/mode=close/);
  await page.getByLabel("Exit price").fill("130");
  await page.getByLabel("Maximum favorable price").fill("140");
  await page.getByLabel("Maximum adverse price").fill("95");
  const closePreview = page.getByText("Close preview").locator("xpath=ancestor::aside");
  await expect(closePreview).toContainText("₹300");
  await expect(closePreview).toContainText("3.00R");
  await expect(closePreview).toContainText("4.00R");
  await expect(closePreview).toContainText("0.50R");
  await expect(closePreview).toContainText("75%");
  await page.getByRole("button", { name: "Close trade" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}\\?closed=1`));
  await expect(page.getByRole("status")).toContainText("Trade closed");
  const result = page.getByRole("region", { name: "Trade result" });
  await expect(result).toContainText("₹300");
  await expect(result).toContainText("3.00R");
  const excursion = page.getByRole("region", { name: "Excursion & capture" });
  await expect(excursion).toContainText("4.00R");
  await expect(excursion).toContainText("0.50R");
  await expect(excursion).toContainText("75.0%");
  await expect(page.getByRole("button", { name: "Closed" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("trade-closed.png"), fullPage: true, animations: "disabled" });

  // Edit the trade — metrics recompute through the same oracle. Exit 130→140 ⇒ ₹400 = 4.00R.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}/edit`));
  await expect(page.getByLabel("Number of lots / contracts")).toHaveValue("2");
  await page.getByLabel("Exit price").fill("140");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/trades/${tradeId}\\?updated=1`));
  await expect(page.getByRole("status")).toContainText("Trade updated");
  const editedResult = page.getByRole("region", { name: "Trade result" });
  await expect(editedResult).toContainText("₹400");
  await expect(editedResult).toContainText("4.00R");
  await expect(page.getByRole("region", { name: "Excursion & capture" })).toContainText("100.0%");

  // Attachments: upload → serve (gated) → caption → delete on the detail page.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
  await page.getByLabel("File", { exact: true }).setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(page.getByLabel("Caption for shot.png")).toBeVisible();
  const imgSrc = await page.getByRole("img", { name: "shot.png" }).getAttribute("src");
  const served = await page.request.get(imgSrc ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toContain("image/png");
  await page.getByLabel("Caption for shot.png").fill("E2E entry screenshot");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Caption for shot.png")).toHaveValue("E2E entry screenshot");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No attachments yet.")).toBeVisible();

  await page.goto("/trades/new");
  await page.getByLabel("Stock symbol").fill(symbol);
  await expect(page.getByRole("status")).toContainText(`Saved defaults applied for ${symbol}`);
  await expect(page.getByRole("radio", { name: "Futures" })).toBeChecked();
  await expect(page.getByLabel("Number of lots / contracts")).toHaveValue("2.000000");
  await expect(page.getByLabel("Lot / contract size")).toHaveValue("5.000000");

  // Whole-row navigation (P4): clicking anywhere on a desktop row except the checkbox opens the detail.
  if ((page.viewportSize()?.width ?? 1280) >= 768) {
    await page.goto("/trades");
    const firstRow = page.locator("tbody tr").first();
    const rowTradeId = await firstRow.locator('input[name="tradeId"]').getAttribute("value");
    await firstRow.click({ position: { x: 280, y: 18 } });
    await expect(page).toHaveURL(new RegExp(`/trades/${rowTradeId}(\\?|$)`));
  }
});
