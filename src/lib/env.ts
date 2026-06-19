export interface ServerEnvironment {
  databaseUrl: string | null;
  betterAuthSecret: string | null;
  betterAuthUrl: string | null;
  sentryDsn: string | null;
  posthogProjectToken: string | null;
  posthogHost: string | null;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function optional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateUrl(name: string, value: string | null, protocols: string[]) {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${protocols.join(" or ")}.`);
  }
  return value;
}

export function readServerEnvironment(source: EnvironmentSource = process.env): ServerEnvironment {
  const databaseUrl = validateUrl("DATABASE_URL", optional(source.DATABASE_URL), ["postgres:", "postgresql:"]);
  const betterAuthSecret = optional(source.BETTER_AUTH_SECRET);
  const betterAuthUrl = validateUrl("BETTER_AUTH_URL", optional(source.BETTER_AUTH_URL), ["http:", "https:"]);
  if (betterAuthSecret && betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
  }
  const sentryDsn = validateUrl("NEXT_PUBLIC_SENTRY_DSN", optional(source.NEXT_PUBLIC_SENTRY_DSN), ["http:", "https:"]);
  const posthogProjectToken = optional(source.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
  const posthogHost = validateUrl("NEXT_PUBLIC_POSTHOG_HOST", optional(source.NEXT_PUBLIC_POSTHOG_HOST), ["https:"]);

  if (posthogProjectToken && !posthogHost) throw new Error("NEXT_PUBLIC_POSTHOG_HOST is required when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set.");

  return { databaseUrl, betterAuthSecret, betterAuthUrl, sentryDsn, posthogProjectToken, posthogHost };
}

export function requireDatabaseUrl(source: EnvironmentSource = process.env) {
  const { databaseUrl } = readServerEnvironment(source);
  if (!databaseUrl) throw new Error("DATABASE_URL is required for database-backed operations.");
  return databaseUrl;
}
