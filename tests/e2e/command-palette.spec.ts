import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// The app shell (and its palette) live behind auth; use the session from auth.setup.
test.use({ storageState: AUTH_STATE });

test("command palette opens, searches, and is keyboard-operable", async ({ page }, testInfo) => {
  await page.goto("/");

  // Open via the clickable chrome trigger (label differs by breakpoint).
  const isMobile = testInfo.project.name.startsWith("mobile");
  await page
    .getByRole(isMobile ? "button" : "button", { name: isMobile ? "Open command palette" : "Search your vault" })
    .click();

  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  // Initial focus lands in the query field, and groups render.
  const input = page.getByPlaceholder(/Search views, actions, records/i);
  await expect(input).toBeFocused();
  await expect(page.getByRole("group", { name: /Navigate/i })).toBeVisible();
  await expect(palette.getByRole("group", { name: /Recent records & libraries/i })).toBeVisible({ timeout: 15_000 });

  // Screenshot the real mixed-record palette for owner review (desktop + mobile, light + dark).
  await page.screenshot({ path: testInfo.outputPath("command-palette-open.png"), animations: "disabled" });

  // Explicit server queries stay stable even while other parallel specs add journal rows.
  await input.fill("SETUPINR");
  await expect(palette.getByRole("option", { name: /SETUPINR Long · Closed/ })).toBeVisible();
  await expect(palette.getByText(/Long · Closed · Equity · \+₹10 · INR/)).toBeVisible();

  // Server-side filtering returns a real record, exposes only the public DTO, and deep-links exactly.
  await input.fill("SETUPUSD");
  const usdResult = palette.getByRole("option", { name: /SETUPUSD Long · Closed/ });
  await expect(usdResult).toBeVisible();
  await expect(usdResult).toContainText(/Long · Closed · Equity · \+\$5\.00 · USD/);
  const payload = await page.evaluate(async () => (await fetch("/api/search?q=SETUPUSD")).json());
  const tradePayload = payload.results.find((result: { kind: string }) => result.kind === "trade");
  expect(tradePayload).toBeTruthy();
  expect(tradePayload).not.toHaveProperty("searchText");
  expect(tradePayload).not.toHaveProperty("bodyText");
  expect(tradePayload.currency).toBe("USD");
  await usdResult.click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");

  // Filtering still narrows static actions from any gated view.
  await page
    .getByRole("button", { name: isMobile ? "Open command palette" : "Search your vault" })
    .click();
  await expect(palette).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("theme");
  await expect(palette.getByText("Toggle light / dark theme")).toBeVisible();
  await expect(palette.getByText("Add trade")).toHaveCount(0);

  // Escape closes and returns focus to the page.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  // Keyboard shortcut reopens; a typed view remains keyboard-selectable.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("Overview");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test("chrome stays overflow-free on very narrow viewports, palette open or closed", async ({ page }) => {
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const width of [320, 360, 375]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto("/", { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Open command palette" });
    await expect(trigger).toBeVisible();
    await page.evaluate(() => document.fonts?.ready);
    // The overview's chart entrance animations can transiently overflow on mount; poll until layout
    // settles. A genuine horizontal overflow never settles, so this still fails on a real regression.
    await expect.poll(overflow, { message: `closed @ ${width}px`, timeout: 5000 }).toBeLessThanOrEqual(0);

    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await expect.poll(overflow, { message: `palette open @ ${width}px`, timeout: 5000 }).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
});
