import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// The overview lives behind auth; use the session created in auth.setup.
test.use({ storageState: AUTH_STATE });

test("overview uses scoped journal data and is visually reviewable", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Good afternoon, pw_e2e_/i })).toBeVisible();
  await expect(page.getByText("Live journal")).toBeVisible();
  await expect(page.getByText("Sample data · not your journal")).toHaveCount(0);
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
  await expect(page.getByText("$5.00", { exact: true }).first()).toBeVisible();
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

  // P5: date scope navigates, shows an active chip, and resets.
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page).toHaveURL(/[?&]period=30d/);
  await expect(page.getByRole("link", { name: "Reset scope" })).toBeVisible();
  await page.getByText("Custom", { exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("2020-01-01");
  await page.getByLabel("To", { exact: true }).fill("2030-12-31");
  await page.getByRole("button", { name: "Apply range" }).click();
  await expect(page).toHaveURL(/[?&]period=custom/);
  await expect(page.getByText("2020-01-01 – 2030-12-31")).toBeVisible();
  await page.getByRole("link", { name: "Reset scope" }).click();
  await expect(page).toHaveURL(/\/$/);

  // P5: deep links — review attention and a recent trade both reach My Trades / the detail.
  await page.getByRole("link", { name: /Review closed trades/i }).click();
  await expect(page).toHaveURL(/\/review#review-queue/);
  await expect(page.getByRole("heading", { name: "Trades waiting for review" })).toBeVisible();
  await page.goto("/");
  // First trade-detail deep link in the recent-trades / open-positions strips (symbol-agnostic: the
  // shared e2e account is mutated by other specs concurrently). Excludes /trades/new and /trades?…
  const detailLink = page.locator('a[href^="/trades/"]:not([href*="new"]):not([href*="?"])').first();
  await expect(detailLink).toBeVisible();
  await detailLink.click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}/);
});

test("the account/profile menu in the sidebar replaces the header log-out button", async ({ page }, testInfo) => {
  await page.goto("/");
  const mobile = testInfo.project.name.startsWith("mobile");

  // The top chrome no longer carries a Log out control.
  await expect(page.getByRole("button", { name: /log out/i })).toHaveCount(0);

  // On mobile the sidebar (and its profile section) lives inside the navigation drawer.
  if (mobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "TradeVault navigation" })).toBeVisible();
  }

  // The profile section sits just below Settings; opening it reveals Sign out.
  const account = page.getByRole("button", { name: /Account menu for .*pw_e2e_/i });
  await expect(account).toBeVisible();
  await account.click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account & settings" })).toBeVisible();
});
