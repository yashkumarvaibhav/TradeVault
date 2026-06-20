/**
 * Pure, client-safe auth policy: username/password rules shared by the sign-up form,
 * the server actions, and the Better Auth runtime config. No server-only imports.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 12;

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

/** Returns a field error message, or null when the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  if (username.length > USERNAME_MAX_LENGTH) return `Use at most ${USERNAME_MAX_LENGTH} characters.`;
  if (!USERNAME_PATTERN.test(username)) return "Use letters, numbers, and . _ - only.";
  return null;
}

/** Returns a field error message, or null when the password meets policy. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  return null;
}

export interface PasswordStrength {
  /** 0–4 */
  score: number;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
}

/** Lightweight strength hint (length + character variety). Not a security gate. */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return { score: 0, label: "Too short" };
  let variety = 0;
  if (/[a-z]/.test(password)) variety++;
  if (/[A-Z]/.test(password)) variety++;
  if (/[0-9]/.test(password)) variety++;
  if (/[^A-Za-z0-9]/.test(password)) variety++;
  const lengthBonus = password.length >= 16 ? 1 : 0;
  const score = Math.min(4, Math.max(1, variety - 1 + lengthBonus));
  const label = (["Weak", "Weak", "Fair", "Good", "Strong"] as const)[score];
  return { score, label };
}
