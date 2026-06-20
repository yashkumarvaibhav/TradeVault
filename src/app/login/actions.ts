"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";

import { synthesizeAuthEmail } from "@/db/repositories/workspaces";
import { getAuth } from "@/lib/auth-server";
import { normalizeUsername, validatePassword, validateUsername } from "@/lib/auth-policy";

export interface AuthFormState {
  error?: string;
  fieldErrors?: { username?: string; password?: string; confirm?: string };
}

/** Map Better Auth's API errors to a friendly, non-enumerating message. */
function messageFor(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code ?? "";
    if (code.includes("USERNAME") && code.includes("TAKEN")) return "That username is already taken.";
    if (code.includes("INVALID")) return "Incorrect username or password.";
    return error.message || fallback;
  }
  return fallback;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { fieldErrors: { username: username ? undefined : "Enter your username.", password: password ? undefined : "Enter your password." } };
  }

  try {
    await getAuth().api.signInUsername({ body: { username, password }, headers: await headers() });
  } catch (error) {
    return { error: messageFor(error, "Incorrect username or password.") };
  }
  redirect("/");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawUsername = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fieldErrors: AuthFormState["fieldErrors"] = {
    username: validateUsername(rawUsername) ?? undefined,
    password: validatePassword(password) ?? undefined,
    confirm: password !== confirm ? "Passwords do not match." : undefined,
  };
  if (fieldErrors.username || fieldErrors.password || fieldErrors.confirm) return { fieldErrors };

  const username = normalizeUsername(rawUsername);
  const displayUsername = rawUsername.trim();
  try {
    await getAuth().api.signUpEmail({
      body: {
        username,
        displayUsername,
        name: displayUsername,
        // Synthesized, non-user-facing identifier — login stays username-only.
        email: synthesizeAuthEmail(username),
        password,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: messageFor(error, "Could not create your account. Try a different username.") };
  }
  redirect("/");
}
