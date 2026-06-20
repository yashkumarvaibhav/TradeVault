import "server-only";

import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/db/server";
import { createAuth, type Auth } from "@/lib/auth";

let instance: Auth | null = null;

/**
 * Lazily construct the app's Better Auth instance on first request (never at import /
 * build time, so `next build` doesn't require a live database). `nextCookies()` must be
 * the last plugin so Better Auth can set auth cookies from Next server actions.
 */
export function getAuth(): Auth {
  if (!instance) {
    instance = createAuth(getDb(), { extraPlugins: [nextCookies()] });
  }
  return instance;
}
