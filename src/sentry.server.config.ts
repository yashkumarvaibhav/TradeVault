import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@/lib/telemetry/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
    beforeSend: scrubSentryEvent,
  });
}
