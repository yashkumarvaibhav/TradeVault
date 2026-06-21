import { describe, expect, it } from "vitest";

import { createReauthToken, verifyReauthToken } from "./reauth-token";

const secret = "reauth-test-secret-that-is-long-enough";
const now = new Date("2026-06-21T18:00:00.000Z").getTime();
const claims = { userId: "user-1", sessionId: "session-1", expiresAt: now + 120_000 };

describe("sensitive-action re-auth token", () => {
  it("accepts an unexpired token only for its user and session", () => {
    const token = createReauthToken(claims, secret);
    expect(verifyReauthToken(token, claims, secret, now)).toBe(true);
    expect(verifyReauthToken(token, { ...claims, userId: "user-2" }, secret, now)).toBe(false);
    expect(verifyReauthToken(token, { ...claims, sessionId: "session-2" }, secret, now)).toBe(false);
  });

  it("rejects expired, tampered, and malformed tokens", () => {
    const token = createReauthToken(claims, secret);
    expect(verifyReauthToken(token, claims, secret, claims.expiresAt)).toBe(false);
    expect(verifyReauthToken(`${token.slice(0, -1)}x`, claims, secret, now)).toBe(false);
    expect(verifyReauthToken("not-a-token", claims, secret, now)).toBe(false);
  });
});
