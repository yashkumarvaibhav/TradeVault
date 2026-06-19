import { expect, test } from "@playwright/test";

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
  await expect(page.getByText(/Long · \+₹4,200 · INR/)).toBeVisible();
  await expect(page.getByText(/Short · −\$118\.40 · USD/)).toBeVisible();

  // Screenshot the open palette for owner review (desktop + mobile, light + dark).
  await page.screenshot({ path: testInfo.outputPath("command-palette-open.png"), animations: "disabled" });

  // Filtering narrows results.
  await input.fill("theme");
  await expect(palette.getByText("Toggle light / dark theme")).toBeVisible();
  await expect(palette.getByText("Add trade")).toHaveCount(0);

  // Escape closes and returns focus to the page.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  // Keyboard shortcut reopens; Enter selects the highlighted first item (Overview).
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette).toBeVisible();
  await expect(input).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/#overview$/);
});

test("chrome stays overflow-free on very narrow viewports, palette open or closed", async ({ page }) => {
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const width of [320, 360, 375]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto("/");
    expect(await overflow(), `closed @ ${width}px`).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    expect(await overflow(), `palette open @ ${width}px`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
});
