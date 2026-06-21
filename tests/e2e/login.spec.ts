import { expect, test } from "@playwright/test";

// Auth is a landing-page modal now (the /login + /signup pages are retired). These specs drive the
// modal via the `?auth=` deep link and scope queries to the dialog so they don't collide with the
// landing page's own Sign in / Create account CTAs.

test("auth modal renders, toggles modes, and validates sign-up without a database", async ({ page }, testInfo) => {
  await page.goto("/?auth=signin");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Editorial canvas: real wordmark (container is labelled; the inner image swaps per theme).
  await expect(dialog.locator('[aria-label="TradeVault"]').first()).toBeVisible();
  await expect(dialog.getByLabel("Username")).toBeVisible();
  await expect(dialog.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign in" })).toBeVisible();

  // No horizontal overflow on this viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);

  await page.screenshot({ path: testInfo.outputPath("auth-signin.png"), animations: "disabled" });

  // Switch to Create account → confirm field + strength hint appear.
  await dialog.getByRole("radio", { name: "Create account" }).click();
  await expect(dialog.getByLabel("Confirm password")).toBeVisible();

  const password = dialog.getByLabel("Password", { exact: true });
  await password.fill("short");
  await expect(dialog.getByText(/Password strength:/)).toContainText("Too short");
  await password.fill("a-strong-enough-passphrase-2026");
  await expect(dialog.getByText(/Password strength:/)).toContainText(/Good|Strong|Fair/);

  await page.screenshot({ path: testInfo.outputPath("auth-signup.png"), animations: "disabled" });

  // Server-side field validation returns before any DB access: mismatched confirm.
  await dialog.getByLabel("Username").fill("trader_joe");
  await password.fill("a-strong-enough-passphrase-2026");
  await dialog.getByLabel("Confirm password").fill("different-passphrase-2026");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Passwords do not match.")).toBeVisible();

  // And a too-short password is rejected field-anchored (assert the field error, not the hint).
  await password.fill("tooshort");
  await dialog.getByLabel("Confirm password").fill("tooshort");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.locator("#password-error")).toContainText(/at least 12 characters/i);
});

test("forgot-password form opens and validates without a database", async ({ page }) => {
  await page.goto("/?auth=signin");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Forgot password?" }).click();
  await expect(dialog.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(dialog.getByLabel("Authenticator code")).toBeVisible();

  // Mismatched new password is caught before any DB access.
  await dialog.locator("#recover-username").fill("trader_joe");
  await dialog.locator("#recover-code").fill("123456");
  await dialog.locator("#recover-password").fill("a-strong-enough-passphrase-2026");
  await dialog.locator("#recover-confirm").fill("different-passphrase-2026");
  await dialog.getByRole("button", { name: "Reset password" }).click();
  await expect(dialog.locator("#recover-confirm-error")).toContainText(/do not match/i);

  // The backup-code toggle relabels the code field.
  await dialog.getByRole("button", { name: /Use a backup code/i }).click();
  await expect(dialog.getByLabel("Backup code")).toBeVisible();
});
