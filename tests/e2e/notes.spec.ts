import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

test.use({ storageState: AUTH_STATE });

test("Notes workspace surfaces trade notes linked to their source and filters by folder", async ({ page }, testInfo) => {
  // Unique per project: all device projects share one auth user, so the symbol must not collide.
  const symbol = `NOTE${testInfo.project.name.replace(/[^a-z]/gi, "")}`.toUpperCase();
  const entryText = `Pre-trade thesis for ${symbol}: wait for the opening range.`;
  const reviewText = `Reviewed ${symbol}: exited a touch too early.`;

  // Create a trade carrying an entry note and a review/exit note.
  await page.goto("/trades/new");
  await page.getByLabel("Instrument / symbol").fill(symbol);
  await page.getByLabel("Entry price").fill("100");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Lot / contract multiplier").fill("5");
  await page.getByLabel("Initial stop", { exact: true }).fill("90");
  await page.getByLabel("Planned target").fill("130");
  await page.getByLabel("Linked note").fill(entryText);
  await page.getByLabel("Trade notes").fill(reviewText);
  await page.getByRole("button", { name: "Save trade" }).click();
  await expect(page).toHaveURL(/\/trades\?created=1$/);

  // The Notes index shows both as read-only, linked source items.
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Notes", level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Notes navigation" });
  await expect(nav).toBeVisible();
  for (const link of ["All notes", "Pinned", "Templates", "Setups", "Risk rules", "Mistakes", "Tags", "Pre-trade", "Post-trade", "Daily journal"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${link}`) })).toBeVisible();
  }

  await page.getByRole("searchbox", { name: "Search notes" }).fill(symbol);
  await page.getByRole("searchbox", { name: "Search notes" }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${symbol}`));

  const entryCard = page.locator("article").filter({ hasText: "Pre-trade thesis" });
  const reviewCard = page.locator("article").filter({ hasText: "exited a touch too early" });
  await expect(entryCard).toContainText("Trade entry note");
  await expect(entryCard).toContainText("Linked · read-only");
  await expect(entryCard).toContainText(`Trade · ${symbol}`);
  await expect(reviewCard).toContainText("Trade review note");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "notes index has no page-level horizontal overflow").toBeLessThanOrEqual(0);

  await page.screenshot({ path: testInfo.outputPath("notes-index.png"), fullPage: true, animations: "disabled" });

  // Folder (note type) filter isolates pre-trade vs post-trade notes.
  await page.goto(`/notes?type=pre-trade&q=${symbol}`);
  await expect(page.locator("article").filter({ hasText: "Pre-trade thesis" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "exited a touch too early" })).toHaveCount(0);

  await page.goto(`/notes?type=post-trade&q=${symbol}`);
  await expect(page.locator("article").filter({ hasText: "exited a touch too early" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Pre-trade thesis" })).toHaveCount(0);

  // Source cards deep-link to the underlying trade.
  await page.goto(`/notes?q=${symbol}`);
  await page.locator("article").filter({ hasText: "Pre-trade thesis" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
});
