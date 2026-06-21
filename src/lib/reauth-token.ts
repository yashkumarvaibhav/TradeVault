import { createHmac, timingSafeEqual } from "node:crypto";

export interface ReauthClaims {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

interface TokenPayload {
  v: 1;
  sub: string;
  sid: string;
  exp: number;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/** Create a compact HMAC token bound to one user, one session, and a hard expiry. */
export function createReauthToken(claims: ReauthClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: claims.userId,
    sid: claims.sessionId,
    exp: claims.expiresAt,
  } satisfies TokenPayload)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

/** Verify signature, expiry, and exact session binding. Malformed tokens fail closed. */
export function verifyReauthToken(
  token: string | undefined,
  expected: { userId: string; sessionId: string },
  secret: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return false;

  try {
    const actual = Buffer.from(encodedSignature, "base64url");
    const wanted = signature(payload, secret);
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return false;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TokenPayload>;
    return claims.v === 1
      && claims.sub === expected.userId
      && claims.sid === expected.sessionId
      && typeof claims.exp === "number"
      && Number.isFinite(claims.exp)
      && claims.exp > now;
  } catch {
    return false;
  }
}
