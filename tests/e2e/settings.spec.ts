import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";
import { totpFromDisplayedSecret } from "./totp";

// Settings lives behind auth; use the session from auth.setup.
test.use({ storageState: AUTH_STATE });

test("settings screen shows profile, appearance, and account controls", async ({ page }, testInfo) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Light" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Date & time" })).toBeVisible();
  await expect(page.getByLabel("Display timezone")).toHaveValue("Asia/Kolkata");
  await expect(page.getByText(/Timestamps remain stored as absolute instants/)).toBeVisible();
  // Scope to main content (the sidebar also has an icon sign-out button).
  await expect(page.getByRole("main").getByRole("button", { name: "Sign out" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);

  await page.screenshot({ path: testInfo.outputPath("settings.png"), fullPage: true, animations: "disabled" });

  // Toggling the theme preference updates the document theme.
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Regression: Overview is a real root route, not a hash appended to /settings.
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible();
});

test("password change requires the current password then TOTP", async ({ page }, testInfo) => {
  // Isolate this mutation from the shared authenticated fixture used by parallel specs.
  await page.context().clearCookies();
  // clearCookies also drops the tour-suppression cookie; re-add it so the per-screen tour card
  // doesn't overlap controls in this fresh-account flow.
  await page.context().addCookies([{ name: "tv_tours_off", value: "1", url: "http://127.0.0.1:3001" }]);
  const projectTag = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 4);
  const username = `pw_e2e_pw_${projectTag}_${Date.now().toString(36)}`;
  const currentPassword = "current-password-passphrase-2026";
  const newPassword = "changed-password-passphrase-2026";

  await page.goto("/?auth=signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(currentPassword);
  await page.getByLabel("Confirm password").fill(currentPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding\/2fa$/);
  await page.getByLabel("Confirm your password to begin").fill(currentPassword);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  await page.getByLabel("Verification code").fill(await totpFromDisplayedSecret(secret));
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL(/\/$/);

  await page.goto("/settings");
  await page.getByLabel("Current password").fill(currentPassword);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByLabel("Authenticator code").fill(await totpFromDisplayedSecret(secret));
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");

  await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
  // Sign-out now returns to the public landing page; sign back in via the modal.
  await page.waitForURL(/\/$/);
  await page.getByRole("button", { name: "Sign in" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Username").fill(username);
  await dialog.getByLabel("Password", { exact: true }).fill(newPassword);
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/$/);
});
