"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/auth-server";
import { getDb } from "@/db/server";
import { updateUserTimeZone } from "@/db/repositories/preferences";
import { isValidTimeZone } from "@/lib/date-time";
import { validatePassword } from "@/lib/auth-policy";
import { changePasswordWithTotp } from "@/lib/auth-recovery";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

export interface TimeZoneFormState {
  error?: string;
  success?: string;
}

export interface ChangePasswordFormState {
  error?: string;
  success?: string;
  fieldErrors?: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    code?: string;
  };
}

export async function changePasswordAction(
  _prev: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const fieldErrors: NonNullable<ChangePasswordFormState["fieldErrors"]> = {
    currentPassword: currentPassword ? undefined : "Enter your current password.",
    newPassword: validatePassword(newPassword) ?? undefined,
    confirmPassword: newPassword === confirmPassword ? undefined : "Passwords do not match.",
    code: /^\d{6}$/.test(code) ? undefined : "Enter a 6-digit authenticator code.",
  };
  if (Object.values(fieldErrors).some(Boolean)) return { fieldErrors };
  if (currentPassword === newPassword) return { fieldErrors: { newPassword: "Choose a different password." } };

  const { session } = await requireWorkspaceSession();
  const result = await changePasswordWithTotp(getDb(), {
    userId: session.user.id,
    currentPassword,
    newPassword,
    code,
    currentSessionId: session.session.id,
  });
  if (result !== "ok") return { error: "Your current password or authenticator code didn't match." };
  return { success: "Password changed. Other signed-in devices were signed out." };
}

export async function updateTimeZoneAction(_prev: TimeZoneFormState, formData: FormData): Promise<TimeZoneFormState> {
  const timeZone = String(formData.get("timeZone") ?? "").trim();
  if (!isValidTimeZone(timeZone)) return { error: "Choose a valid IANA timezone." };
  const { session } = await requireWorkspaceSession();
  const updated = await updateUserTimeZone(getDb(), session.user.id, timeZone);
  if (!updated) return { error: "Could not update your timezone. Please try again." };
  revalidatePath("/", "layout");
  return { success: `Timezone saved as ${updated}.` };
}

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 60) {
    return { error: "Display name must be 1–60 characters." };
  }

  try {
    await getAuth().api.updateUser({ body: { name }, headers: await headers() });
  } catch {
    return { error: "Could not update your profile. Please try again." };
  }

  // Reflect the new display name in the shell on next load.
  revalidatePath("/");
  revalidatePath("/settings");
  return { success: "Profile saved." };
}
