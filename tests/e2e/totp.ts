import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { readFile } from "node:fs/promises";

import { TOTP_SECRET_STATE } from "./auth-paths";

/**
 * Generate a current 6-digit TOTP from the base32 secret the enrollment UI displays
 * (the `secret=` param of the otpauth URI). Better Auth HMACs with the *raw* secret, so we
 * base32-decode the displayed value back to the raw secret and run the same OTP primitive —
 * guaranteeing the generated code matches the server's verification (which uses window=1).
 */
export async function totpFromDisplayedSecret(displayedSecret: string): Promise<string> {
  const raw = new TextDecoder().decode(base32.decode(displayedSecret.trim()));
  return createOTP(raw, { period: 30, digits: 6 }).totp();
}

export async function totpForAuthenticatedFixture(): Promise<string> {
  return totpFromDisplayedSecret(await readFile(TOTP_SECRET_STATE, "utf8"));
}
