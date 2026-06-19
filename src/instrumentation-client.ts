import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { scrubSentryEvent } from "@/lib/telemetry/sentry";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
    beforeSend: scrubSentryEvent,
  });
}

const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
if (posthogProjectToken && posthogHost) {
  posthog.init(posthogProjectToken, {
    api_host: posthogHost,
    defaults: "2026-01-30",
    person_profiles: "identified_only",
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
