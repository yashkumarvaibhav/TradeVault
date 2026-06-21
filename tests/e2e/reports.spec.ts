import { expect, test } from "@playwright/test";

import { AUTH_STATE, E2E_PASSWORD } from "./auth-paths";
import { totpForAuthenticatedFixture } from "./totp";

test.use({ storageState: AUTH_STATE });

test("reports previews one currency, exports safely, and re-imports idempotently", async ({ page }, testInfo) => {
  await page.goto("/reports");

  await expect(page.getByRole("heading", { name: "Reports & backups", level: 1 })).toBeVisible();
  await expect(page.getByRole("article", { name: "INR performance report preview" })).toBeVisible();
  await expect(page.getByText(/INR and USD are never summed raw/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /INR cumulative net P&L equity curve/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Monthly net P&L bar chart/i })).toBeVisible();
  await expect(page.getByRole("img", { name: /Net P&L by weekday bar chart/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF report" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("reports-preview.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("radio", { name: "USD" }).click();
  await expect(page.getByRole("article", { name: "USD performance report preview" })).toBeVisible();
  await expect(page.getByRole("img", { name: /USD cumulative net P&L equity curve/i })).toBeVisible();

  // Session auth alone is insufficient for any sensitive download/import route.
  expect((await page.request.get("/api/data-transfer/export")).status()).toBe(403);
  expect((await page.request.get("/api/reports/pdf?currency=INR")).status()).toBe(403);

  // Password then TOTP grants this session a short two-minute authorization and starts
  // the requested download. The same grant covers the round-trip operations below.
  await page.getByRole("button", { name: "Download PDF report" }).click();
  await expect(page.getByRole("dialog", { name: "Download PDF report" })).toBeVisible();
  await expect(page.getByLabel("Current password")).toBeFocused();
  await page.getByLabel("Current password").fill(E2E_PASSWORD);
  await page.getByLabel("Authenticator code").fill(await totpForAuthenticatedFixture());
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Verify & download PDF" }).click();
  expect((await pdfDownload).suggestedFilename()).toContain("-usd-");

  const exportResponse = await page.request.get("/api/data-transfer/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-disposition"]).toContain("attachment;");
  const exported = await exportResponse.json();
  expect(exported.format).toBe("tradevault_export_v3");
  expect(exported.attachments).toMatchObject({ included: false });
  const serialized = JSON.stringify(exported).toLocaleLowerCase();
  for (const unsafe of ["password", "totp", "storage_key", "created_by_user_id", "tenant_id", "user_id", "username"]) {
    expect(serialized).not.toContain(`\"${unsafe}\"`);
  }

  const imported = await page.request.post("/api/data-transfer/import", { multipart: { file: { name: "round-trip.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) } } });
  expect(imported.status()).toBe(200);
  const summary = await imported.json();
  expect(summary.summary.trades.imported).toBe(0);
  expect(summary.summary.trades.skipped).toBeGreaterThanOrEqual(2);

  // The server-generated PDF must render at runtime, single-currency, as a real
  // A4 PDF attachment — exercises react-pdf + the vendored font under next-server.
  const inrPdf = await page.request.get("/api/reports/pdf?currency=INR");
  expect(inrPdf.status()).toBe(200);
  expect(inrPdf.headers()["content-type"]).toContain("application/pdf");
  expect(inrPdf.headers()["content-disposition"]).toContain("attachment;");
  expect(inrPdf.headers()["content-disposition"]).toContain("-inr-");
  const pdfBytes = await inrPdf.body();
  expect(pdfBytes.byteLength).toBeGreaterThan(8000);
  expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const usdPdf = await page.request.get("/api/reports/pdf?currency=USD");
  expect(usdPdf.status()).toBe(200);
  expect(usdPdf.headers()["content-disposition"]).toContain("-usd-");

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Download PDF report" })).toBeHidden();
  await expect(page.getByRole("article", { name: "USD performance report preview" })).toBeVisible();
});
