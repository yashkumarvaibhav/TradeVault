import { expect, test } from "@playwright/test";

import { totpFromDisplayedSecret } from "./totp";

// Mandatory TOTP enrollment. Runs unauthenticated (no storageState) and signs up a fresh
// throwaway account (teardown removes the `pw_e2e_` prefix).

test("an un-enrolled account is forced through TOTP setup before using the app", async ({ page }) => {
  const username = `pw_e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const password = "playwright-e2e-passphrase-2026";

  await page.goto("/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Sign-up redirects straight to the forced enrollment screen.
  await page.waitForURL(/\/onboarding\/2fa$/);
  await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();

  // The gate bounces every gated route back to enrollment while un-enrolled.
  await page.goto("/trades");
  await expect(page).toHaveURL(/\/onboarding\/2fa$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/onboarding\/2fa$/);

  // Completing enrollment unlocks the app.
  await page.getByLabel("Confirm your password to begin").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  await page.getByLabel("Verification code").fill(await totpFromDisplayedSecret(secret));
  await page.getByRole("button", { name: "Finish setup" }).click();

  await page.waitForURL("http://127.0.0.1:3001/");
  await expect(page.getByRole("link", { name: "Add trade" }).first()).toBeVisible();

  // An already-enrolled user is sent away from the setup page.
  await page.goto("/onboarding/2fa");
  await expect(page).toHaveURL(/127\.0\.0\.1:3001\/$/);

  // Settings exposes the opt-in "code at every sign-in" toggle (TOTP stays required).
  await page.goto("/settings");
  await expect(page.getByText("Authenticator app is set up.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on" })).toBeVisible();
});
