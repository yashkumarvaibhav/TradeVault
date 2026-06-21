import { expect, test } from "@playwright/test";

// The public landing opens Sign in / Create account as a closable modal (not a separate page).
// These specs run unauthenticated (no storageState) so the root renders the marketing landing.

test("the landing page opens, toggles, and closes the auth modal", async ({ page }) => {
  await page.goto("/");

  // Closed by default (Radix unmounts the dialog content).
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Hero CTA opens it in create-account mode (confirm-password field present).
  await page.getByRole("button", { name: "Get started free" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Confirm password")).toBeVisible();

  // The in-modal segmented control switches to sign-in (confirm field gone).
  await dialog.getByRole("radio", { name: "Sign in" }).click();
  await expect(dialog.getByLabel("Confirm password")).toHaveCount(0);
  await expect(dialog.getByLabel("Username")).toBeVisible();

  // The cross closes it.
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Escape also closes (reopen, then press Escape).
  await page.getByRole("button", { name: "Get started free" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("signing up through the landing modal forces mandatory TOTP setup", async ({ page }) => {
  const username = `pw_e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const password = "playwright-e2e-passphrase-2026";

  await page.goto("/");
  await page.getByRole("button", { name: "Get started free" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Confirm password")).toBeVisible();

  await dialog.getByLabel("Username").fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByLabel("Confirm password").fill(password);
  await dialog.getByRole("button", { name: "Create account" }).click();

  // Sign-up leaves the landing for the mandatory authenticator setup (not the app yet).
  await page.waitForURL(/\/onboarding\/2fa$/);
  await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();
});
