import { describe, expect, it } from "vitest";

import { readServerEnvironment, requireDatabaseUrl } from "./env";

describe("environment contract", () => {
  it("keeps database and telemetry optional for static builds", () => {
    expect(readServerEnvironment({})).toEqual({
      databaseUrl: null,
      betterAuthSecret: null,
      betterAuthUrl: null,
      sentryDsn: null,
      posthogProjectToken: null,
      posthogHost: null,
    });
  });

  it("validates configured URLs and paired PostHog settings", () => {
    expect(() => readServerEnvironment({ DATABASE_URL: "sqlite:///tmp/test.db" })).toThrow("postgres:");
    expect(() => readServerEnvironment({ BETTER_AUTH_SECRET: "too-short" })).toThrow("BETTER_AUTH_SECRET");
    expect(() => readServerEnvironment({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "ph_test" })).toThrow("NEXT_PUBLIC_POSTHOG_HOST");
    expect(readServerEnvironment({
      DATABASE_URL: "postgresql://localhost/tradevault",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "ph_test",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    })).toMatchObject({ databaseUrl: "postgresql://localhost/tradevault", posthogProjectToken: "ph_test" });
  });

  it("fails clearly only when a database-backed operation requires the URL", () => {
    expect(() => requireDatabaseUrl({})).toThrow("DATABASE_URL is required");
  });
});
