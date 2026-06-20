import { expect, test } from "@playwright/test";

test("login screen renders, toggles modes, and validates sign-up without a database", async ({ page }, testInfo) => {
  await page.goto("/login");

  // Editorial canvas: real wordmark (container is labelled; the inner image swaps per theme).
  await expect(page.locator('[aria-label="TradeVault"]').first()).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // No horizontal overflow on this viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);

  await page.screenshot({ path: testInfo.outputPath("login-signin.png"), animations: "disabled" });

  // Switch to Create account → confirm field + strength hint appear.
  await page.getByRole("radio", { name: "Create account" }).click();
  await expect(page.getByLabel("Confirm password")).toBeVisible();

  const password = page.getByLabel("Password", { exact: true });
  await password.fill("short");
  await expect(page.getByText(/Password strength:/)).toContainText("Too short");
  await password.fill("a-strong-enough-passphrase-2026");
  await expect(page.getByText(/Password strength:/)).toContainText(/Good|Strong|Fair/);

  await page.screenshot({ path: testInfo.outputPath("login-signup.png"), animations: "disabled" });

  // Server-side field validation returns before any DB access: mismatched confirm.
  await page.getByLabel("Username").fill("trader_joe");
  await password.fill("a-strong-enough-passphrase-2026");
  await page.getByLabel("Confirm password").fill("different-passphrase-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();

  // And a too-short password is rejected field-anchored.
  await password.fill("tooshort");
  await page.getByLabel("Confirm password").fill("tooshort");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/at least 12 characters/i)).toBeVisible();
});
