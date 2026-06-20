import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// A throwaway account used by the gated specs (overview, command palette).
// Teardown deletes everything matching the `pw_e2e_` prefix.
const username = `pw_e2e_${Date.now().toString(36)}`;
const password = "playwright-e2e-passphrase-2026";

setup("create an authenticated session", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Successful sign-up + onboarding lands on the gated overview.
  await page.waitForURL("http://127.0.0.1:3001/");
  await expect(page.getByRole("heading", { name: /Good afternoon, Yash/i })).toBeVisible();

  await page.context().storageState({ path: AUTH_STATE });
});
