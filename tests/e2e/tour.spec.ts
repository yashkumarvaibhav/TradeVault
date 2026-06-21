import { expect, test } from "@playwright/test";

import { totpFromDisplayedSecret } from "./totp";

// Per-screen onboarding tour. Runs unauthenticated (no storageState, no tv_tours_off cookie) and
// signs up a fresh throwaway account so the welcome card and spotlight actually appear. Teardown
// removes the `pw_e2e_` prefix.

test("first visit shows the welcome card, runs the spotlight, and remembers it", async ({ page }) => {
  const username = `pw_e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const password = "playwright-e2e-passphrase-2026";

  // Sign up + mandatory TOTP enrollment → lands on the Overview.
  await page.goto("/?auth=signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding\/2fa$/);
  await page.getByLabel("Confirm your password to begin").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).trim();
  await page.getByLabel("Verification code").fill(await totpFromDisplayedSecret(secret));
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL(/\/$/);

  // The first-visit welcome card (non-modal nudge) appears on the Overview.
  const card = page.getByRole("region", { name: /guided tour available/i });
  await expect(card).toBeVisible();

  // Launching the spotlight shows a step dialog with a step counter and controls.
  await card.getByRole("button", { name: "Show me around" }).click();
  const spotlight = page.getByRole("dialog");
  await expect(spotlight).toBeVisible();
  await expect(spotlight.getByText(/1 \/ \d/)).toBeVisible();

  // Step through to the end; "Done" closes it.
  for (let i = 0; i < 8; i += 1) {
    const done = spotlight.getByRole("button", { name: "Done" });
    if (await done.isVisible().catch(() => false)) {
      await done.click();
      break;
    }
    await spotlight.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Completion is persisted: a reload no longer auto-opens the welcome card, but the replay button
  // is available.
  await page.reload();
  await expect(page.getByRole("region", { name: /guided tour available/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show the guided tour for/i })).toBeVisible();
});
