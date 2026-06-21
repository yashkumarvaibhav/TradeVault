import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";
import { totpFromDisplayedSecret } from "./totp";

// A throwaway account used by the gated specs (overview, command palette).
// Teardown deletes everything matching the `pw_e2e_` prefix.
const username = `pw_e2e_${Date.now().toString(36)}`;
const password = "playwright-e2e-passphrase-2026";

setup("create an authenticated session", async ({ page }) => {
  await page.goto("/login");
  // The login form hydrates after SSR; on a cold dev compile a plain click can land before React
  // attaches the toggle handler. Retry the mode switch until the signup-only field appears.
  await expect(async () => {
    await page.getByRole("radio", { name: "Create account" }).click();
    await expect(page.getByLabel("Confirm password")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // TOTP enrollment is mandatory — sign-up lands on the forced setup before the app.
  await page.waitForURL(/\/onboarding\/2fa$/);
  await page.getByLabel("Confirm your password to begin").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  await page.getByLabel("Verification code").fill(await totpFromDisplayedSecret(secret));
  await page.getByRole("button", { name: "Finish setup" }).click();

  // Enrollment unlocks the gated overview.
  await page.waitForURL("http://127.0.0.1:3001/");
  await expect(page.getByRole("heading", { name: new RegExp(`Good afternoon, ${username}`, "i") })).toBeVisible();

  async function addClosedTrade(symbol: string, currency: "INR" | "USD", entry: string, exit: string, stop: string, target: string, favorable: string, adverse: string) {
    await page.goto("/trades/new");
    await page.getByLabel("Instrument / symbol").fill(symbol);
    await page.getByLabel("Currency").selectOption(currency);
    await page.getByLabel("Entry date & time").fill("2026-06-10T09:00");
    await page.getByLabel("Entry price").fill(entry);
    await page.getByLabel("Initial stop", { exact: true }).fill(stop);
    await page.getByLabel("Planned target").fill(target);
    await page.getByLabel("Status").selectOption("closed");
    await page.getByLabel("Exit date & time").fill("2026-06-10T10:00");
    await page.getByLabel("Exit price").fill(exit);
    await page.getByLabel("Maximum favorable price").fill(favorable);
    await page.getByLabel("Maximum adverse price").fill(adverse);
    await page.getByRole("button", { name: "Save trade" }).click();
    await page.waitForURL(/\/trades\?created=1$/);
  }
  await addClosedTrade("SETUPINR", "INR", "100", "110", "90", "120", "120", "95");
  await addClosedTrade("SETUPUSD", "USD", "200", "205", "190", "220", "215", "195");
  await page.goto("/");

  await page.context().storageState({ path: AUTH_STATE });
});
