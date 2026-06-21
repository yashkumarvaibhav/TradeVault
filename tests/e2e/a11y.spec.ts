import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { AUTH_STATE } from "./auth-paths";

// WCAG 2.0 + 2.1, levels A and AA — the contractual accessibility bar for go-public.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

type Violation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

function summarize(violations: Violation[]) {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 6)
        .map((n) => `      • ${n.target.join(" ")}\n        ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 240)}`)
        .join("\n");
      return `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}

async function audit(page: Page) {
  // Let fonts + layout settle so color-contrast measurements are stable. (networkidle is
  // unreliable under the Next dev server's persistent HMR socket, so we settle explicitly.)
  await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve()));
  await page.waitForTimeout(350);
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
  expect(summarize(results.violations) || "no violations", `axe found ${results.violations.length} violation(s):`).toBe(
    "no violations",
  );
}

// Wait for the page's own content (a visible heading inside the main landmark) rather than
// nav text — on mobile the nav lives in a closed Sheet, so matching nav labels resolves to
// hidden elements.
async function waitForContent(page: Page) {
  await expect(page.locator("#main-content :is(h1, h2)").first()).toBeVisible();
}

// The public marketing + auth pages are reachable signed-out.
test.describe("public pages (unauthenticated)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ["/", "/features", "/faq"]) {
    test(`marketing ${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      await waitForContent(page);
      await audit(page);
    });
  }

  test("login screen has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Sign in/i }).first()).toBeVisible();
    await audit(page);
  });

  test("signup screen has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: /Create account/i }).first()).toBeVisible();
    await audit(page);
  });
});

// Every other audited surface lives behind the gated shell.
test.describe("authenticated core routes", () => {
  test.use({ storageState: AUTH_STATE });

  const routes: Array<{ name: string; path: string }> = [
    { name: "overview", path: "/" },
    { name: "my-trades", path: "/trades" },
    { name: "add-trade", path: "/trades/new" },
    { name: "analytics", path: "/analytics" },
    { name: "review", path: "/review" },
    { name: "calendar", path: "/calendar" },
    { name: "notes", path: "/notes" },
    { name: "note-editor", path: "/notes/new" },
    { name: "risk", path: "/risk" },
    { name: "reports", path: "/reports" },
    { name: "settings", path: "/settings" },
  ];

  for (const route of routes) {
    test(`${route.name} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(route.path);
      await waitForContent(page);
      await expect(page.getByRole("region", { name: "Active trade market" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Switch to International/USD Trades" })).toBeVisible();
      await audit(page);
    });
  }

  test("trade detail has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/trades");
    // The mobile layout keeps the detail link inside a collapsed <details>, so read the
    // href (present in the DOM regardless of visibility) and navigate directly.
    const href = await page
      .locator('a[href^="/trades/"]:not([href*="new"]):not([href*="?"])')
      .first()
      .getAttribute("href");
    expect(href).toMatch(/\/trades\/[0-9a-f-]{36}/);
    await page.goto(href!);
    await waitForContent(page);
    await audit(page);
  });
});
