import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "./sentry";

describe("telemetry privacy boundary", () => {
  it("removes request bodies, private headers, and direct identity", () => {
    const event = scrubSentryEvent({
      type: undefined,
      request: {
        data: { tradeNotes: "private journal text" },
        cookies: { session: "secret" },
        headers: { authorization: "Bearer secret", "x-request-id": "safe" },
      },
      user: { id: "opaque-user-id", email: "private@example.com", username: "private", ip_address: "127.0.0.1" },
    });

    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toEqual({ "x-request-id": "safe" });
    expect(event.user).toEqual({ id: "opaque-user-id", email: undefined, username: undefined, ip_address: undefined });
  });
});
