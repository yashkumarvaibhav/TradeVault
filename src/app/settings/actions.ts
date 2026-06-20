"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/auth-server";

export interface ProfileFormState {
  error?: string;
  success?: string;
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
