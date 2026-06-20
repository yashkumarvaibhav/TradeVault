"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import { getAuth } from "@/lib/auth-server";

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

/** Step 1: verify password, generate the TOTP secret + backup codes (2FA not yet enabled). */
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

/** Step 2: confirm a code from the authenticator. This is what flips 2FA on. */
export async function enrollConfirmAction(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "Enter the 6-digit code from your app." };
  try {
    await getAuth().api.verifyTOTP({ body: { code: code.trim() }, headers: await headers() });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "That code didn't match. Check your authenticator and try again." };
  }
}

/** Turn 2FA off (requires the password). */
export async function twoFactorDisableAction(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!password) return { ok: false, error: "Enter your password to turn off two-factor." };
  try {
    await getAuth().api.disableTwoFactor({ body: { password }, headers: await headers() });
    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Incorrect password. Please try again." };
  }
}
