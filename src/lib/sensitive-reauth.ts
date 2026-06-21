import "server-only";

import { cookies } from "next/headers";

import { createReauthToken, verifyReauthToken } from "@/lib/reauth-token";

export const SENSITIVE_REAUTH_COOKIE = "tradevault.sensitive-reauth";
export const SENSITIVE_REAUTH_TTL_SECONDS = 120;

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required for sensitive-action authorization.");
  return secret;
}

export async function grantSensitiveActionAuthorization(input: { userId: string; sessionId: string }): Promise<void> {
  const expiresAt = Date.now() + SENSITIVE_REAUTH_TTL_SECONDS * 1000;
  const token = createReauthToken({ ...input, expiresAt }, authSecret());
  (await cookies()).set(SENSITIVE_REAUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SENSITIVE_REAUTH_TTL_SECONDS,
  });
}

export async function hasSensitiveActionAuthorization(input: { userId: string; sessionId: string }): Promise<boolean> {
  const token = (await cookies()).get(SENSITIVE_REAUTH_COOKIE)?.value;
  return verifyReauthToken(token, input, authSecret());
}

export function sensitiveActionDeniedResponse(): Response {
  return Response.json(
    { error: "Confirm your password and authenticator code to continue." },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
