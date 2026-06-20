"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/auth-server";
import { getDb } from "@/db/server";
import { updateUserTimeZone } from "@/db/repositories/preferences";
import { isValidTimeZone } from "@/lib/date-time";
import { requireWorkspaceSession } from "@/lib/workspace-session";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

export interface TimeZoneFormState {
  error?: string;
  success?: string;
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
