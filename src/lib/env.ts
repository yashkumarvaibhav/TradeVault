export interface ServerEnvironment {
  databaseUrl: string | null;
  sentryDsn: string | null;
  posthogKey: string | null;
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
  const sentryDsn = validateUrl("NEXT_PUBLIC_SENTRY_DSN", optional(source.NEXT_PUBLIC_SENTRY_DSN), ["http:", "https:"]);
  const posthogKey = optional(source.NEXT_PUBLIC_POSTHOG_KEY);
  const posthogHost = validateUrl("NEXT_PUBLIC_POSTHOG_HOST", optional(source.NEXT_PUBLIC_POSTHOG_HOST), ["https:"]);

  if (posthogKey && !posthogHost) throw new Error("NEXT_PUBLIC_POSTHOG_HOST is required when NEXT_PUBLIC_POSTHOG_KEY is set.");

  return { databaseUrl, sentryDsn, posthogKey, posthogHost };
}

export function requireDatabaseUrl(source: EnvironmentSource = process.env) {
  const { databaseUrl } = readServerEnvironment(source);
  if (!databaseUrl) throw new Error("DATABASE_URL is required for database-backed operations.");
  return databaseUrl;
}
