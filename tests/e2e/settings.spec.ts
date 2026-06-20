import { expect, test } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

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
});
