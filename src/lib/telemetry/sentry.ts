import type { ErrorEvent } from "@sentry/nextjs";

const privateHeaders = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

/** Keep observability useful without exporting journal/auth payloads or identity. */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.data = undefined;
    event.request.cookies = undefined;
    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).filter(([name]) => !privateHeaders.has(name.toLowerCase())),
      );
    }
  }

  if (event.user) {
    event.user.email = undefined;
    event.user.ip_address = undefined;
    event.user.username = undefined;
  }

  return event;
}
