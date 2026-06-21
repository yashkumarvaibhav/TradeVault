import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createTradingAccountRepository, ensureWorkspaceForUser } from "@/db/repositories/workspaces";
import { getUserTimeZone } from "@/db/repositories/preferences";
import { getDb } from "@/db/server";
import { getAuth } from "@/lib/auth-server";
import { isTotpEnrolled } from "@/lib/auth-totp";

export async function requireWorkspaceSession() {
  const session = await getAuth().api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) redirect("/login");

  // TOTP enrollment is mandatory — block every gated route until the authenticator is set up.
  if (!(await isTotpEnrolled(getDb(), session.user.id))) redirect("/onboarding/2fa");

  const user = session.user;
  const displayName = user.name || user.username || "Trader";
  const username = user.username ?? "";
  const scope = await ensureWorkspaceForUser(getDb(), {
    userId: user.id,
    slugBase: username || user.name,
    tenantName: `${displayName}'s vault`,
  });
  const [account, timeZone] = await Promise.all([
    createTradingAccountRepository(getDb(), scope).getDefault(),
    getUserTimeZone(getDb(), user.id),
  ]);
  if (!account) throw new Error("Your default trading account is unavailable.");

  return { session, scope, account, timeZone, shellUser: { displayName, username } };
}
