"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

import { users } from "@/db/schema";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";
import { isTotpEnrolled, markTotpEnrolled, verifyUserTotp } from "@/lib/auth-totp";

export type EnrollStart =
  | { ok: true; qrDataUrl: string; secret: string; backupCodes: string[] }
  | { ok: false; error: string };

function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

/**
 * Step 1: verify the password and generate the TOTP secret + backup codes. Better Auth's
 * `enableTwoFactor` stores the secret with `verified:false` and does NOT enable the login
 * challenge — enrollment is mandatory but stays decoupled from "ask a code at every sign-in".
 */
export async function enrollStartAction(password: string): Promise<EnrollStart> {
  if (!password) return { ok: false, error: "Enter your password to continue." };
  try {
    const result = await getAuth().api.enableTwoFactor({ body: { password }, headers: await headers() });
    const totpURI = (result as { totpURI: string }).totpURI;
    const backupCodes = (result as { backupCodes: string[] }).backupCodes;
    const qrDataUrl = await QRCode.toDataURL(totpURI, { margin: 1, width: 220 });
    return { ok: true, qrDataUrl, secret: secretFromTotpUri(totpURI), backupCodes };
  } catch {
    return { ok: false, error: "Incorrect password. Please try again." };
  }
}

/**
 * Step 2: confirm a code from the authenticator. We verify it OURSELVES against the stored
 * secret and mark the factor verified — deliberately NOT calling Better Auth's `verifyTOTP`,
 * which would flip `two_factor_enabled` and force a code at every login. This completes the
 * mandatory enrollment while leaving the login challenge opt-in.
 */
export async function enrollConfirmAction(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "Enter the 6-digit code from your app." };
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return { ok: false, error: "Your session expired. Please sign in again." };

  const db = getDb();
  const valid = await verifyUserTotp(db, session.user.id, code.trim());
  if (!valid) return { ok: false, error: "That code didn't match. Check your authenticator and try again." };

  await markTotpEnrolled(db, session.user.id);
  revalidatePath("/settings");
  revalidatePath("/onboarding/2fa");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Opt into / out of a TOTP code at every sign-in (Better Auth's `two_factor_enabled`). The
 * authenticator stays enrolled either way — this only toggles the login challenge. Turning it
 * on requires an already-enrolled secret.
 */
export async function setLoginTwoFactorAction(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return { ok: false, error: "Your session expired. Please sign in again." };

  const db = getDb();
  if (enabled && !(await isTotpEnrolled(db, session.user.id))) {
    return { ok: false, error: "Set up your authenticator app first." };
  }
  await db.update(users).set({ twoFactorEnabled: enabled, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
