"use server";

import { getDb } from "@/db/server";
import { normalizeUsername, validatePassword } from "@/lib/auth-policy";
import { recoverPasswordWithTotp } from "@/lib/auth-recovery";

export interface RecoveryFormState {
  error?: string;
  success?: boolean;
  fieldErrors?: { username?: string; code?: string; password?: string; confirm?: string };
}

export async function recoverPasswordAction(_prev: RecoveryFormState, formData: FormData): Promise<RecoveryFormState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const code = String(formData.get("code") ?? "").trim();
  const useBackup = formData.get("useBackup") === "1";
  const newPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: RecoveryFormState["fieldErrors"] = {
    username: username ? undefined : "Enter your username.",
    code: code ? undefined : useBackup ? "Enter a backup code." : "Enter the 6-digit code.",
    password: validatePassword(newPassword) ?? undefined,
    confirm: newPassword !== confirm ? "Passwords do not match." : undefined,
  };
  if (fieldErrors.username || fieldErrors.code || fieldErrors.password || fieldErrors.confirm) {
    return { fieldErrors };
  }

  const result = await recoverPasswordWithTotp(getDb(), { username, code, newPassword, useBackup });
  if (result === "ok") return { success: true };
  return { error: "Couldn't verify that. Check your username and code, then try again." };
}
